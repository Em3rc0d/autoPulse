function encodeUtf8(input: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i++) {
    let codePoint = input.charCodeAt(i);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        i++;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(
        0xc0 | (codePoint >> 6),
        0x80 | (codePoint & 0x3f),
      );
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return Uint8Array.from(bytes);
}

function decodeUtf8(input: Uint8Array): string {
  let output = '';

  for (let i = 0; i < input.length;) {
    const first = input[i++];

    if (first <= 0x7f) {
      output += String.fromCharCode(first);
      continue;
    }

    let codePoint = 0xfffd;
    let needed = 0;
    let minCodePoint = 0;

    if ((first & 0xe0) === 0xc0) {
      codePoint = first & 0x1f;
      needed = 1;
      minCodePoint = 0x80;
    } else if ((first & 0xf0) === 0xe0) {
      codePoint = first & 0x0f;
      needed = 2;
      minCodePoint = 0x800;
    } else if ((first & 0xf8) === 0xf0) {
      codePoint = first & 0x07;
      needed = 3;
      minCodePoint = 0x10000;
    } else {
      output += '\ufffd';
      continue;
    }

    if (i + needed > input.length) {
      output += '\ufffd';
      break;
    }

    let valid = true;
    for (let j = 0; j < needed; j++) {
      const next = input[i + j];
      if ((next & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }

    if (!valid) {
      output += '\ufffd';
      continue;
    }

    i += needed;

    if (
      codePoint < minCodePoint ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      output += '\ufffd';
      continue;
    }

    if (codePoint <= 0xffff) {
      output += String.fromCharCode(codePoint);
    } else {
      const adjusted = codePoint - 0x10000;
      output += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff),
      );
    }
  }

  return output;
}

class PortableTextEncoder {
  readonly encoding = 'utf-8';

  encode(input: string = ''): Uint8Array {
    return encodeUtf8(String(input));
  }

  encodeInto(source: string, destination: Uint8Array): { read: number; written: number } {
    const encoded = this.encode(source);
    const written = Math.min(encoded.length, destination.length);
    destination.set(encoded.subarray(0, written));

    // AutoPulse only needs encode(); keep encodeInto conservative when a caller
    // provides a destination too small for the full UTF-8 payload.
    return {
      read: written === encoded.length ? source.length : 0,
      written,
    };
  }
}

class PortableTextDecoder {
  readonly encoding = 'utf-8';
  readonly fatal = false;
  readonly ignoreBOM = false;

  decode(input?: ArrayBuffer | ArrayBufferView | null): string {
    if (input == null) return '';

    if (input instanceof ArrayBuffer) {
      return decodeUtf8(new Uint8Array(input));
    }

    return decodeUtf8(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
  }
}

/**
 * Hermes versions used by the Android runtime can expose TextEncoder without
 * TextDecoder. Telemetry persistence must not depend on browser-only globals,
 * so install tiny UTF-8-compatible fallbacks only when the runtime is missing
 * the native implementation.
 */
export function installTextEncodingPolyfill(): void {
  const runtime = globalThis as any;

  if (typeof runtime.TextEncoder !== 'function') {
    runtime.TextEncoder = PortableTextEncoder;
  }

  if (typeof runtime.TextDecoder !== 'function') {
    runtime.TextDecoder = PortableTextDecoder;
  }
}

installTextEncodingPolyfill();

export { encodeUtf8, decodeUtf8 };
