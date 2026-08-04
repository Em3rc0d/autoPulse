// src/services/bluetoothOBD.ts
// Uses react-native-bluetooth-classic for ELM327 communication

import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';

const PIDS = {
  RPM:           '010C',
  SPEED:         '010D',
  COOLANT_TEMP:  '0105',
  ENGINE_LOAD:   '0104',
  THROTTLE_POS:  '0111',
  MAF:           '0110',
  MAP:           '010B',
  TIMING_ADV:    '010E',
  INTAKE_TEMP:   '010F',
  O2_VOLTAGE:    '0114',
  BAROMETRIC:    '0133',
  BATTERY:       '0142',
  FUEL_LEVEL:    '012F',
  OIL_TEMP:      '015C',
  VIN:           '0902',
  DTC_CODES:     '03',
  CLEAR_DTCS:    '04',
};

class BluetoothOBDService {
  private device: BluetoothDevice | null = null;
  private connected = false;
  private isMock = false;
  private isBusy = false;
  private mockDTCs: string[] = [];

  // Simulador de físicas para el modo Mock (Tráfico real animado)
  private mockPhysics = { speed: 0, rpm: 800, gear: 1, targetSpeed: 60, coolant: 90, time: 0 };

  async listDevices(): Promise<BluetoothDevice[]> {
    const paired = await RNBluetoothClassic.getBondedDevices();
    return paired;
  }

  async connect(address: string): Promise<boolean> {
    try {
      console.log(`🔗 Intentando conectar a: ${address}`);
      this.device = await RNBluetoothClassic.connectToDevice(address, {
        delimiter: '>',
        charset: 'ascii',
      });
      this.connected = true;
      await this.initELM327();
      return true;
    } catch (e) {
      console.error('BT connect error:', e);
      this.connected = false;
      return false;
    }
  }

  async connectMock(): Promise<boolean> {
    console.log(`🔗 Iniciando modo SIMULADOR OBD-II`);
    this.connected = true;
    this.isMock = true;
    this.mockDTCs = ['P0171', 'P0300'];
    return true;
  }

  async disconnect() {
    if (this.device) {
      await this.device.disconnect();
    }
    this.connected = false;
    this.device = null;
    this.isMock = false;
  }

  private async sendCommand(cmd: string, timeout = 2000): Promise<string> {
    if (!this.device || !this.connected) throw new Error('Not connected');

    // Mutex to prevent overlapping commands
    while (this.isBusy) {
      await new Promise(r => setTimeout(r, 50));
    }
    this.isBusy = true;

    try {
      // Clear buffer before sending
      await this.device.read();

    console.log(`[ELM327] SEND: ${cmd}`);
    await this.device.write(`${cmd}\r`);

    let response = '';
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const data = await this.device.read();
      if (data) {
        response += data;
        // If DELIMITER is '>', it only returns when it hits '>', so we are done.
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

      const cleaned = response.replace(/>/g, '').replace(/\r/g, '').replace(/\n/g, '').trim();
      console.log(`[ELM327] RECV: ${cleaned} (Raw: ${response.replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`);

      if (cleaned.includes('UNABLE TO CONNECT')) throw new Error('ECU no responde (Protocol Error)');
      if (cleaned.includes('NO DATA')) return 'NO DATA';
      if (cleaned.includes('CAN ERROR')) throw new Error('Error en bus CAN');

      return cleaned;
    } finally {
      this.isBusy = false;
    }
  }

  private async initELM327() {
    console.log('🛠 Inicializando ELM327...');
    await this.sendCommand('ATZ');    // Reset
    await new Promise(r => setTimeout(r, 1000));
    await this.sendCommand('ATE0');   // Echo off
    await this.sendCommand('ATL0');   // Linefeed off
    await this.sendCommand('ATH0');   // Headers off
    await this.sendCommand('ATSP0'); // Auto-detect protocol

    // Test a basic PID to see if we actually get a response from the ECU
    try {
      const test = await this.sendCommand('0100'); // Supported PIDs check
      console.log('✅ ELM327 e Interface Listos. Respuesta 0100:', test);
    } catch (e) {
      console.warn('⚠️ ELM327 listo pero el vehículo no responde (¿Ignición apagada?)');
    }
  }

  // --- Robust Parsers ---
  private parseRPM(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '410C';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 8) return null;

    const A = parseInt(bytes.slice(idx + 4, idx + 6), 16);
    const B = parseInt(bytes.slice(idx + 6, idx + 8), 16);
    return ((A * 256) + B) / 4;
  }

  private parseSpeed(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '410D';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 6) return null;

