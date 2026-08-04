import { ObdFrame, DecodedValue } from './types';

export class ObdDecoder {

  public static decode(frames: ObdFrame[]): DecodedValue[] {
    const results: DecodedValue[] = [];

    // Only process VALID frames
    const validFrames = frames.filter(f => f.validity === 'VALID' && f.pid !== null);

    for (const frame of validFrames) {
      if (frame.service === '41' || frame.service === '01') {
        const decoded = this.decodeMode01(frame.pid!, frame.payloadBytes);
        if (decoded) {
          results.push(decoded);
        }
      }
    }

    return results;
  }

  private static decodeMode01(pid: string, bytes: number[]): DecodedValue | null {
    switch (pid) {
      case '00':
      case '20':
      case '40':
        // Bitmap PIDs
        if (bytes.length >= 4) {
          // Use binary string to avoid JS 32-bit signed integer bitwise bugs
          const hexStr = bytes.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
          const bitmapInt = parseInt(hexStr, 16);
          const binaryString = bitmapInt.toString(2).padStart(32, '0');

          const startPid = pid === '00' ? 0x01 : (pid === '20' ? 0x21 : 0x41);
          const supportedPids: string[] = [];

          for (let i = 0; i < 32; i++) {
            if (binaryString[i] === '1') {
              const pidNum = startPid + i;
              supportedPids.push('01' + pidNum.toString(16).padStart(2, '0').toUpperCase());
            }
          }
          return { type: 'BITMAP', value: supportedPids, unit: '' };
        }
        break;

      case '0C': // RPM
        if (bytes.length >= 2) {
          const rpm = ((bytes[0] * 256) + bytes[1]) / 4;
          return { type: 'RPM', value: rpm, unit: 'RPM' };
        }
        break;

      case '0D': // Speed
        if (bytes.length >= 1) {
          return { type: 'SPEED', value: bytes[0], unit: 'km/h' };
        }
        break;

      case '42': // Control Module Voltage
        if (bytes.length >= 2) {
          const voltage = ((bytes[0] * 256) + bytes[1]) / 1000;
          return { type: 'VOLTAGE', value: voltage, unit: 'V' };
        }
        break;

      case '05': // Coolant
        if (bytes.length >= 1) {
          return { type: 'COOLANT', value: bytes[0] - 40, unit: '°C' };
        }
        break;

      case '42': // Control Module Voltage
        if (bytes.length >= 2) {
          const voltage = ((bytes[0] * 256) + bytes[1]) / 1000;
          return { type: 'VOLTAGE', value: voltage, unit: 'V' };
        }
        break;
    }

    return null; // Unsupported or insufficient length
  }
}
