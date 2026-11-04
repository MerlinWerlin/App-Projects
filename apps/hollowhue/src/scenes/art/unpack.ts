import { gunzipSync, strFromU8 } from 'fflate';

// Pure JS so existing TestFlight binaries can receive the illustrated catalogue over the air.
// Avoid a platform-specific Buffer/atob requirement on Hermes.
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const sextets = new Uint8Array(128);
for (let i = 0; i < alphabet.length; i++) sextets[alphabet.charCodeAt(i)] = i;

export function unpackArt<T>(encoded: string): T {
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(encoded.length / 4 * 3 - padding);
  let at = 0;
  for (let i = 0; i < encoded.length; i += 4) {
    const bits = (sextets[encoded.charCodeAt(i)]! << 18) | (sextets[encoded.charCodeAt(i + 1)]! << 12)
      | (sextets[encoded.charCodeAt(i + 2)]! << 6) | sextets[encoded.charCodeAt(i + 3)]!;
    bytes[at++] = bits >>> 16;
    if (at < bytes.length) bytes[at++] = bits >>> 8;
    if (at < bytes.length) bytes[at++] = bits;
  }
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}
