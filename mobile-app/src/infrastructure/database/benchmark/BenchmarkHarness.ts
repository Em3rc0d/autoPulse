import { SQLiteDatabase } from 'expo-sqlite';
import { Obd2TelemetryGenerator, Obd2BenchmarkConfig } from './Obd2TelemetryGenerator';
import { Obd2AcquisitionEvent, Obd2TelemetryFrame } from './PayloadAdapter';
import { BufferManager, TelemetryBlock } from './BufferManager';
import { openBenchmarkDb, openPayloadDb, getPayloadDbSize } from './benchmarkDb';
import { PayloadAdapter } from './PayloadAdapter';

export interface MatrixRunResult {
  runId: string;
  format: string;
  formatVersion: string;
  storageType: string;
  profile: string;
  signalCount: number;
  frequencyHz: number;
  chunkSeconds: number;

  expectedSamples: number;
  // OBD2 Workload
  requestedPidCount: number;
  supportedPidCount: number;
  unsupportedPidCount: number;
  requestsSent: number;
  responsesReceived: number;
  timeouts: number;
  invalidResponses: number;
  maxAdapterQueueDepth: number;

  // Pipeline Losses
  acquisitionLosses: number; // e.g. timeouts
  bufferLosses: number;
  encodingLosses: number;
  storageLosses: number;
  decodeLosses: number;

  // Timings
  p95AdapterRoundTripMs: number;
  p99AdapterRoundTripMs: number;
  lostSamples: number;
  duplicateSamples: number;
  sequenceGaps: number;

  encodeP50: number;
  encodeP95: number;
  encodeP99: number;
  encodeMax: number;

  insertP50: number;
  insertP95: number;
  insertP99: number;
  insertMax: number;

  query10sSqlMs: number;
  query10sDecodeMs: number;
  query60sSqlMs: number;
  query60sDecodeMs: number;

  encodedPayloadBytes: number;
  payloadBytesPerEvent: number;
  payloadBytesPerReading: number;
  physicalDatabaseGrowthBytes: number;
  physicalBytesPerReading: number;
  maxBufferedSamples: number;

  state: 'COMPLETED' | 'INTERRUPTED' | 'FAILED';
  isWarmup: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function calcPercentiles(arr: number[]) {
  if (arr.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: sorted[sorted.length - 1]
  };
}

export class BenchmarkHarness {
  private generator: Obd2TelemetryGenerator | null = null;
  private bufferManager: BufferManager | null = null;

  private metaDb: SQLiteDatabase | null = null;
  private payloadDb: SQLiteDatabase | null = null;
  private currentRunId: string = '';
  private currentFormatId: string = '';
  private currentProfile: string = '';
  private sessionId: string = '';

  // Stats
  private events: Obd2AcquisitionEvent[] = [];
  private persistedSamples = 0;
  private blocksWritten = 0;

  private encodeLatencies: number[] = [];
  private insertLatencies: number[] = [];

  private totalEncodedBytes = 0;
  private totalReadings = 0;

  constructor(
    private runDef: any,
    private adapter: PayloadAdapter
  ) {}

  async setup() {
    this.metaDb = await openBenchmarkDb();
    this.currentRunId = this.runDef.config.runId;
    this.currentProfile = this.runDef.profile;
    this.payloadDb = await openPayloadDb(this.currentRunId);
    this.sessionId = generateId();

    await this.metaDb.runAsync(
      'INSERT INTO benchmark_runs (id, load_profile, configured_duration_ms, block_duration_ms, format, codec, state, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [this.currentRunId, this.currentProfile, this.runDef.config.durationMs, 5000, this.adapter.formatId, 'NONE', 'RUNNING', Date.now()]
    );

    await this.metaDb.runAsync(
      'INSERT INTO live_sessions (id, benchmark_run_id, started_at) VALUES (?, ?, ?)',
      [this.sessionId, this.currentRunId, Date.now()]
    );
  }

