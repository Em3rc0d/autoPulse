type TextEncodingGlobal = typeof globalThis & {
  TextEncoder?: new () => { encode(input?: string): Uint8Array };
  TextDecoder?: new () => { decode(input?: ArrayBuffer | ArrayBufferView): string };
};

function pushCodePointUtf8(bytes: number[], codePoint: number) {
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

export function encodeUtf8(input = ''): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < input.length; index++) {
    let codePoint = input.charCodeAt(index);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < input.length) {
      const low = input.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        index++;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    pushCodePointUtf8(bytes, codePoint);
  }

  return Uint8Array.from(bytes);
}

export function decodeUtf8(input: ArrayBuffer | ArrayBufferView | undefined): string {
  if (!input) return '';

  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  let result = '';
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index++];
    let codePoint = 0xfffd;
    let extraBytes = 0;

    if (first <= 0x7f) {
      codePoint = first;
    } else if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      extraBytes = 1;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      extraBytes = 2;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      extraBytes = 3;
    } else {
      result += '\ufffd';
      continue;
    }

    if (index + extraBytes > bytes.length) {
      result += '\ufffd';
      break;
    }

    let valid = true;
    for (let offset = 0; offset < extraBytes; offset++) {
      const next = bytes[index + offset];
      if ((next & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }

    if (!valid) {
      result += '\ufffd';
      continue;
    }

    index += extraBytes;

    const overlong = (extraBytes === 1 && codePoint < 0x80)
      || (extraBytes === 2 && codePoint < 0x800)
      || (extraBytes === 3 && codePoint < 0x10000);
    const invalidScalar = codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff);

    if (overlong || invalidScalar) {
      result += '\ufffd';
    } else if (codePoint <= 0xffff) {
      result += String.fromCharCode(codePoint);
    } else {
      const adjusted = codePoint - 0x10000;
      result += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff),
      );
    }
  }

  return result;
}

class AutoPulseTextEncoder {
  readonly encoding = 'utf-8';

  encode(input = ''): Uint8Array {
    return encodeUtf8(input);
  }
}

class AutoPulseTextDecoder {
  readonly encoding = 'utf-8';
  readonly fatal = false;
  readonly ignoreBOM = false;

  decode(input?: ArrayBuffer | ArrayBufferView): string {
    return decodeUtf8(input);
  }
}

export function installTextEncodingPolyfill(target: TextEncodingGlobal = globalThis as TextEncodingGlobal) {
  if (typeof target.TextEncoder !== 'function') {
    target.TextEncoder = AutoPulseTextEncoder;
  }
  if (typeof target.TextDecoder !== 'function') {
    target.TextDecoder = AutoPulseTextDecoder;
  }
}

installTextEncodingPolyfill();
