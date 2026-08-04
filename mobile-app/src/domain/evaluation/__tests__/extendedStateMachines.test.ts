import { canTransitionReportDraft } from '../logic/reportDraftStateMachine';
import { canTransitionReportVersion } from '../logic/reportVersionStateMachine';
import { canTransitionTriageExecution } from '../logic/triageStateMachine';
import { ReportDraftState, ReportVersionState, TriageExecutionState } from '../models/enums';

describe('Extended State Machines', () => {
  describe('ReportDraft', () => {
    it('allows valid transitions', () => {
      expect(canTransitionReportDraft(ReportDraftState.DRAFT, ReportDraftState.IN_REVIEW).ok).toBe(true);
      expect(canTransitionReportDraft(ReportDraftState.IN_REVIEW, ReportDraftState.READY_FOR_SIGNATURE).ok).toBe(true);
      expect(canTransitionReportDraft(ReportDraftState.DRAFT, ReportDraftState.DISCARDED).ok).toBe(true);
    });

    it('rejects invalid transitions', () => {
      // Cannot reopen a discarded draft
      expect(canTransitionReportDraft(ReportDraftState.DISCARDED, ReportDraftState.DRAFT).ok).toBe(false);
    });
  });

  describe('ReportVersion', () => {
    it('allows valid transitions', () => {
      expect(canTransitionReportVersion(ReportVersionState.SIGNED, ReportVersionState.DELIVERED).ok).toBe(true);
      expect(canTransitionReportVersion(ReportVersionState.DELIVERED, ReportVersionState.SUPERSEDED).ok).toBe(true);
      expect(canTransitionReportVersion(ReportVersionState.SIGNED, ReportVersionState.VOID).ok).toBe(true);
    });

    it('rejects invalid transitions', () => {
      // Cannot transition from terminal states
      expect(canTransitionReportVersion(ReportVersionState.SUPERSEDED, ReportVersionState.DELIVERED).ok).toBe(false);
      expect(canTransitionReportVersion(ReportVersionState.VOID, ReportVersionState.SIGNED).ok).toBe(false);
    });
  });

  describe('TriageExecution', () => {
    it('allows valid transitions', () => {
      expect(canTransitionTriageExecution(TriageExecutionState.PENDING, TriageExecutionState.RUNNING).ok).toBe(true);
      expect(canTransitionTriageExecution(TriageExecutionState.RUNNING, TriageExecutionState.COMPLETED).ok).toBe(true);
      expect(canTransitionTriageExecution(TriageExecutionState.RUNNING, TriageExecutionState.FAILED).ok).toBe(true);
      expect(canTransitionTriageExecution(TriageExecutionState.COMPLETED, TriageExecutionState.SUPERSEDED).ok).toBe(true);
    });

    it('rejects invalid transitions', () => {
      // Cannot re-execute modifying the same execution
      expect(canTransitionTriageExecution(TriageExecutionState.COMPLETED, TriageExecutionState.RUNNING).ok).toBe(false);
      expect(canTransitionTriageExecution(TriageExecutionState.FAILED, TriageExecutionState.RUNNING).ok).toBe(false);
    });
  });
});
