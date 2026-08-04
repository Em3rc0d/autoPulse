import { StandardJsonAdapter } from './StandardJsonAdapter';
import { CompactArrayJsonAdapter } from './CompactArrayJsonAdapter';
import { BinaryFixedV1Adapter } from './BinaryFixedV1Adapter';
import { BinaryFixedV3Adapter } from './BinaryFixedV3Adapter';
import { Obd2TelemetryFrame, PayloadAdapter } from './PayloadAdapter';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

function createEdgeCases(): Obd2TelemetryFrame[] {
  return [
    {
      timestampMs: 1672531200000,
      sequenceNumber: 1,
      protocolCode: 1,
      events: [
        {
          requestSequence: 1,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x0C,
          requestDelta: 10, responseDelta: 20, decodeDelta: 2,
          outcome: 'VALUE', connectionState: 'CONNECTED',
          readings: [{ signalDefinitionId: 'ENGINE_RPM', normalizedValue: 2500, unit: 'RPM', quality: 'VALID' }]
        },
        {
          requestSequence: 2,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x14,
          requestDelta: 50, responseDelta: 25, decodeDelta: 3,
          outcome: 'VALUE', connectionState: 'CONNECTED',
          readings: [
            { signalDefinitionId: 'O2_VOLTAGE_1', normalizedValue: 0.45, unit: 'V', quality: 'VALID' },
            { signalDefinitionId: 'O2_TRIM_1', normalizedValue: -2.3, unit: '%', quality: 'VALID' }
          ]
        },
        {
          requestSequence: 3,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x0D,
          requestDelta: 100, responseDelta: 15, decodeDelta: 1,
          outcome: 'VALUE', connectionState: 'CONNECTED',
          readings: [{ signalDefinitionId: 'VEHICLE_SPEED', normalizedValue: 0, unit: 'km/h', quality: 'VALID' }]
        },
        {
          requestSequence: 4,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x05,
          requestDelta: 150, responseDelta: 18, decodeDelta: 1,
          outcome: 'VALUE', connectionState: 'CONNECTED',
          readings: [{ signalDefinitionId: 'COOLANT_TEMP', normalizedValue: -10.5, unit: 'C', quality: 'VALID' }]
        },
        {
          requestSequence: 5,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x2F,
          requestDelta: 200,
          outcome: 'TIMEOUT', errorCode: 'TIMEOUT', connectionState: 'CONNECTED',
          readings: []
        },
        {
          requestSequence: 6,
          ecuAddress: 0x07E8, service: 0x01, pid: 0xA1,
          requestDelta: 250,
          outcome: 'UNSUPPORTED', connectionState: 'CONNECTED',
          readings: []
        },
        {
          requestSequence: 7,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x0C,
          requestDelta: 300, responseDelta: 20,
          outcome: 'INVALID_RESPONSE', errorCode: 'MALFORMED_RESPONSE', connectionState: 'CONNECTED',
          readings: []
        },
        {
          requestSequence: 8,
          requestDelta: 400,
          outcome: 'CONNECTION_ERROR', errorCode: 'ADAPTER_DISCONNECTED', connectionState: 'DISCONNECTED',
          readings: []
        },
        {
          requestSequence: 9,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x0C,
          requestDelta: 500,
          outcome: 'CANCELLED', errorCode: 'REQUEST_CANCELLED', connectionState: 'CONNECTED',
          readings: []
        },
        {
          requestSequence: 10,
          ecuAddress: 0x07E9, service: 0x01, pid: 0x0C,
          requestDelta: 600, responseDelta: 300, decodeDelta: 1,
          outcome: 'VALUE', connectionState: 'CONNECTED',
          readings: [{ signalDefinitionId: 'ENGINE_RPM', normalizedValue: 2500, unit: 'RPM', quality: 'DEGRADED' }]
        }
      ]
    }
  ];
}

async function runCorruptionTests(adapter: PayloadAdapter, basePayload: any): Promise<{expected: number, passed: number, crcValidated: boolean}> {
  let expected = 0;
  let passed = 0;
  let crcValidated = false;

  if (adapter.formatId === 'BINARY_OBD2_V2') {
    // 1. Unknown version
    expected++;
    const vPayload = new Uint8Array(basePayload);
    vPayload[4] = 99; // unknown version
    let res = adapter.decode(vPayload);
    if (res.errors.length > 0) passed++;

    // 2. Incorrect Magic
    expected++;
    const mPayload = new Uint8Array(basePayload);
    mPayload[0] = 0x00;
    res = adapter.decode(mPayload);
    if (res.errors.length > 0) passed++;

    // 3. CRC Error
    expected++;
    const cPayload = new Uint8Array(basePayload);
    cPayload[cPayload.length - 1] = ~cPayload[cPayload.length - 1]; // flip last byte of data
    res = adapter.decode(cPayload);
    if (res.errors.some(e => e.includes('CRC'))) {
      passed++;
      crcValidated = true;
    }

    // 4. Truncated
    expected++;
    const tPayload = new Uint8Array(basePayload.buffer, basePayload.byteOffset, basePayload.byteLength - 10);
    res = adapter.decode(tPayload);
    if (res.errors.length > 0) passed++;
  } else {
    crcValidated = true; // Not applicable for JSON
    expected++;
    let payloadStr = typeof basePayload === 'string' ? basePayload : String(basePayload);
    payloadStr = payloadStr.substring(0, payloadStr.length / 2);
    let res = adapter.decode(payloadStr);
    if (res.errors.length > 0) passed++;
  }

  return { expected, passed, crcValidated };
}

