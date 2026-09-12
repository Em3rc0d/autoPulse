export interface VehiclePhysicalEvidenceCase {
  readonly caseId: string;
  readonly vehicleLabel: string;
  readonly protocol: 'ISO_14230_KWP';
  readonly provenanceClass: 'USER_PHYSICAL_CAPTURE';
  readonly sourceAppSha: string;
  readonly raw: Readonly<Record<string, string>>;
  readonly expected: Readonly<Record<string, readonly string[] | string>>;
}

/**
 * User-captured physical evidence from CHECK v3. These cases are evidence
 * anchors, not universal compatibility claims and not independent lab certs.
 */
export const CHECK_PHYSICAL_EVIDENCE_CASES_V1: readonly VehiclePhysicalEvidenceCase[] = Object.freeze([
  Object.freeze({
    caseId: 'VEH-CASE-001-LOGAN',
    vehicleLabel: 'Renault Logan',
    protocol: 'ISO_14230_KWP' as const,
    provenanceClass: 'USER_PHYSICAL_CAPTURE' as const,
    sourceAppSha: 'ce62e57801acb45e74715f3b062a50dcf47dda6f',
    raw: Object.freeze({
      '0100': '410000000000',
      '03': '43000000000000',
      '07': '47000000000000',
      '0A': '7F0A11',
      '0105': '410544',
      '010C': '410C10B0',
      '010D': '410D00',
    }),
    expected: Object.freeze({
      capability: 'VALID_EMPTY_BITMAP',
      storedDtcs: Object.freeze([]),
      pendingDtcs: Object.freeze([]),
      permanent: 'NEGATIVE_RESPONSE_NRC_11',
      directObserved: Object.freeze(['0105','010C','010D']),
    }),
  }),
  Object.freeze({
    caseId: 'VEH-CASE-002-DUSTER',
    vehicleLabel: 'Renault Duster',
    protocol: 'ISO_14230_KWP' as const,
    provenanceClass: 'USER_PHYSICAL_CAPTURE' as const,
    sourceAppSha: 'ce62e57801acb45e74715f3b062a50dcf47dda6f',
    raw: Object.freeze({
      '0100': '41009E3EB810',
      '03': '43030100000000',
      '07': '47042003010000',
      '0A': 'NO DATA',
    }),
    expected: Object.freeze({
      advertised: Object.freeze(['0101','0104','0105','0106','0107','010B','010C','010D','010E','010F','0111','0113','0114','0115','011C']),
      storedDtcs: Object.freeze(['P0301']),
      pendingDtcs: Object.freeze(['P0420','P0301']),
      permanent: 'NO_DATA',
    }),
  }),
]);
