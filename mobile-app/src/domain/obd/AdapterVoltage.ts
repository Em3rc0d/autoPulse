export interface AdapterVoltageReading {
  readonly type: 'ADAPTER_VOLTAGE';
  readonly origin: 'ADAPTER';
  readonly value: number;
  readonly unit: 'V';
}

/**
 * Parses the ELM adapter-level ATRV response.
 *
 * This is intentionally outside the SAE J1979 Mode 01 catalog: ATRV reports
 * voltage measured by the adapter, while Mode 01 PID 42 reports ECU voltage.
 */
export function decodeAdapterVoltage(response: string): AdapterVoltageReading | null {
  const normalized = response
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.toUpperCase() !== 'ATRV' && line !== '>')
    .join('');

  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*V>?$/i);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value)
    ? { type: 'ADAPTER_VOLTAGE', origin: 'ADAPTER', value, unit: 'V' }
    : null;
}
