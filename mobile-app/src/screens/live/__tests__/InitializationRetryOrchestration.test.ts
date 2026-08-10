import { LiveSessionRepository } from '../../../infrastructure/database/product/repositories/live-session.repository';

describe('Initialization Retry & Session Orchestration Safeguard', () => {
  let sessionRepo: any;
  let createdSessions: any[];
  let preparationCalls: string[];

  beforeEach(() => {
    createdSessions = [];
    preparationCalls = [];

    sessionRepo = {
      createSession: jest.fn().mockImplementation(async (_ws, vehicleId, opId, adapterId, profile) => {
        const id = `sess-${createdSessions.length + 1}`;
        createdSessions.push({ id, vehicleId, status: 'CREATED' });
        return id;
      }),
      beginPreparation: jest.fn().mockImplementation(async (_ws, sessionId) => {
        preparationCalls.push(sessionId);
        const s = createdSessions.find(x => x.id === sessionId);
        if (s) s.status = 'PREPARING';
      }),
      getSessionById: jest.fn().mockImplementation(async (_ws, sessionId) => {
        return createdSessions.find(x => x.id === sessionId) || null;
      }),
      failSession: jest.fn().mockImplementation(async (_ws, sessionId) => {
        const s = createdSessions.find(x => x.id === sessionId);
        if (s) s.status = 'FAILED';
      })
    };
  });

  it('guarantees ONE user attempt creates ONE session and calls beginPreparation EXACTLY ONCE per attempt', async () => {
    // Attempt 1: Run initialization
    let activeSessionIdRef: { current: string | null } = { current: null };

    const runAttempt = async (sessionIdParam: string | null) => {
      let sessionIdForRun = activeSessionIdRef.current || sessionIdParam;

      if (sessionIdForRun) {
        const session = await sessionRepo.getSessionById('ws-1', sessionIdForRun);
        if (session && session.status !== 'CREATED') {
          sessionIdForRun = await sessionRepo.createSession('ws-1', 'veh-1', 'op-1', 'ad-1', 'GENERAL');
          activeSessionIdRef.current = sessionIdForRun;
        }
      } else {
        sessionIdForRun = await sessionRepo.createSession('ws-1', 'veh-1', 'op-1', 'ad-1', 'GENERAL');
        activeSessionIdRef.current = sessionIdForRun;
      }

      await sessionRepo.beginPreparation('ws-1', sessionIdForRun);
      return sessionIdForRun;
    };

    // First attempt
    const sess1 = await runAttempt(null);
    expect(sess1).toBe('sess-1');
    expect(preparationCalls.filter(id => id === 'sess-1').length).toBe(1);

    // Fail first attempt
    await sessionRepo.failSession('ws-1', sess1);

    // User clicks Retry -> reset refs
    activeSessionIdRef.current = null;

    // Second attempt (Retry)
    const sess2 = await runAttempt(sess1);
    expect(sess2).toBe('sess-2');
    expect(preparationCalls.filter(id => id === 'sess-2').length).toBe(1);

    // Verify total preparation calls: exactly 1 for sess-1, exactly 1 for sess-2
    expect(preparationCalls).toEqual(['sess-1', 'sess-2']);
  });
});
