import * as Crypto from 'expo-crypto';

export class ProductIdGenerator {
  private static lastTimestamp = 0;
  private static sequence = 0;

  static generate(): string {
    let currentMs = Date.now();

    // Handle clock going backwards
    if (currentMs < this.lastTimestamp) {
      currentMs = this.lastTimestamp;
    }

    if (currentMs === this.lastTimestamp) {
      this.sequence++;
      // Handle sequence overflow (12 bits max is 4095)
      if (this.sequence > 0xFFF) {
        currentMs++;
        this.sequence = 0;
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = currentMs;

    const randomBytes = Crypto.getRandomBytes(10);

    // unix_ts_ms: 48 bits (6 bytes)
    const timeHex = currentMs.toString(16).padStart(12, '0');

    // version and rand_a (16 bits / 2 bytes)
    // version is 7 (0111)
    const seqMasked = this.sequence & 0xFFF;
    const randAHex = ((0x7000) | seqMasked).toString(16).padStart(4, '0');

    // variant and rand_b (64 bits / 8 bytes)
    // variant is 10xx (8, 9, A, B)
    randomBytes[2] = (randomBytes[2] & 0x3F) | 0x80;

    const randBHex = Array.from(randomBytes.slice(2)).map((b: number) => b.toString(16).padStart(2, '0')).join('');

    return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-${randAHex}-${randBHex.slice(0, 4)}-${randBHex.slice(4)}`;
  }

  // Exposed for testing
  static resetForTesting() {
    this.lastTimestamp = 0;
    this.sequence = 0;
  }
}
