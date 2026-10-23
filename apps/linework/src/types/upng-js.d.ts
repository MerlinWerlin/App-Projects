// Minimal types for upng-js (CommonJS, ships no types). Only what outlineDeps.ts uses.
declare module 'upng-js' {
  const UPNG: {
    /** Encode RGBA frames to PNG. cnum 0 = lossless (no palette quantisation). */
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
  };
  export default UPNG;
}
