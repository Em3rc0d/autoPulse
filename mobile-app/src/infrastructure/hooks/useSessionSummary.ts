import { useState, useEffect, useRef } from 'react';
import { useProductDb } from './useProductDb';
import { SessionSummaryBuilder } from '../../application/live/SessionSummaryBuilder';
import { LiveSessionRepository } from '../database/product/repositories/live-session.repository';
import { TelemetryBlockRepository } from '../database/product/repositories/TelemetryBlockRepository';
import { BinaryObd2V3Codec } from '../telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import { SessionSummaryResult } from '../../domain/telemetry/models/sessionSummaryResult';

export function useSessionSummary(workspaceId: string, sessionId: string) {
  const db = useProductDb();
  const [summary, setSummary] = useState<SessionSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!db || !workspaceId || !sessionId) return;

    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const buildSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);

        const liveRepo = new LiveSessionRepository(db);
        const blockRepo = new TelemetryBlockRepository(db);
        const codec = new BinaryObd2V3Codec();

        const builder = new SessionSummaryBuilder(liveRepo, blockRepo, codec);

        const result = await builder.build(
          workspaceId,
          sessionId,
          (p) => {
            if (!abortSignal.aborted) setProgress(p);
          },
          abortSignal
        );

        if (!abortSignal.aborted) {
          setSummary(result);
          setLoading(false);
        }
      } catch (err: any) {
        if (!abortSignal.aborted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    buildSummary();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [db, workspaceId, sessionId]);

  return { summary, loading, progress, error };
}
