// WAV (RIFF/WAVE) read and write for Backspin. Pure TypeScript, no globals, so Node tests run it.
// Reading walks every chunk (iOS AVAudioRecorder writes a 'FLLR' padding chunk before 'data'), accepts
// 8/16/24/32-bit integer PCM and 32-bit float, and mixes any number of channels down to mono.
// Writing always produces 16-bit mono PCM, which every phone and messaging app can play.

export type Pcm = { sampleRate: number; samples: Float32Array };

export class WavError extends Error {
  code: 'not_wav' | 'no_format' | 'no_data' | 'unsupported';
  constructor(code: 'not_wav' | 'no_format' | 'no_data' | 'unsupported', message: string) {
    super(message);
    this.code = code;
    this.name = 'WavError';
  }
}

const tag = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

export function parseWav(bytes: Uint8Array): Pcm {
  if (bytes.length < 12 || tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') {
    throw new WavError('not_wav', 'This recording is not a WAV file.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let dataStart = -1;
  let dataLen = 0;
  let o = 12;
  while (o + 8 <= bytes.length) {
    const id = tag(bytes, o);
    let size = view.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') {
      let format = view.getUint16(body, true);
      if (format === 0xfffe && size >= 26) format = view.getUint16(body + 24, true); // WAVE_FORMAT_EXTENSIBLE
      fmt = {
        format,
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      dataStart = body;
      // Some recorders leave the size at 0 or 0xFFFFFFFF while writing; use what is there.
      if (size === 0 || size === 0xffffffff || body + size > bytes.length) size = bytes.length - body;
      dataLen = size;
      break;
    }
    o = body + size + (size & 1);
  }
  if (!fmt) throw new WavError('no_format', 'The recording has no format chunk.');
  if (dataStart < 0) throw new WavError('no_data', 'The recording has no sound data.');
  const { format, channels, rate, bits } = fmt;
  if (channels < 1 || rate < 1000) throw new WavError('unsupported', 'Unusual WAV layout.');
  const isFloat = format === 3;
  if (!(format === 1 || isFloat) || !(bits === 8 || bits === 16 || bits === 24 || bits === 32)) {
    throw new WavError('unsupported', `Unsupported WAV encoding (format ${format}, ${bits}-bit).`);
  }
  const bps = bits / 8;
  const frames = Math.floor(dataLen / (bps * channels));
  const out = new Float32Array(frames);
  let p = dataStart;
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      let v: number;
      if (isFloat) v = view.getFloat32(p, true);
      else if (bits === 16) v = view.getInt16(p, true) / 32768;
      else if (bits === 8) v = (bytes[p] - 128) / 128;
      else if (bits === 24) {
        let x = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
        if (x & 0x800000) x |= ~0xffffff;
        v = x / 8388608;
      } else v = view.getInt32(p, true) / 2147483648;
      sum += v;
      p += bps;
    }
    out[i] = sum / channels;
  }
  return { sampleRate: rate, samples: out };
}

export function encodeWav(pcm: Pcm): Uint8Array {
  const n = pcm.samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const v = new DataView(bytes.buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) bytes[o + i] = s.charCodeAt(i);
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, pcm.sampleRate, true);
  v.setUint32(28, pcm.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm.samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
  }
  return bytes;
}

/** Seconds of audio. */
export const durationOf = (pcm: Pcm) => pcm.samples.length / pcm.sampleRate;
