export function encodeUtf8(str: string): Uint8Array {
  let bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      bytes.push(charcode);
    } else if (charcode < 0x800) {
      bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      // surrogate pair
      i++;
      let nextChar = i < str.length ? str.charCodeAt(i) : 0;
      if (charcode >= 0xd800 && charcode <= 0xdbff && nextChar >= 0xdc00 && nextChar <= 0xdfff) {
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (nextChar & 0x3ff));
        bytes.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
        i--;
      }
    }
  }
  return new Uint8Array(bytes);
}

export function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    let c = bytes[i++];
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c >= 0xc2 && c < 0xe0) {
      if (i >= len) { out += "\uFFFD"; break; }
      let c2 = bytes[i++];
      if ((c2 & 0xc0) !== 0x80) { out += "\uFFFD"; i--; continue; }
      out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
    } else if (c >= 0xe0 && c < 0xf0) {
      if (i + 1 >= len) { out += "\uFFFD"; break; }
      let c2 = bytes[i++];
      if ((c2 & 0xc0) !== 0x80) { out += "\uFFFD"; i--; continue; }
      let c3 = bytes[i++];
      if ((c3 & 0xc0) !== 0x80) { out += "\uFFFD"; i-=2; continue; }
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    } else if (c >= 0xf0 && c < 0xf5) {
      if (i + 2 >= len) { out += "\uFFFD"; break; }
      let c2 = bytes[i++];
      if ((c2 & 0xc0) !== 0x80) { out += "\uFFFD"; i--; continue; }
      let c3 = bytes[i++];
      if ((c3 & 0xc0) !== 0x80) { out += "\uFFFD"; i-=2; continue; }
      let c4 = bytes[i++];
      if ((c4 & 0xc0) !== 0x80) { out += "\uFFFD"; i-=3; continue; }
      let u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    } else {
      out += "\uFFFD";
    }
  }
  return out;
}