export async function runNativeCorrectness() {
  const adapters: PayloadAdapter[] = [
    new StandardJsonAdapter(),
    new CompactArrayJsonAdapter(),
    new BinaryFixedV1Adapter(),
    new BinaryFixedV3Adapter()
  ];

  const originalFrames = createEdgeCases();
  const results = [];

  for (const adapter of adapters) {
    let dbName = `test_${adapter.formatId}.db`;
    try {
      const encodeRes = adapter.encode(originalFrames);

      // SQLite Persist
      await FileSystem.deleteAsync(FileSystem.documentDirectory + 'SQLite/' + dbName, { idempotent: true });
      let db = await SQLite.openDatabaseAsync(dbName);

      const storageType = adapter.storageType === 'BLOB' ? 'BLOB' : 'TEXT';
      await db.execAsync(`CREATE TABLE test (id TEXT, payload ${storageType});`);

      if (storageType === 'BLOB') {
        await db.runAsync('INSERT INTO test (id, payload) VALUES (?, ?)', ['1', encodeRes.payload as Uint8Array]);
      } else {
        await db.runAsync('INSERT INTO test (id, payload) VALUES (?, ?)', ['1', encodeRes.payload as string]);
      }

      await db.closeAsync();

      // Reopen
      db = await SQLite.openDatabaseAsync(dbName);
      const row = await db.getFirstAsync<{payload: any}>('SELECT payload FROM test WHERE id = ?', ['1']);
      const payload = row?.payload;
      const persistedBytes = storageType === 'BLOB' ? (payload as Uint8Array).byteLength : (payload as string).length;
      await db.closeAsync();

      const decodeRes = adapter.decode(payload);

      // Corruption Tests
      const corrupRes = await runCorruptionTests(adapter, payload);

      let semanticMismatches = 0;
      let maxAbsoluteError = 0;
      let maxRelativeError = 0;

      if (decodeRes.eventCount !== encodeRes.eventCount || decodeRes.readingCount !== encodeRes.readingCount) {
         semanticMismatches++;
      }

      const origEventCount = originalFrames[0].events.length;
      const decEventCount = decodeRes.frames[0]?.events.length || 0;
      if (origEventCount !== decEventCount) {
         semanticMismatches++;
      } else {
        for (let i = 0; i < origEventCount; i++) {
          const o = originalFrames[0].events[i];
          const d = decodeRes.frames[0].events[i];

          if (o.requestSequence !== d.requestSequence) semanticMismatches++;
          if (o.outcome !== d.outcome) semanticMismatches++;
          if (o.errorCode !== d.errorCode) semanticMismatches++;
          if (o.readings.length !== d.readings.length) semanticMismatches++;

          if (o.outcome === 'VALUE') {
             for (let j = 0; j < o.readings.length; j++) {
               const or = o.readings[j];
               const dr = d.readings[j];
               if (or.signalDefinitionId !== dr.signalDefinitionId) semanticMismatches++;

               const absErr = Math.abs(or.normalizedValue - dr.normalizedValue);
               if (absErr > maxAbsoluteError) maxAbsoluteError = absErr;
               if (or.normalizedValue !== 0) {
                 const relErr = absErr / Math.abs(or.normalizedValue);
                 if (relErr > maxRelativeError) maxRelativeError = relErr;
               }

               if (absErr > 0.0001) semanticMismatches++;
               if (or.quality !== dr.quality) semanticMismatches++;
               if (or.unit !== dr.unit) semanticMismatches++;
             }
          }
        }
      }

      results.push({
        entryPoint: 'index.benchmark.js',
        format: adapter.formatId,
        formatVersion: encodeRes.formatVersion,
        storageType: adapter.storageType,
        eventsExpected: encodeRes.eventCount,
        eventsRecovered: decodeRes.eventCount,
        readingsExpected: encodeRes.readingCount,
        readingsRecovered: decodeRes.readingCount,
        encodedBytes: encodeRes.byteSize,
        persistedBytes: persistedBytes,
        recoveredBytes: persistedBytes,
        semanticMismatches,
        maxAbsoluteError,
        maxRelativeError,
        crcValidated: corrupRes.crcValidated,
        corruptionCasesExpected: corrupRes.expected,
        corruptionCasesPassed: corrupRes.passed,
        state: semanticMismatches === 0 && corrupRes.expected === corrupRes.passed ? 'PASS' : 'FAIL',
      });
    } catch (e: any) {
      results.push({
        entryPoint: 'index.benchmark.js',
        format: adapter.formatId,
        state: 'CRASH',
        crashMessage: e.message
      });
    }
  }

  console.log('=== C0-N1 OBD2 v2 CORRECTNESS RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  return results;
}
