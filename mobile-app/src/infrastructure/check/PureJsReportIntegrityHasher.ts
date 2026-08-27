import { ReportIntegrityHasher } from '../../application/check/CheckReportIntegrity';
import { encodeUtf8 } from '../runtime/TextEncodingPolyfill';

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const INITIAL = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const;

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function add32(...values: number[]): number {
  let total = 0;
  for (const value of values) total = (total + value) >>> 0;
  return total;
}

export function sha256HexUtf8(payload: string): string {
  const input = encodeUtf8(payload);
  const bitLength = input.length * 8;
  const withMarker = input.length + 1;
  const paddedLength = Math.ceil((withMarker + 8) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const end = paddedLength - 8;
  bytes[end] = (high >>> 24) & 0xff;
  bytes[end + 1] = (high >>> 16) & 0xff;
  bytes[end + 2] = (high >>> 8) & 0xff;
  bytes[end + 3] = high & 0xff;
  bytes[end + 4] = (low >>> 24) & 0xff;
  bytes[end + 5] = (low >>> 16) & 0xff;
  bytes[end + 6] = (low >>> 8) & 0xff;
  bytes[end + 7] = low & 0xff;

  const hash = [...INITIAL];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const cursor = offset + index * 4;
      words[index] = (
        (bytes[cursor] << 24)
        | (bytes[cursor + 1] << 16)
        | (bytes[cursor + 2] << 8)
        | bytes[cursor + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const x = words[index - 15];
      const y = words[index - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      words[index] = add32(words[index - 16], s0, words[index - 7], s1);
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let index = 0; index < 64; index++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, choice, K[index], words[index]);
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, majority);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    hash[0] = add32(hash[0], a);
    hash[1] = add32(hash[1], b);
    hash[2] = add32(hash[2], c);
    hash[3] = add32(hash[3], d);
    hash[4] = add32(hash[4], e);
    hash[5] = add32(hash[5], f);
    hash[6] = add32(hash[6], g);
    hash[7] = add32(hash[7], h);
  }

  return hash.map(value => value.toString(16).padStart(8, '0')).join('');
}

export const pureJsReportIntegrityHasher: ReportIntegrityHasher = {
  sha256Hex: async (payload: string) => sha256HexUtf8(payload),
};
