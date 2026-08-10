import { useEffect, useState } from 'react';
import { useProductDb } from './useProductDb';
import { liveSessionSignalSnapshots } from '../database/product/schema/live';
import { signalDefinitions } from '../database/product/schema/signals';
import { eq } from 'drizzle-orm';
import { OBD_SIGNAL_REGISTRY } from '../../domain/telemetry/ObdSignalRegistry';

export interface LiveSignalSnapshot {
  signalDefinitionId: string; // The canonical ID (e.g. ENGINE_RPM)
  parameterDefinitionId: string; // The physical PID (e.g. 010C)
  effectiveUnit: string;
  priority: string;
  numericType: string;
}

/**
 * Retrieves the signal definitions assigned to the current live session,
 * allowing the UI to dynamically render the correct cards (e.g., Performance vs Family vs General).
 */
export function useLiveSignalTracking(sessionId: string | null) {
  const db = useProductDb();
  const [signals, setSignals] = useState<LiveSignalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !db) {
      setSignals([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchSignals = async () => {
      try {
        // Join with signalDefinitions to get the canonical signalKey
        const results = await db
          .select({
            signalDefinitionId: liveSessionSignalSnapshots.signalDefinitionId,
            parameterDefinitionId: liveSessionSignalSnapshots.parameterDefinitionId,
            effectiveUnit: liveSessionSignalSnapshots.effectiveUnit,
            priority: liveSessionSignalSnapshots.priority,
            numericType: liveSessionSignalSnapshots.numericType,
            signalKey: signalDefinitions.signalKey,
          })
          .from(liveSessionSignalSnapshots)
          .innerJoin(signalDefinitions, eq(liveSessionSignalSnapshots.signalDefinitionId, signalDefinitions.id))
          .where(eq(liveSessionSignalSnapshots.sessionId, sessionId));

          if (isMounted) {
          // Filter to only include signals that are in our registry using the canonical key
          const validSignals = results
            .filter(r => OBD_SIGNAL_REGISTRY[r.signalKey])
            .map(r => ({
              signalDefinitionId: r.signalKey, // The UI components expect this to be the canonical key!
              parameterDefinitionId: r.parameterDefinitionId,
              effectiveUnit: r.effectiveUnit || '',
              priority: r.priority,
              numericType: r.numericType,
            }));
            
          console.log(`[LIVE SNAPSHOTS]`);
          console.log(`sessionId=${sessionId}`);
          validSignals.forEach(s => {
             console.log(`${s.parameterDefinitionId} → ${s.signalDefinitionId}`);
          });

          setSignals(validSignals);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load session signals', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSignals();

    return () => {
      isMounted = false;
    };
  }, [sessionId, db]);

  return { signals, loading };
}
