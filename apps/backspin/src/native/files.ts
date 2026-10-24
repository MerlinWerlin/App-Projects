// The only module that imports expo-file-system. Reads a recording, writes processed WAVs, keeps saved takes
// in the app's Documents folder (never uploaded), and cleans up the scratch files of each round.
import * as FS from 'expo-file-system/legacy';
import { decodeBase64, encodeBase64 } from '../core/base64.ts';
import { encodeWav, parseWav, type Pcm } from '../core/wav.ts';

const ROOT = `${FS.documentDirectory ?? ''}takes/`;
const SCRATCH = `${FS.cacheDirectory ?? ''}round/`;

async function ensureDir(d: string) {
  const info = await FS.getInfoAsync(d);
  if (!info.exists) await FS.makeDirectoryAsync(d, { intermediates: true });
}

export async function readPcm(uri: string): Promise<Pcm> {
  const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  return parseWav(decodeBase64(b64));
}

let n = 0;
/** Writes PCM as a WAV in the round's scratch folder and returns its file uri. */
export async function writeScratch(pcm: Pcm, name: string): Promise<string> {
  await ensureDir(SCRATCH);
  const uri = `${SCRATCH}${name}-${Date.now().toString(36)}-${n++}.wav`;
  await FS.writeAsStringAsync(uri, encodeBase64(encodeWav(pcm)), { encoding: FS.EncodingType.Base64 });
  return uri;
}

export async function clearScratch(): Promise<void> {
  try {
    await FS.deleteAsync(SCRATCH, { idempotent: true });
  } catch {
    // fine
  }
}

/** Copies the round's two takes into a saved take folder. */
export async function saveTakeFiles(id: string, originalUri: string, copyUri: string): Promise<{ original: string; copy: string }> {
  const dir = `${ROOT}${id}/`;
  await ensureDir(dir);
  const original = `${dir}original.wav`;
  const copy = `${dir}copy.wav`;
  await FS.copyAsync({ from: originalUri, to: original });
  await FS.copyAsync({ from: copyUri, to: copy });
  return { original, copy };
}

export async function deleteTakeFiles(id: string): Promise<void> {
  try {
    await FS.deleteAsync(`${ROOT}${id}/`, { idempotent: true });
  } catch {
    // already gone
  }
}

/** File name the share sheet shows. */
export async function writeShareFile(pcm: Pcm, label: string): Promise<string> {
  await ensureDir(SCRATCH);
  const safe = label.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 40) || 'Backspin';
  const uri = `${SCRATCH}${safe}.wav`;
  await FS.writeAsStringAsync(uri, encodeBase64(encodeWav(pcm)), { encoding: FS.EncodingType.Base64 });
  return uri;
}
