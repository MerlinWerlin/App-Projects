// Write the Space (Webb) photo-pack manifest (T103, docs/THEME_PACKS.md).
//
//   node ops/build-photo-pack.ts      # writes packs/space-webb/manifest.json from src/core/spacePack.ts
//
// Only the manifest is written: the photos are never downloaded into the repo or bundled. Each one
// is fetched on the phone from its official host when the person taps Download. Pure Node.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parsePhotoPackManifest } from '../src/core/photoPack.ts';
import { SPACE_MANIFEST_PATH, SPACE_PACK_MANIFEST } from '../src/core/spacePack.ts';

const check = parsePhotoPackManifest(JSON.parse(JSON.stringify(SPACE_PACK_MANIFEST)));
if (!check.ok) throw new Error(`Space manifest is invalid: ${check.errors.join('; ')}`);
const out = resolve(SPACE_MANIFEST_PATH);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(SPACE_PACK_MANIFEST, null, 2)}\n`);
console.log(`wrote ${SPACE_MANIFEST_PATH} (${SPACE_PACK_MANIFEST.themes.length} themes)`);
