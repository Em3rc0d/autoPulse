import * as FileSystem from 'expo-file-system';
import { BenchmarkConfig } from './TelemetryGenerator';
import { PayloadAdapter } from './PayloadAdapter';
import { StandardJsonAdapter } from './StandardJsonAdapter';
import { CompactArrayJsonAdapter } from './CompactArrayJsonAdapter';
import { BinaryFixedV1Adapter } from './BinaryFixedV1Adapter';
import { BinaryFixedV3Adapter } from './BinaryFixedV3Adapter';
import { BenchmarkHarness, MatrixRunResult } from './BenchmarkHarness';

export type MatrixState = 'CREATED' | 'RUNNING' | 'INTERRUPTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface MatrixRunDef {
  profile: 'BASELINE' | 'HIGH_VOLUME';
  isWarmup: boolean;
  formatId: string;
  config: BenchmarkConfig;
}

export interface MatrixOrchestratorState {
  matrixId: string;
  profile: 'BASELINE' | 'HIGH_VOLUME';
  runs: MatrixRunDef[];
  currentRunIndex: number;
  results: MatrixRunResult[];
  lastResult?: MatrixRunResult;
  status: MatrixState;
  startTime: number;
}

const STATE_FILE = FileSystem.documentDirectory + 'c0n2_matrix_state.json';

export class MatrixOrchestrator {
  private state: MatrixOrchestratorState;
  private currentHarness: BenchmarkHarness | null = null;

  // Callback when progress changes
  public onProgress?: (state: MatrixOrchestratorState) => void;

  private constructor(state: MatrixOrchestratorState) {
    this.state = state;
  }

  static async create(profile: 'BASELINE' | 'HIGH_VOLUME'): Promise<MatrixOrchestrator> {
    const configTemplate: BenchmarkConfig = {
      runId: '',
      hz: 10,
      signalsCount: profile === 'BASELINE' ? 12 : 24,
      durationMs: 60000,
      blockDurationMs: 5000,
      loadProfile: profile
    };

    const formats: string[] = ['STANDARD_JSON', 'COMPACT_ARRAY_JSON', 'BINARY_FIXED_V1', 'BINARY_FIXED_V3'];

    // Warmups: Std -> Comp -> Bin -> BinV3 (15s)
    const runs: MatrixRunDef[] = [];
    for (const f of formats) {
      runs.push({
        profile,
        isWarmup: true,
        formatId: f,
        config: { ...configTemplate, durationMs: 15000, runId: `run_${profile}_warmup_${f}_${Date.now()}` }
      });
    }

    // Run 1: Std -> Comp -> Bin
    for (const f of formats) {
      runs.push({
        profile,
        isWarmup: false,
        formatId: f,
        config: { ...configTemplate, runId: `run_${profile}_r1_${f}_${Date.now()}` }
      });
    }

    // Run 2: Comp -> Bin -> Std
    const formatsR2 = ['COMPACT_ARRAY_JSON', 'BINARY_FIXED_V1', 'STANDARD_JSON'];
    for (const f of formatsR2) {
      runs.push({
        profile,
        isWarmup: false,
        formatId: f,
        config: { ...configTemplate, runId: `run_${profile}_r2_${f}_${Date.now()}` }
      });
    }

    // Run 3: Bin -> Std -> Comp
    const formatsR3 = ['BINARY_FIXED_V1', 'STANDARD_JSON', 'COMPACT_ARRAY_JSON'];
    for (const f of formatsR3) {
      runs.push({
        profile,
        isWarmup: false,
        formatId: f,
        config: { ...configTemplate, runId: `run_${profile}_r3_${f}_${Date.now()}` }
      });
    }

    const state: MatrixOrchestratorState = {
      matrixId: `matrix_${profile}_${Date.now()}`,
      profile,
      runs,
      currentRunIndex: 0,
      results: [],
      lastResult: undefined,
      status: 'CREATED',
      startTime: Date.now()
    };

    const orchestrator = new MatrixOrchestrator(state);
    await orchestrator.persistState();
    return orchestrator;
  }

