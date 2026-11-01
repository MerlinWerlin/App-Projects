// T152 trip covers: own photo > bundled art > SVG fallback, the phone-only photo store, the art manifest, the redrawn
// SVG scenes and the UI wiring guards.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { COVER_ART, MAX_SHAPES, sceneShapes } from './coverArt.ts';
import { COVER_SCENES, tripCover } from './covers.ts';
import {
  cleanCoverPhotos,
  COVER_ART_BUDGET,
  COVER_ART_KEYS,
  COVER_PHOTO_ASPECT,
  COVER_PHOTO_KEY,
  coverArtFile,
  coverPhotoName,
  coverPhotosValue,
  isCoverPhotoPath,
  pickCoverArt,
  resolveCover,
  withCoverPhoto,
  withoutCoverPhoto,
  type CoverArtManifest,
} from './covers2.ts';
import { demoTrip } from './demo.ts';
import { ALL_PARTS, copyTrip } from './tripcopy.ts';
import { buildTripFile } from './tripfile.ts';
import { APP_FOLDERS, isAppFile } from './tickets.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DOC = 'file:///var/mobile/Containers/Data/Application/ABC/Documents/';
const PHOTO = `${DOC}covers/trip1-abc.jpg`;

test('photo cover wins over bundled art and the SVG scene', () => {
  const manifest: CoverArtManifest<string> = { 'city-day': 'city-day.webp', 'city-night': 'city-night.webp' };
  assert.deepEqual(resolveCover({ scene: 'city', dark: false, photo: PHOTO, manifest }), { kind: 'photo', uri: PHOTO });
  assert.deepEqual(resolveCover({ scene: 'city', dark: true, photo: PHOTO, manifest: {} }), { kind: 'photo', uri: PHOTO });
});

test('a missing photo file falls back silently: to art when bundled, else to the SVG scene', () => {
  const manifest: CoverArtManifest<string> = { 'coast-day': 'coast-day.webp' };
  assert.deepEqual(resolveCover({ scene: 'coast', dark: false, photo: PHOTO, photoMissing: true, manifest }), { kind: 'art', key: 'coast-day', source: 'coast-day.webp' });
  assert.deepEqual(resolveCover({ scene: 'island', dark: true, photo: PHOTO, photoMissing: true, manifest }), { kind: 'svg', scene: 'island', variant: 'night' });
  // no photo, or a path outside covers/ (never shown, never deleted)
  assert.equal(resolveCover({ scene: 'snow', dark: false, photo: null, manifest: {} }).kind, 'svg');
  assert.equal(resolveCover({ scene: 'snow', dark: false, photo: `${DOC}attachments/a1-pass.pdf`, manifest: {} }).kind, 'svg');
});

test('manifest: the theme variant first, then the other one; an absent image falls back to the SVG scene', () => {
  const both: CoverArtManifest<string> = { 'desert-day': 'D', 'desert-night': 'N' };
  assert.equal(pickCoverArt(both, 'desert', false)?.source, 'D');
  assert.equal(pickCoverArt(both, 'desert', true)?.source, 'N');
  assert.equal(pickCoverArt({ 'desert-day': 'D' }, 'desert', true)?.key, 'desert-day');
  assert.equal(pickCoverArt(both, 'mountains', false), null);
  for (const id of COVER_SCENES) for (const dark of [false, true]) assert.equal(resolveCover({ scene: id, dark, manifest: {} }).kind, 'svg');
});

test('manifest slots: 8 scenes x day / night, file names <scene>-<variant>.webp', () => {
  assert.equal(COVER_ART_KEYS.length, 16);
  assert.equal(new Set(COVER_ART_KEYS).size, 16);
  assert.equal(coverArtFile('oldtown-night'), 'oldtown-night.webp');
  for (const id of COVER_SCENES) for (const v of ['day', 'night']) assert.ok(COVER_ART_KEYS.includes(`${id}-${v}` as (typeof COVER_ART_KEYS)[number]));
});