    return parseInt(bytes.slice(idx + 4, idx + 6), 16);
  }

  private parseCoolantTemp(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '4105';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 6) return null;

    return parseInt(bytes.slice(idx + 4, idx + 6), 16) - 40;
  }

  private parseEngineLoad(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '4104';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 6) return null;

    return (parseInt(bytes.slice(idx + 4, idx + 6), 16) * 100) / 255;
  }

  private parseThrottlePos(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '4111';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 6) return null;

    return (parseInt(bytes.slice(idx + 4, idx + 6), 16) * 100) / 255;
  }

  private parseMAF(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const header = '4110';
    const idx = bytes.indexOf(header);
    if (idx === -1 || bytes.length < idx + 8) return null;

    const A = parseInt(bytes.slice(idx + 4, idx + 6), 16);
    const B = parseInt(bytes.slice(idx + 6, idx + 8), 16);
    return ((A * 256) + B) / 100;
  }

  private parseMAP(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('410B');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return parseInt(bytes.slice(idx + 4, idx + 6), 16); // kPa
  }

  private parseTimingAdv(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('410E');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return (parseInt(bytes.slice(idx + 4, idx + 6), 16) / 2) - 64; // degrees relative to #1 cylinder
  }

  private parseIntakeTemp(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('410F');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return parseInt(bytes.slice(idx + 4, idx + 6), 16) - 40; // °C
  }

  private parseO2Voltage(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('4114');
    if (idx === -1 || bytes.length < idx + 8) return null;
    return parseInt(bytes.slice(idx + 4, idx + 6), 16) / 200; // Volts
  }

  private parseBarometric(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('4133');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return parseInt(bytes.slice(idx + 4, idx + 6), 16); // kPa
  }

  private parseFuelLevel(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('412F');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return (parseInt(bytes.slice(idx + 4, idx + 6), 16) * 100) / 255;
  }

  private parseOilTemp(raw: string): number | null {
    if (raw === 'NO DATA') return null;
    const bytes = raw.replace(/\s/g, '');
    const idx = bytes.indexOf('415C');
    if (idx === -1 || bytes.length < idx + 6) return null;
    return parseInt(bytes.slice(idx + 4, idx + 6), 16) - 40;
  }

  private parseVIN(raw: string): string | null {
    if (raw === 'NO DATA' || !raw) return null;
    try {
      const hex = raw.replace(/[\s\r\n>]/g, '');
      let ascii = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (code >= 32 && code <= 126) ascii += String.fromCharCode(code);
      }
      const match = ascii.match(/[A-HJ-NPR-Z0-9]{17}/);
      return match ? match[0] : ascii.slice(-17);
    } catch {
      return null;
    }
  }

  private parseDTCs(raw: string): string[] {
    if (raw === 'NO DATA' || !raw) return [];
    const lines = raw.split('\r').filter(l => l.trim() && !l.includes('NO DATA') && !l.includes('43'));
    const codes: string[] = [];

    for (const line of lines) {
      const bytes = line.replace(/\s/g, '');
      // Look for 43 (Mode 3 response)
      const startIdx = bytes.indexOf('43');
      const data = startIdx !== -1 ? bytes.slice(startIdx + 2) : bytes;

      for (let i = 0; i + 4 <= data.length; i += 4) {
        const word = data.slice(i, i + 4);
        if (word === '0000') continue;
        const first = parseInt(word[0], 16);
        const prefix = ['P', 'C', 'B', 'U'][first >> 2];
        const code = `${prefix}${(first & 3)}${word.slice(1)}`;
        codes.push(code.toUpperCase());
      }
    }
    return [...new Set(codes)]; // Unique codes
  }

  // --- Public read all ---
  async readVoltage(): Promise<number | null> {
    try {
      const raw = await this.sendCommand('AT RV');
      const match = raw.match(/([\d\.]+)/);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
      return null;
    } catch {
      return null;
    }
  }

  async readAll(vehicleId: string): Promise<any> {
    if (!this.connected) throw new Error('Bluetooth desconectado');

    if (this.isMock) {
      const p = this.mockPhysics;
      p.time += 1;

      // Cambiar el objetivo de velocidad aleatoriamente para simular tráfico animado
      if (p.time % 8 === 0) {
        // La velocidad objetivo fluctúa entre -40 y +50 km/h respecto a la actual
        p.targetSpeed = Math.max(0, Math.min(160, p.speed + (Math.random() * 90 - 40)));
        // Ocasionalmente frenar por completo o acelerar a fondo
        if (Math.random() < 0.1) p.targetSpeed = 0;
        if (Math.random() < 0.1) p.targetSpeed = 130;
      }

      const isAccelerating = p.speed < p.targetSpeed;

      if (isAccelerating) {
        p.rpm += 300 + Math.random() * 150;
        p.speed += (p.gear * 0.8) + Math.random() * 2;
        if (p.rpm > 5500) {
          if (p.gear < 6) { p.gear++; p.rpm = 2800; }
        }
      } else {
        p.rpm -= 200 + Math.random() * 100;
        p.speed -= 2.5 + Math.random() * 2;
        if (p.rpm < 1500) {
          if (p.gear > 1) { p.gear--; p.rpm = 3800; }
          else if (p.speed <= 0) { p.speed = 0; p.rpm = 800; }
        }
      }
      p.coolant = 90 + (p.rpm / 6000) * 15;

      const now = new Date();
      return {
        vehicle_id: vehicleId,
        rpm: Math.round(p.rpm),
        speed: Math.max(0, Math.round(p.speed)),
        coolant_temp: Math.round(p.coolant),
        engine_load: Math.min(100, (p.rpm / 7000) * 100 + Math.random() * 10),
        throttle_pos: isAccelerating ? 60 + Math.random() * 40 : 10 + Math.random() * 5,
        maf: (p.rpm / 100) + Math.random() * 2,
        dtc_codes: [...this.mockDTCs],
        latitude: -12.0464 + (Math.random() * 0.01 - 0.005),
        longitude: -77.0428 + (Math.random() * 0.01 - 0.005),
        timestamp: now.toISOString(),
        has_data: true
      };
    }

    const read = async (pid: string, parser: (r: string) => any) => {
      try {
        const raw = await this.sendCommand(pid, 1000);
        return parser(raw);
      } catch (e: any) {
        console.warn(`Error leyendo PID ${pid}:`, e.message);
        return null;
      }
    };

    const rpm = await read(PIDS.RPM, this.parseRPM.bind(this));
    const speed = await read(PIDS.SPEED, this.parseSpeed.bind(this));
    const coolant_temp = await read(PIDS.COOLANT_TEMP, this.parseCoolantTemp.bind(this));
    const engine_load = await read(PIDS.ENGINE_LOAD, this.parseEngineLoad.bind(this));
    const throttle_pos = await read(PIDS.THROTTLE_POS, this.parseThrottlePos.bind(this));
    const maf = await read(PIDS.MAF, this.parseMAF.bind(this));

    let dtc_codes: string[] = [];
    try {
      const dtc_raw = await this.sendCommand(PIDS.DTC_CODES, 1500);
      dtc_codes = this.parseDTCs(dtc_raw);
    } catch { }

    let voltage: number | null = null;
    try {
      voltage = await this.readVoltage();
    } catch { }

    return {
      vehicle_id: vehicleId,
      rpm, speed, coolant_temp, engine_load, throttle_pos, maf, dtc_codes, voltage,
      timestamp: new Date().toISOString(),
      has_data: rpm !== null || speed !== null // Indicator if we actually got something
    };
  }

  async readExtendedData(): Promise<any> {
    if (!this.connected) throw new Error('Bluetooth desconectado');
    if (this.isMock) {
      return {
        map: 30 + Math.random() * 70,
        timing_adv: 10 + Math.random() * 5,
        intake_temp: 30 + Math.random() * 10,
        o2_voltage: 0.1 + Math.random() * 0.8,
        barometric: 100 + Math.random() * 5,
        fuel_level: 75 - Math.random() * 0.1,
        oil_temp: 90 + Math.random() * 5,
      };
    }
    const read = async (pid: string, parser: (r: string) => any) => {
      try {
        const raw = await this.sendCommand(pid, 1000);
        return parser(raw);
      } catch (e: any) { return null; }
    };
    return {
      map: await read(PIDS.MAP, this.parseMAP.bind(this)),
      timing_adv: await read(PIDS.TIMING_ADV, this.parseTimingAdv.bind(this)),
      intake_temp: await read(PIDS.INTAKE_TEMP, this.parseIntakeTemp.bind(this)),
      o2_voltage: await read(PIDS.O2_VOLTAGE, this.parseO2Voltage.bind(this)),
      barometric: await read(PIDS.BAROMETRIC, this.parseBarometric.bind(this)),
      fuel_level: await read(PIDS.FUEL_LEVEL, this.parseFuelLevel.bind(this)),
      oil_temp: await read(PIDS.OIL_TEMP, this.parseOilTemp.bind(this)),
    };
  }

  fullDiagnostic(): Promise<{ dtcs: string[], battery: string }> {
    return new Promise(async (resolve, reject) => {
      if (!this.connected) return reject(new Error("No conectado al ELM327"));
      let dtc_raw;
      try { dtc_raw = await this.sendCommand(PIDS.DTC_CODES, 2000); } catch { dtc_raw = 'NO DATA'; }
      const dtcs = this.parseDTCs(dtc_raw);

      let battery = "0.0V";
      try { battery = await this.sendCommand('AT RV'); } catch { }

      resolve({ dtcs, battery });
    });
  }

  isConnected() { return this.connected; }

  getConnectedDeviceName(): string | null {
    if (!this.connected) return null;
    if (this.isMock) return "MODO SIMULADOR (TESTING)";
    return this.device?.name || "ELM327 OBD-II";
  }

  async clearDTCs(): Promise<boolean> {
    if (!this.connected) throw new Error('Bluetooth desconectado');
    if (this.isMock) {
      this.mockDTCs = [];
      return true;
    }
    try {
      const res = await this.sendCommand(PIDS.CLEAR_DTCS, 2000);
      return res.includes('OK') || res.includes('44');
    } catch {
      return false;
    }
  }

  async readVIN(): Promise<string | null> {
    if (!this.connected) return null;
    if (this.isMock) return "1HGCM82633A00435";
    try {
      const raw = await this.sendCommand(PIDS.VIN, 2000);
      return this.parseVIN(raw);
    } catch {
      return null;
    }
  }
}

export const bluetoothOBD = new BluetoothOBDService();
