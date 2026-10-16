declare module 'expo-crypto' {
  export function getRandomBytes(size: number): Uint8Array;
  export function randomUUID(): string;
  export enum CryptoDigestAlgorithm { SHA256 = 'SHA-256' }
  export function digestStringAsync(algorithm: CryptoDigestAlgorithm, data: string): Promise<string>;
}
