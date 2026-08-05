import { SystemIssueMapper } from '../SystemIssueMapper';

describe('SystemIssueMapper', () => {
  describe('fromCommandResult', () => {
    it('should map TIMEOUT to AP-TRN-002 with WARNING severity', () => {
      const issue = SystemIssueMapper.fromCommandResult('TIMEOUT');
      expect(issue).not.toBeNull();
      expect(issue?.code).toBe('AP-TRN-002');
      expect(issue?.severity).toBe('WARNING');
      expect(issue?.retryable).toBe(true);
    });

    it('should map DISCONNECTED to AP-TRN-001 with ERROR severity', () => {
      const issue = SystemIssueMapper.fromCommandResult('DISCONNECTED');
      expect(issue?.code).toBe('AP-TRN-001');
      expect(issue?.severity).toBe('ERROR');
      expect(issue?.retryable).toBe(true);
    });

    it('should map ELM_ERROR to AP-ELM-001 with ERROR severity', () => {
      const issue = SystemIssueMapper.fromCommandResult('ELM_ERROR');
      expect(issue?.code).toBe('AP-ELM-001');
      expect(issue?.retryable).toBe(false);
    });

    it('should map NO_DATA to AP-OBD-001 with INFO severity', () => {
      const issue = SystemIssueMapper.fromCommandResult('NO_DATA');
      expect(issue?.code).toBe('AP-OBD-001');
      expect(issue?.severity).toBe('INFO');
    });

    it('should map NEGATIVE_RESPONSE to AP-OBD-002 with WARNING severity', () => {
      const issue = SystemIssueMapper.fromCommandResult('NEGATIVE_RESPONSE');
      expect(issue?.code).toBe('AP-OBD-002');
      expect(issue?.severity).toBe('WARNING');
    });

    it('should return null for SUCCESS or unknown statuses', () => {
      expect(SystemIssueMapper.fromCommandResult('SUCCESS')).toBeNull();
      expect(SystemIssueMapper.fromCommandResult('UNKNOWN_STATUS')).toBeNull();
    });
  });

  describe('fromSessionFailure', () => {
    it('should map DISCONNECTED to AP-TRN-001', () => {
      const issue = SystemIssueMapper.fromSessionFailure('DISCONNECTED');
      expect(issue.code).toBe('AP-TRN-001');
      expect(issue.retryable).toBe(true);
    });

    it('should map CORRUPTED to AP-BLK-001', () => {
      const issue = SystemIssueMapper.fromSessionFailure('CORRUPTED');
      expect(issue.code).toBe('AP-BLK-001');
    });

    it('should map UNSUPPORTED_FORMAT to AP-BLK-002 with FATAL severity', () => {
      const issue = SystemIssueMapper.fromSessionFailure('UNSUPPORTED_FORMAT');
      expect(issue.code).toBe('AP-BLK-002');
      expect(issue.severity).toBe('FATAL');
    });

    it('should fallback to AP-LIV-002 for unmapped errors', () => {
      const issue = SystemIssueMapper.fromSessionFailure('UNKNOWN_CRASH');
      expect(issue.code).toBe('AP-LIV-002');
      expect(issue.severity).toBe('ERROR');
    });
  });
});
