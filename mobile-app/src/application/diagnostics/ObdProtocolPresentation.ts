export interface ObdProtocolPresentation {
  label: string;
  detail?: string;
  resolved: boolean;
}

const PROTOCOLS: Record<string, string> = {
  '1': 'SAE J1850 PWM',
  '2': 'SAE J1850 VPW',
  '3': 'ISO 9141-2',
  '4': 'ISO 14230-4 KWP · 5 baud init',
  '5': 'ISO 14230-4 KWP · fast init',
  '6': 'ISO 15765-4 CAN · 11-bit · 500 kbit/s',
  '7': 'ISO 15765-4 CAN · 29-bit · 500 kbit/s',
  '8': 'ISO 15765-4 CAN · 11-bit · 250 kbit/s',
  '9': 'ISO 15765-4 CAN · 29-bit · 250 kbit/s',
  A: 'SAE J1939 CAN',
  B: 'User protocol 1',
  C: 'User protocol 2',
};

const INTERNAL_PROTOCOLS: Record<string, string> = {
  ISO_15765_4_CAN_11_500: 'ISO 15765-4 CAN · 11-bit · 500 kbit/s',
  ISO_15765_4_CAN_29_500: 'ISO 15765-4 CAN · 29-bit · 500 kbit/s',
  ISO_15765_4_CAN_11_250: 'ISO 15765-4 CAN · 11-bit · 250 kbit/s',
  ISO_15765_4_CAN_29_250: 'ISO 15765-4 CAN · 29-bit · 250 kbit/s',
  ISO_9141_2: 'ISO 9141-2',
  ISO_14230_4_KWP_FAST: 'ISO 14230-4 KWP · fast init',
  ISO_14230_4_KWP_5_BAUD: 'ISO 14230-4 KWP · 5 baud init',
  SAE_J1850_PWM: 'SAE J1850 PWM',
  SAE_J1850_VPW: 'SAE J1850 VPW',
};

export function presentObdProtocol(rawProtocol?: string | null): ObdProtocolPresentation {
  const normalized = rawProtocol?.replace(/>/g, '').trim();

  if (!normalized || normalized.toUpperCase() === 'UNKNOWN') {
    return { label: 'Not identified', resolved: false };
  }

  const upper = normalized.toUpperCase();
  const internal = INTERNAL_PROTOCOLS[upper];
  if (internal) {
    return { label: internal, resolved: true };
  }

  if (upper === '0' || upper === 'A0') {
    return {
      label: 'Automatic detection',
      detail: 'Resolved vehicle protocol was not captured.',
      resolved: false,
    };
  }

  const automatic = /^A[1-9A-C]$/.test(upper);
  const code = automatic ? upper.slice(1) : upper;
  const mapped = PROTOCOLS[code];

  if (mapped) {
    return {
      label: mapped,
      detail: automatic ? 'Auto-detected by adapter.' : undefined,
      resolved: true,
    };
  }

  // ATDP commonly returns a human-readable protocol description. Preserve it
  // rather than replacing evidence with an inferred code.
  if (/[A-Z]/.test(upper) && upper.length > 2) {
    return { label: normalized, resolved: true };
  }

  return {
    label: normalized,
    detail: 'Protocol evidence was captured but is not recognized by this release.',
    resolved: false,
  };
}

export function presentSourceEcu(ecuAddress?: number | null): string {
  if (ecuAddress === null || ecuAddress === undefined || ecuAddress < 0) {
    return 'Not identified';
  }
  return ecuAddress.toString(16).toUpperCase();
}