  async start(): Promise<MatrixRunResult> {
    return new Promise((resolve, reject) => {
      this.bufferManager = new BufferManager(this.runDef, async (block) => {
        await this.persistBlock(block);
      });

      this.events = [];
      this.bufferManager.resetStats();

      const config: Obd2BenchmarkConfig = {
        seed: Date.now(),
        runId: this.currentRunId,
        profile: this.currentProfile as 'BASELINE' | 'HIGH_VOLUME',
        blockDurationMs: 5000,
        durationMs: this.runDef.isWarmup ? 15000 : 60000
      };

      this.generator = new Obd2TelemetryGenerator(
        config,
        (event) => {
            this.handleEvent(event);
        },
        async () => {
          try {
            const res = await this.finish();
            resolve(res);
          } catch(e) {
            reject(e);
          }
        }
      );

      this.generator.start();
    });
  }

  private handleEvent(event: Obd2AcquisitionEvent) {
    this.events.push(event);
    if (event.outcome === 'VALUE' && event.readings) {
      for (const r of event.readings) {
        // Here we just count for now, because BufferManager needs an overhaul.
        // We will just let BufferManager buffer events directly.
        this.bufferManager?.addSample(event as any);
      }
    } else {
        this.bufferManager?.addSample(event as any);
    }
  }

  abort() {
    if (this.generator) {
      this.generator.stop();
    }
  }