  static async load(): Promise<MatrixOrchestrator | null> {
    try {
      const info = await FileSystem.getInfoAsync(STATE_FILE);
      if (!info.exists) return null;
      const content = await FileSystem.readAsStringAsync(STATE_FILE);
      const state = JSON.parse(content) as MatrixOrchestratorState;
      if (state.status === 'RUNNING') {
        state.status = 'INTERRUPTED'; // Was killed during run
      }
      return new MatrixOrchestrator(state);
    } catch(e) {
      return null;
    }
  }

  static async clearState() {
    await FileSystem.deleteAsync(STATE_FILE, { idempotent: true });
  }

  private async persistState() {
    await FileSystem.writeAsStringAsync(STATE_FILE, JSON.stringify(this.state, null, 2));
    this.onProgress?.(this.state);
  }

  public getState() {
    return this.state;
  }

  private getAdapter(formatId: string): PayloadAdapter {
    switch (formatId) {
      case 'STANDARD_JSON': return new StandardJsonAdapter();
      case 'COMPACT_ARRAY_JSON': return new CompactArrayJsonAdapter();
      case 'BINARY_FIXED_V1': return new BinaryFixedV1Adapter();
      case 'BINARY_FIXED_V3': return new BinaryFixedV3Adapter();
      default: throw new Error(`Unknown format: ${formatId}`);
    }
  }

  public async startOrResume() {
    if (this.state.status === 'COMPLETED' || this.state.status === 'CANCELLED') return;

    this.state.status = 'RUNNING';
    await this.persistState();

    while (this.state.currentRunIndex < this.state.runs.length && this.state.status === 'RUNNING') {
      const runDef = this.state.runs[this.state.currentRunIndex];
      const adapter = this.getAdapter(runDef.formatId);

      this.currentHarness = new BenchmarkHarness(
        runDef,
        adapter
      );
      await this.currentHarness.setup();

      try {
        console.log(`[MatrixOrchestrator] Starting run ${this.state.currentRunIndex + 1}/${this.state.runs.length}: ${runDef.formatId} (Warmup: ${runDef.isWarmup})`);
        const result = await this.currentHarness.start();

        console.log(`[MatrixOrchestrator] Run finished. Latency P99: ${result.insertP99}ms, Encoded payload bytes: ${result.encodedPayloadBytes}, DB growth: ${result.physicalDatabaseGrowthBytes}`);

        // Remove from results if there's already a result for this runId (due to resume)
        this.state.results = this.state.results.filter(r => r.runId !== result.runId);
        this.state.results.push(result);
        this.state.lastResult = result;

        this.state.currentRunIndex++;
        await this.persistState();

        if (this.state.currentRunIndex < this.state.runs.length) {
          console.log(`[MatrixOrchestrator] Pausing 7 seconds before next run...`);
          // Pause 7 seconds between runs
          await new Promise(res => setTimeout(res, 7000));
        }
      } catch (e: any) {
        if (e.message === 'ABORTED') {
          console.log(`[MatrixOrchestrator] Run aborted by user.`);
          this.state.status = 'CANCELLED';
        } else {
          console.log(`[MatrixOrchestrator] Run failed: ${e.message}`);
          this.state.status = 'FAILED';
          console.error('Matrix failed:', e);
        }
        await this.persistState();
        break;
      }
    }

    if (this.state.currentRunIndex >= this.state.runs.length && this.state.status === 'RUNNING') {
      console.log(`[MatrixOrchestrator] Matrix ${this.state.profile} COMPLETED successfully.`);
      this.state.status = 'COMPLETED';
      await this.persistState();
      await this.exportResults();
      await MatrixOrchestrator.clearState();
    }
  }

  public async interrupt() {
    if (this.state.status === 'RUNNING') {
      this.currentHarness?.abort();
      this.state.status = 'INTERRUPTED';
      await this.persistState();
    }
  }

  public async cancel() {
    this.currentHarness?.abort();
    this.state.status = 'CANCELLED';
    await this.persistState();
    await MatrixOrchestrator.clearState();
  }

  public async exportResults() {
    const uri = FileSystem.documentDirectory + `c0_n2_${this.state.profile.toLowerCase()}_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(this.state.results, null, 2));

    console.log(`[MatrixOrchestrator] Matrix ${this.state.profile} COMPLETED successfully.`);
    console.log(`Exported matrix results to ${uri}`);
    console.log('=== FINAL RESULTS JSON ===');
    console.log(JSON.stringify(this.state.results, null, 2));
    console.log('==========================');
    return uri;
  }
}