test('bundled manifest: every require() points at an existing file under its own slot name, inside the budget', () => {
  // code lines only (the header comment shows an example line)
  const src = read('src/content/coverArt.ts')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  const entries = [...src.matchAll(/'([a-z]+-(?:day|night))':\s*require\('\.\.\/\.\.\/assets\/covers\/([^']+)'\)/g)];
  const requires = (src.match(/require\(/g) ?? []).length;
  assert.equal(entries.length, requires, 'every require is a slot entry');
  let bytes = 0;
  for (const [, key, file] of entries) {
    assert.ok((COVER_ART_KEYS as readonly string[]).includes(key), key);
    assert.equal(file, coverArtFile(key as (typeof COVER_ART_KEYS)[number]));
    const path = new URL(`../../assets/covers/${file}`, import.meta.url);
    assert.ok(existsSync(path), `assets/covers/${file} exists`);
    bytes += statSync(path).size;
  }
  assert.ok(bytes <= COVER_ART_BUDGET, `cover art ${bytes} bytes`);
  // and no stray images sit in assets/covers without a manifest line
  const listed = new Set(entries.map((e) => e[2]));
  for (const f of readdirSync(new URL('../../assets/covers/', import.meta.url))) if (/\.(webp|jpe?g|png)$/i.test(f)) assert.ok(listed.has(f), `${f} is in the manifest`);
  // only the manifest requires cover images
  assert.doesNotMatch(read('src/ui/TripCover.tsx'), /assets\/covers/);
});

test('photo store: cleaned on read, versioned, only covers/ paths for plain trip ids', () => {
  assert.equal(COVER_PHOTO_KEY, 'satchel.coverphoto.v1');
  assert.deepEqual(cleanCoverPhotos(null), {});
  assert.deepEqual(cleanCoverPhotos([1, 2]), {});
  assert.deepEqual(
    cleanCoverPhotos({ v: 1, photos: { t1: PHOTO, t2: 'covers/t2-x.jpg', bad: 42, 'x/../y': PHOTO, t3: `${DOC}vault/passport.jpg`, t4: `${DOC}covers/../vault/p.jpg` } }),
    { t1: PHOTO, t2: 'covers/t2-x.jpg' },
  );
  const one = withCoverPhoto({}, 't1', PHOTO);
  assert.deepEqual(one, { t1: PHOTO });
  assert.equal(withCoverPhoto(one, 't1', `${DOC}attachments/x.jpg`), one);
  assert.deepEqual(withoutCoverPhoto(one, 't1'), {});
  assert.equal(withoutCoverPhoto(one, 'nope'), one);
  assert.deepEqual(coverPhotosValue(one), { v: 1, photos: one });
  assert.deepEqual(cleanCoverPhotos(coverPhotosValue(one)), one);
});

test('photo files: covers/<tripId>-<stamp>.jpg, Satchel own files (rebased, delete-safe), 16:9 crop', () => {
  assert.match(coverPhotoName('trip_ab-1', 1700000000000), /^trip_ab-1-[0-9a-z]+\.jpg$/);
  assert.notEqual(coverPhotoName('t', 1), coverPhotoName('t', 2));
  assert.match(coverPhotoName('../evil', 5), /^[A-Za-z0-9_-]+-5\.jpg$/);
  assert.ok(APP_FOLDERS.includes('covers'));
  assert.ok(isAppFile(PHOTO, DOC));
  assert.ok(isCoverPhotoPath(PHOTO));
  assert.ok(!isCoverPhotoPath('file:///Users/me/Pictures/x.jpg'));
  assert.deepEqual(COVER_PHOTO_ASPECT, [16, 9]);
  const native = read('src/native/coverPhoto.ts');
  assert.match(native, /allowsEditing: true/);
  assert.match(native, /aspect: COVER_PHOTO_ASPECT/);
  assert.match(native, /quality: COVER_PHOTO_QUALITY/);
  assert.match(native, /copyIntoApp\([^)]*COVER_PHOTO_FOLDER/);
  // deletes only ever go through isCoverPhotoPath
  assert.match(native, /removeAppFiles\(uris\.filter\(\(u\): u is string => isCoverPhotoPath\(u\)\)\)/);
});

test('photo store stays on this phone: not on the Trip, not in a .satchel file, not copied by Plan this trip again', () => {
  // the key is declared once, in covers2.ts
  assert.equal((read('src/core/covers2.ts').match(/'satchel\.coverphoto\.v1'/g) ?? []).length, 1);
  for (const p of ['src/core/model.ts', 'src/core/tripfile.ts', 'src/core/tripcopy.ts', 'src/core/trips.ts', 'src/state/tripTransfer.ts', 'src/native/tripFile.ts'])
    assert.doesNotMatch(read(p), /coverphoto|COVER_PHOTO|coverPhotos|covers2/, p);
  // a trip file built from a trip never carries a cover photo path
  const trip = { ...demoTrip('2026-12-01'), id: 'trip1' };
  const { file } = buildTripFile(trip, {}, { now: '2026-11-01T00:00:00Z' });
  const text = JSON.stringify(file);
  assert.match(text, /"trip1"|Kyoto|Tokyo/);
  assert.doesNotMatch(text, /covers\/|coverphoto/);
  // a copy gets a new id, so the phone-only map (keyed by trip id) can never find a photo for it
  let n = 0;
  const copy = copyTrip(trip, null, { startDate: '2027-12-01', parts: ALL_PARTS, newId: (p: string) => `${p}-new${n++}`, now: '2026-11-01T00:00:00Z' });
  assert.ok(copy.trip.id !== trip.id);
  assert.doesNotMatch(JSON.stringify(copy.trip), /covers\//);
});

test('deleting a trip drops its cover photo record and file', () => {
  const trips = read('src/state/trips.tsx');
  assert.match(trips, /function cleanUpTrip[\s\S]*forgetCoverPhoto\(id\)/);
  const store = read('src/state/coverPhotos.ts');
  assert.match(store, /export function forgetCoverPhoto/);
  assert.match(store, /removeCoverPhotos\(\[old\]\)/);
});

test('the auto-pick rules are unchanged: the scene still comes from tripCover', () => {
  assert.equal(tripCover({ ...demoTrip('2026-12-01'), cover: 'snow' }), 'snow');
  assert.doesNotMatch(read('src/core/covers.ts'), /covers2|coverphoto/);
});

test('redrawn SVG scenes: 3-5 depth layers with haze between them, shading, clouds, stars at night', () => {
  for (const id of COVER_SCENES) {
    const all = COVER_ART[id].shapes;
    const hazes = all.filter((s) => s.k === 'haze');
    assert.ok(hazes.length >= 1 && hazes.length <= 3, `${id} haze bands`);
    for (const h of hazes) if (h.k === 'haze') assert.ok(h.y >= 0 && h.h > 0 && h.y + h.h <= 200, `${id} haze inside`);
    const layers = all.filter((s) => s.fill === 'far' || s.fill === 'mid' || (s.fill === 'near' && (s.o ?? 1) === 1));
    assert.ok(layers.length >= 3, `${id} depth layers ${layers.length}`);
    // something translucent in a darker paint: shade on the side away from the light
    assert.ok(all.some((s) => (s.fill === 'near' || s.fill === 'accent' || s.fill === 'detail') && (s.o ?? 1) < 0.4), `${id} shade`);
    for (const dark of [false, true]) assert.ok(sceneShapes(id, dark).length + 3 <= MAX_SHAPES, `${id} light`);
  }
});

test('renderer: layered glow, crescent moon, grain texture, bottom scrim, tokens only, timed fade', () => {
  const ui = read('src/ui/TripCover.tsx');
  for (const re of [/<Mask id=\{`moon/, /<Pattern id=\{`grain/, /foot\$\{uid\}/, /aura\$\{uid\}/, /k === 'haze'/, /resolveCover\(/, /markMissing/, /onError/])
    assert.match(ui, re);
  assert.doesNotMatch(ui, /spring|bounce/i);
  assert.match(ui, /fadeIn\(opacity, reduceMotion, duration\.slow\)/);
  // the hero and the Trips list card show the photo
  assert.match(read('app/trip/[id].tsx'), /<TripCoverHero scene=\{cover\} photo=\{coverPhoto\}/);
  assert.match(read('src/ui/TripPass.tsx'), /<TripCover scene=\{cover\} photo=\{photo\}/);
  assert.match(read('app/trip-edit.tsx'), /<CoverPhotoSection /);
});

test('strings: every cover2 key used in code exists, every catalogue key is used', async () => {
  const { covers2 } = await import('../i18n/en/covers2.ts');
  const keys = Object.keys(covers2);
  assert.ok(keys.every((k) => k.startsWith('cover2.')));
  const code = ['src/ui/CoverPhotoSection.tsx', 'src/ui/TripCover.tsx'].map(read).join('\n');
  for (const k of keys) {
    const used = code.includes(`'${k}'`) || (k.startsWith('cover2.photo.err.') && code.includes('cover2.photo.err.${'));
    assert.ok(used, `${k} used`);
  }
  for (const m of code.matchAll(/'(cover2\.[a-zA-Z.]+)'/g)) assert.ok(keys.includes(m[1]), `${m[1]} in catalogue`);
});