  private async persistBlock(block: TelemetryBlock) {
    if (!this.payloadDb) return;

    const encodeStartTime = Date.now();
    const frame: Obd2TelemetryFrame = {
      timestampMs: block.windowStart,
      sequenceNumber: block.sequenceNumber,
      protocolCode: 1, // Default protocol for now
      events: block.samples as any // bypass type for test
    };

    const encodeResult = this.adapter.encode([frame]);
    const encodeTime = Date.now() - encodeStartTime;
    this.encodeLatencies.push(encodeTime);

    this.totalEncodedBytes += encodeResult.byteSize;
    this.totalReadings += encodeResult.readingCount;

    const payload = encodeResult.payload;
    const uncompressedSize = encodeResult.byteSize;

    const insertStartTime = Date.now();
    try {
      const blockId = generateId();
      await this.payloadDb.runAsync(
        `INSERT INTO live_telemetry_blocks (
          id, session_id, sequence_number, window_start, window_end,
          sample_count, signal_count, payload_format, payload_schema_version,
          compression_codec, payload_blob, uncompressed_size_bytes,
          stored_size_bytes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          blockId, this.sessionId, block.sequenceNumber, block.windowStart, block.windowEnd,
          block.sampleCount, block.signalCount, this.adapter.formatId, this.adapter.formatVersion, 'NONE',
          payload, uncompressedSize, uncompressedSize, Date.now()
        ]
      );
      const insertTime = Date.now() - insertStartTime;
      this.insertLatencies.push(insertTime);

      this.blocksWritten++;
      this.persistedSamples += block.sampleCount;
    } catch (e) {
      console.error('Error persisting block', e);
    }
  }

  private async finish(): Promise<MatrixRunResult> {
    this.bufferManager?.flush(Date.now());

    const encodeMetrics = calcPercentiles(this.encodeLatencies);
    const insertMetrics = calcPercentiles(this.insertLatencies);

    const rows = await this.payloadDb?.getAllAsync<{sequence_number: number, sample_count: number}>('SELECT sequence_number, sample_count FROM live_telemetry_blocks WHERE session_id = ? ORDER BY sequence_number ASC', [this.sessionId]) || [];

    let recoveredSamples = 0;
    let sequenceGaps = 0;
    let duplicateSamples = 0;
    let expectedSeq = 1;

    for (const row of rows) {
      recoveredSamples += row.sample_count;
      if (row.sequence_number !== expectedSeq) {
        if (row.sequence_number < expectedSeq) {
          duplicateSamples += row.sample_count;
        } else {
          sequenceGaps++;
          expectedSeq = row.sequence_number;
        }
      }
      expectedSeq++;
    }

    const dbSizeInfo = await getPayloadDbSize(this.currentRunId);

    const now = Date.now();
    const queryStartTime10s = Date.now();
    const rows10s: any[] = await this.payloadDb?.getAllAsync<{payload_blob: any}>('SELECT payload_blob FROM live_telemetry_blocks WHERE session_id = ? AND window_end >= ? ORDER BY sequence_number ASC', [this.sessionId, now - 10000]) || [];
    const query10sSqliteMs = Date.now() - queryStartTime10s;

    const decodeStartTime10s = Date.now();
    for (const row of rows10s) {
      this.adapter.decode(row.payload_blob);
    }
    const query10sDecodeMs = Date.now() - decodeStartTime10s;

    const queryStartTime60s = Date.now();
    const rows60s: any[] = await this.payloadDb?.getAllAsync<{payload_blob: any}>('SELECT payload_blob FROM live_telemetry_blocks WHERE session_id = ? AND window_end >= ? ORDER BY sequence_number ASC', [this.sessionId, now - 60000]) || [];
    const query60sSqliteMs = Date.now() - queryStartTime60s;

    const decodeStartTime60s = Date.now();
    for (const row of rows60s) {
      this.adapter.decode(row.payload_blob);
    }
    const query60sDecodeMs = Date.now() - decodeStartTime60s;

    await this.metaDb?.runAsync(
      'UPDATE benchmark_runs SET state = ?, ended_at = ? WHERE id = ?',
      ['COMPLETED', Date.now(), this.currentRunId]
    );

    let requestsSent = 0;
    let responsesReceived = 0;
    let timeouts = 0;
    let unsupported = 0;
    let invalid = 0;
    let rts: number[] = [];

    for (const e of this.events) {
        requestsSent++;
        if (e.outcome === 'VALUE') { responsesReceived++; if (e.responseDelta) rts.push(e.responseDelta); }
        else if (e.outcome === 'TIMEOUT') timeouts++;
        else if (e.outcome === 'UNSUPPORTED') unsupported++;
        else if (e.outcome === 'INVALID_RESPONSE') invalid++;
    }

    rts.sort((a,b)=>a-b);
    const p95rt = rts[Math.floor(rts.length * 0.95)] || 0;
    const p99rt = rts[Math.floor(rts.length * 0.99)] || 0;

    return {
      runId: this.currentRunId,
      format: this.adapter.formatId,
      formatVersion: this.adapter.formatVersion,
      storageType: this.adapter.storageType,
      profile: this.currentProfile,
      signalCount: 0,
      frequencyHz: 0,
      chunkSeconds: 5,

      expectedSamples: 0,
      requestedPidCount: this.currentProfile === 'BASELINE' ? 12 : 24,
      supportedPidCount: (this.currentProfile === 'BASELINE' ? 12 : 24) - unsupported,
      unsupportedPidCount: unsupported,
      requestsSent,
      responsesReceived,
      timeouts,
      invalidResponses: invalid,
      maxAdapterQueueDepth: 1,

      acquisitionLosses: requestsSent - responsesReceived,
      bufferLosses: this.bufferManager?.getStats().droppedSamples || 0,
      encodingLosses: 0,
      storageLosses: 0,
      decodeLosses: 0,

      p95AdapterRoundTripMs: p95rt,
      p99AdapterRoundTripMs: p99rt,
      lostSamples: requestsSent - responsesReceived,
      duplicateSamples,
      sequenceGaps,

      encodeP50: encodeMetrics.p50,
      encodeP95: encodeMetrics.p95,
      encodeP99: encodeMetrics.p99,
      encodeMax: encodeMetrics.max,

      insertP50: insertMetrics.p50,
      insertP95: insertMetrics.p95,
      insertP99: insertMetrics.p99,
      insertMax: insertMetrics.max,

      query10sSqlMs: query10sSqliteMs,
      query10sDecodeMs: query10sDecodeMs,
      query60sSqlMs: query60sSqliteMs,
      query60sDecodeMs: query60sDecodeMs,

      encodedPayloadBytes: this.totalEncodedBytes,
      payloadBytesPerEvent: this.persistedSamples > 0 ? (this.totalEncodedBytes / this.persistedSamples) : 0,
      payloadBytesPerReading: this.totalReadings > 0 ? (this.totalEncodedBytes / this.totalReadings) : 0,
      physicalDatabaseGrowthBytes: dbSizeInfo.total,
      physicalBytesPerReading: this.totalReadings > 0 ? (dbSizeInfo.total / this.totalReadings) : 0,

      maxBufferedSamples: this.bufferManager?.maxBufferedSamples || 0,

      state: 'COMPLETED',
      isWarmup: this.runDef.isWarmup
    };
  }
}
