// Collage photo copies + saved draft on this device (T97, oversight D82-1).
// The picker's files live in a temporary cache iOS may purge, so picked photos are copied into
// <documents>/collage/ and the draft (photos, layout, spacing, background) is kept in
// AsyncStorage so the collage reopens and can be edited later. Planning, parsing and restore
// rules live in src/core/collageStore.ts (tested). Nothing leaves the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from '../native/fs';
import {
  COLLAGE_DRAFT_KEY,
  applyCopies,
  collageDir,
  parseCollageDraft,
  planCollageCopies,
  restoreCollageDraft,
  serializeCollageDraft,
  staleCollageCopies,
  type CollageDraft,
  type CollagePhotoRef,
} from '../core/collageStore';

function dir(): string | null {
  return collageDir(FileSystem.documentDirectory);
}

/** Copy picked photos into app storage; a photo whose copy fails keeps its original URI. */
export async function keepCollageCopies(photos: readonly CollagePhotoRef[]): Promise<CollagePhotoRef[]> {
  const d = dir();
  if (!d) return photos.map((p) => ({ ...p }));
  try {
    await FileSystem.makeDirectoryAsync(d, { intermediates: true });
  } catch {
    // Already exists, or unavailable: the copies below fail individually and fall back.
  }
  const plan = planCollageCopies(photos, d, String(Date.now()));
  const copied: (string | null)[] = [];
  for (const step of plan) {
    if (!step.to || step.to === step.from) {
      copied.push(step.to);
      continue;
    }
    try {
      await FileSystem.copyAsync({ from: step.from, to: step.to });
      copied.push(step.to);
    } catch {
      copied.push(null);
    }
  }
  return applyCopies(photos, copied);
}

/** Delete copies in the collage folder that `keep` no longer uses (best effort). */
export async function pruneCollageCopies(keep: readonly CollagePhotoRef[]): Promise<void> {
  const d = dir();
  if (!d) return;
  try {
    const names = await FileSystem.readDirectoryAsync(d);
    for (const n of staleCollageCopies(names, d, keep)) {
      await FileSystem.deleteAsync(`${d}${n}`, { idempotent: true });
    }
  } catch {
    // Folder missing or unreadable: nothing to prune.
  }
}

export async function saveCollageDraft(draft: CollageDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(COLLAGE_DRAFT_KEY, serializeCollageDraft(draft));
  } catch {
    // Best effort: the collage itself is unaffected.
  }
}

/** The saved draft with only photos whose files still exist, or null. */
export async function loadCollageDraft(): Promise<{ draft: CollageDraft; missing: number } | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(COLLAGE_DRAFT_KEY);
  } catch {
    return null;
  }
  const saved = parseCollageDraft(raw);
  if (!saved) return null;
  const d = dir();
  const present = new Set<string>();
  for (const p of saved.photos) {
    const candidates = [p.uri];
    if (d) {
      const m = /\/collage\/([^/]+)$/.exec(p.uri);
      if (m) candidates.push(`${d}${m[1]}`);
    }
    for (const uri of candidates) {
      try {
        if ((await FileSystem.getInfoAsync(uri)).exists) present.add(uri);
      } catch {
        // Treat as missing.
      }
    }
  }
  const res = restoreCollageDraft(saved, d, (uri) => present.has(uri));
  return res.draft ? { draft: res.draft, missing: res.missing } : null;
}
