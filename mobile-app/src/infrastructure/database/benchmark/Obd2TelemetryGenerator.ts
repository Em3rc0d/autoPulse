import { Obd2AcquisitionEvent, Obd2Outcome, Obd2ErrorCode, TelemetryQuality, ConnectionState } from './PayloadAdapter';

export interface Obd2BenchmarkConfig {
  seed: number;
  runId: string;
  profile: 'BASELINE' | 'HIGH_VOLUME';
  blockDurationMs: number;
  durationMs: number;
}

interface PidConfig {
  ecu: number;
  service: number;
  pid: number;
  sigId: string;
  unit: string;
  targetPeriodMs: number;
  simulateUnsupported?: boolean;
}

export class Obd2TelemetryGenerator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime = 0;
  private requestSequence = 1;

  // PRNG
  private currentSeed: number;

  private pids: PidConfig[] = [];

  constructor(
    private config: Obd2BenchmarkConfig,
    private onEvent: (event: Obd2AcquisitionEvent) => void,
    private onComplete: () => void
  ) {
    this.currentSeed = config.seed;
    this.setupProfile();
  }

  private random(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 4294967296;
    this.currentSeed = (a * this.currentSeed + c) % m;
    return this.currentSeed / m;
  }

  private setupProfile() {
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x0C, sigId: 'ENGINE_RPM', unit: 'RPM', targetPeriodMs: 200 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x0D, sigId: 'VEHICLE_SPEED', unit: 'km/h', targetPeriodMs: 200 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x11, sigId: 'THROTTLE_POS', unit: '%', targetPeriodMs: 200 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x04, sigId: 'ENGINE_LOAD', unit: '%', targetPeriodMs: 200 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x05, sigId: 'COOLANT_TEMP', unit: 'C', targetPeriodMs: 1000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x0B, sigId: 'INTAKE_PRESSURE', unit: 'kPa', targetPeriodMs: 1000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x10, sigId: 'MAF_AIR_FLOW', unit: 'g/s', targetPeriodMs: 1000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x0E, sigId: 'TIMING_ADVANCE', unit: '', targetPeriodMs: 1000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x2F, sigId: 'FUEL_LEVEL', unit: '%', targetPeriodMs: 5000, simulateUnsupported: this.config.profile === 'BASELINE' });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x46, sigId: 'AMBIENT_AIR_TEMP', unit: 'C', targetPeriodMs: 5000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x33, sigId: 'BAROMETRIC_PRESSURE', unit: 'kPa', targetPeriodMs: 5000 });
    this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x42, sigId: 'CONTROL_MODULE_VOLTAGE', unit: 'V', targetPeriodMs: 5000 });

    if (this.config.profile === 'HIGH_VOLUME') {
      this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x0F, sigId: 'INTAKE_AIR_TEMP', unit: 'C', targetPeriodMs: 1000 });
      this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x14, sigId: 'O2_VOLTAGE_1', unit: 'V', targetPeriodMs: 1000 });
      this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x15, sigId: 'O2_VOLTAGE_2', unit: 'V', targetPeriodMs: 1000 });
      this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0x2C, sigId: 'COMMANDED_EGR', unit: '%', targetPeriodMs: 1000 });

      for (let i = 1; i <= 8; i++) {
        this.pids.push({ ecu: 0x07E8, service: 0x01, pid: 0xA0 + i, sigId: `MISC_PID_${i}`, unit: 'RAW', targetPeriodMs: 5000, simulateUnsupported: (i <= 3) });
      }
    }
  }

  start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.loop();
  }

  private loop() {
    if (!this.isRunning) return;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.config.durationMs) {
      this.stop();
      this.onComplete();
      return;
    }

    // Single active request simulation
    // Pick the next PID (simple round robin for now, prioritizing by skipping if target period not met)
    const pid = this.pids[(this.requestSequence - 1) % this.pids.length];

    // Simulate adapter latency
    const baseLatency = this.config.profile === 'BASELINE' ? 20 : 40;
    const latency = baseLatency + Math.floor(this.random() * 20); // 20-40ms or 40-60ms

    // Outcome injection
    let outcome: Obd2Outcome = 'VALUE';
    let errorCode: Obd2ErrorCode | undefined;
    let quality: TelemetryQuality = 'VALID';
    let connectionState: ConnectionState = 'CONNECTED';
    let simulateTimeoutProb = this.config.profile === 'BASELINE' ? 0.01 : 0.05;

    // High Volume disconnect at 30s
    if (this.config.profile === 'HIGH_VOLUME' && elapsed > 30000 && elapsed < 32000) {
      outcome = 'CONNECTION_ERROR';
      errorCode = 'ADAPTER_DISCONNECTED';
      connectionState = 'DISCONNECTED';
    } else if (pid.simulateUnsupported) {
      outcome = 'UNSUPPORTED';
    } else if (this.random() < simulateTimeoutProb) {
      outcome = 'TIMEOUT';
      errorCode = 'TIMEOUT';
    } else if (this.random() < 0.005) {
      outcome = 'INVALID_RESPONSE';
      errorCode = 'MALFORMED_RESPONSE';
    }

    // Schedule the emission after latency
    setTimeout(() => {
      if (!this.isRunning) return;

      const event: Obd2AcquisitionEvent = {
        requestSequence: this.requestSequence++,
        ecuAddress: pid.ecu,
        service: pid.service,
        pid: pid.pid,
        requestDelta: Math.floor(elapsed % this.config.blockDurationMs), // Delta within block
        responseDelta: outcome !== 'TIMEOUT' && outcome !== 'UNSUPPORTED' ? latency : undefined,
        decodeDelta: outcome === 'VALUE' ? 1 : undefined, // 1ms to decode
        outcome,
        errorCode,
        connectionState,
        readings: []
      };

      if (outcome === 'VALUE') {
        event.readings.push({
          signalDefinitionId: pid.sigId,
          normalizedValue: this.random() * 100, // random value
          unit: pid.unit,
          quality
        });
      }

      this.onEvent(event);

      // Immediately loop to send next request (1 active request at a time)
      this.loop();
    }, latency);
  }

  stop() {
    this.isRunning = false;
  }
}
