import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPOSITION_KINDS,
  CORNERS,
  DISPLAY_FONTS,
  FILL_ROLES,
  FRAME_KINDS,
  MAX_ART_PATHS,
  MAX_STICKERS,
  MOTIFS,
  MOTIF_IDS,
  TEXTURE_KINDS,
  TEXTURE_TINT,
  artBounds,
  compositionLayout,
  flattenPath,
  frameLayers,
  iconArtLayout,
  iconArtOf,
  isMotifId,
  moonPhasePath,
  parsePath,
  pathBounds,
  pathNumbers,
  placeMotif,
  sanitizeIconArt,
  sanitizeWallpaperArt,
  textureLayers,
  transformPath,
  wallpaperArtOf,
  type ArtColours,
  type ArtPath,
} from './artwork.ts';
import { contrastRatio, isHex, mix } from './colour.ts';
import { MIN_GLYPH_CONTRAST, resolveSpecs, type IconBackground } from './iconspec.ts';
import { ALL_THEMES, PLUS_THEMES } from './plusThemes.ts';
import { SHAPES } from './shapes.ts';
import { sanitizeStyle, DEFAULT_STYLE } from './studio.ts';
import { LEGACY_THEME_IDS, THEMES, getTheme, previewApps, previewSpecs } from './themes.ts';
import { averageColour } from './wallpaper.ts';

const COLOURS: ArtColours = { primary: '#E8475A', secondary: '#5FA35A', accent: '#F2B33D', ink: '#3A2020', light: '#FFFFFF' };
const COMPETITORS = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;
/** Franchise / character / brand words that must never name a theme or motif. */
const FRANCHISE = /shortcake|kitty|sanrio|disney|pok[eé]mon|ghibli|totoro|barbie|marvel|peanuts|snoopy|care bear|my melody|kuromi|cinnamoroll|sailor moon|starbucks|mcdonald|coca|nintendo|hogwarts/i;

function allFinite(paths: ArtPath[]): boolean {
  return paths.every(
    (p) =>
      pathNumbers(p.d).every(Number.isFinite) &&
      !/NaN|Infinity/.test(p.d) &&
      Number.isFinite(p.opacity) &&
      (p.strokeWidth === undefined || Number.isFinite(p.strokeWidth)),
  );
}

// ---------------------------------------------------------------- motif library

test('motif library: at least 20 original motifs, each valid and inside its 100-unit box', () => {
  assert.ok(MOTIF_IDS.length >= 20, `${MOTIF_IDS.length} motifs`);
  assert.equal(new Set(MOTIF_IDS).size, MOTIF_IDS.length);
  for (const id of MOTIF_IDS) {
    const m = MOTIFS[id];
    assert.equal(m.id, id);
    assert.ok(m.name.length > 0 && !FRANCHISE.test(m.name) && !COMPETITORS.test(m.name), id);
    assert.ok(m.layers.length >= 1 && m.layers.length <= 5, `${id}: 1-5 layers`);
    for (const l of m.layers) {
      assert.ok(FILL_ROLES.includes(l.role), `${id}: role ${l.role}`);
      assert.doesNotThrow(() => parsePath(l.d), id);
      assert.ok(pathNumbers(l.d).every(Number.isFinite), `${id}: finite numbers`);
      const b = pathBounds(l.d);
      assert.ok(b.minX >= -0.5 && b.minY >= -0.5 && b.maxX <= 100.5 && b.maxY <= 100.5, `${id}: bounds ${JSON.stringify(b)}`);
      if (l.opacity !== undefined) assert.ok(l.opacity > 0 && l.opacity <= 1, id);
    }
  }
  assert.ok(isMotifId('strawberry'));
  assert.ok(!isMotifId('mouse-ears'));
});

test('the requested motifs are all in the library', () => {
  for (const id of ['strawberry', 'cream', 'daisy', 'tulip', 'leaf-sprig', 'mushroom', 'moon', 'star', 'sparkle', 'planet', 'cloud', 'heart', 'bow', 'doily', 'shell', 'blossom', 'pumpkin', 'candy', 'teacup']) {
    assert.ok(isMotifId(id), id);
  }
});

test('transformPath: identity keeps geometry; translate/scale/rotate move bounds as expected', () => {
  const d = MOTIFS.heart.layers[0].d;
  const id = pathBounds(transformPath(d, { x: 50, y: 50, s: 1, rot: 0 }));
  const b = pathBounds(d);
  assert.ok(Math.abs(id.minX - b.minX) < 0.01 && Math.abs(id.maxY - b.maxY) < 0.01);
  const moved = pathBounds(transformPath(d, { x: 150, y: 250, s: 2, rot: 0 }));
  assert.ok(Math.abs(moved.minX - (150 + (b.minX - 50) * 2)) < 0.02);
  assert.ok(Math.abs(moved.maxY - (250 + (b.maxY - 50) * 2)) < 0.02);
  // Rotating a circle by any angle keeps its bounds.
  const c = MOTIFS.lollipop.layers[1].d;
  const r = pathBounds(transformPath(c, { x: 50, y: 50, s: 1, rot: 37 }));
  const r0 = pathBounds(transformPath(c, { x: 50, y: 50, s: 1, rot: 0 }));
  assert.ok(Math.abs(r.maxX - r.minX - (r0.maxX - r0.minX)) < 0.5);
  assert.throws(() => parsePath('m0 0l10 10'), /unsupported/);
});

test('placeMotif fills each layer with the theme colour for its role', () => {
  const paths = placeMotif('strawberry', COLOURS, 100, 100, 50, 15);
  assert.equal(paths.length, MOTIFS.strawberry.layers.length);
  assert.equal(paths[0].fill, COLOURS.primary);
  assert.ok(allFinite(paths));
  const b = artBounds(paths);
  assert.ok(b.minX > 70 && b.maxX < 130 && b.minY > 70 && b.maxY < 130);
});

test('moon phases are finite closed shapes', () => {
  for (let p = 0; p <= 1; p += 0.05) {
    const d = moonPhasePath(50, 50, 20, p);
    assert.ok(pathNumbers(d).every(Number.isFinite), String(p));
    const polys = flattenPath(d);
    assert.ok(polys.length >= 1);
  }
});

// ---------------------------------------------------------------- icon art

test('frames: every kind on every shape is finite, inside the icon and at most 3 paths', () => {
  for (const shape of SHAPES) {
    for (const kind of FRAME_KINDS) {
      const paths = frameLayers(kind, '#FFFFFF', shape, 180, 'camera');
      assert.ok(paths.length <= 3, `${kind}/${shape}`);
      assert.equal(paths.length === 0, kind === 'none');
      assert.ok(allFinite(paths), `${kind}/${shape}`);
      if (paths.length) {
        const b = artBounds(paths);
        // Scallops are centred on the edge: they may overhang by their radius, and the clip trims them.
        assert.ok(b.minX >= -20 && b.maxX <= 200 && b.minY >= -20 && b.maxY <= 200, `${kind}/${shape}`);
      }
    }
  }
});

test('textures: every kind is finite and at most 3 paths', () => {
  for (const kind of TEXTURE_KINDS) {
    const paths = textureLayers(kind, '#000000', 180, 7);
    assert.ok(paths.length <= 3, kind);
    assert.ok(allFinite(paths), kind);
    assert.deepEqual(textureLayers(kind, '#000000', 180, 7), paths, `${kind} deterministic`);
    assert.ok(TEXTURE_TINT[kind] >= 0 && TEXTURE_TINT[kind] < 0.35, kind);
  }
});

test('every theme icon: art stays small (≤ 40 paths, modest SVG) and finite at export sizes', () => {
  for (const t of ALL_THEMES) {
    const art = t.iconStyle.art;
    assert.ok(art, t.id);
    for (const shape of SHAPES) {
      for (const size of [60, 180, 360]) {
        const l = iconArtLayout(art, shape, size, 'messages');
        const all = [...l.texture, ...l.stickers, ...l.frame];
        assert.ok(all.length <= 40, `${t.id}/${shape}: ${all.length} paths`);
        assert.ok(allFinite(all), `${t.id}/${shape}/${size}`);
        const chars = all.reduce((n, p) => n + p.d.length, 0);
        assert.ok(chars < 40000, `${t.id}/${shape}/${size}: ${chars} chars of path data`);
      }
    }
  }
});

test('icon art is deterministic per app and stickers sit inside the icon', () => {
  const art = THEMES[0].iconStyle.art!;
  assert.deepEqual(iconArtLayout(art, 'squircle', 180, 'mail'), iconArtLayout(art, 'squircle', 180, 'mail'));
  for (const t of ALL_THEMES) {
    for (const shape of SHAPES) {
      const l = iconArtLayout(t.iconStyle.art!, shape, 180, 'maps');
      if (l.stickers.length === 0) continue;
      const b = artBounds(l.stickers);
      assert.ok(b.minX >= -2 && b.minY >= -2 && b.maxX <= 182 && b.maxY <= 182, `${t.id}/${shape}`);
    }
  }
});

// ---------------------------------------------------------------- wallpaper compositions

test('compositions: deterministic per seed, finite, inside the canvas and capped', () => {
  for (const t of ALL_THEMES) {
    const art = t.wallpaper.art;
    assert.ok(art, t.id);
    for (const [w, h] of [
      [390, 844],
      [1206, 2622],
      [200, 435],
    ]) {
      const a = compositionLayout(art, w, h, t.wallpaper.seed);
      const b = compositionLayout(art, w, h, t.wallpaper.seed);
      assert.deepEqual(a, b, `${t.id} deterministic`);
      assert.ok(a.length > 0 && a.length <= MAX_ART_PATHS, `${t.id}: ${a.length} paths`);
      assert.ok(allFinite(a), `${t.id} finite`);
      const bb = artBounds(a);
      const tol = 0.01 * w;
      assert.ok(bb.minX >= -tol && bb.minY >= -tol && bb.maxX <= w + tol && bb.maxY <= h + tol, `${t.id} ${w}x${h}: ${JSON.stringify(bb)}`);
      for (const p of a) assert.ok(p.fill === null || isHex(p.fill), t.id);
    }
  }
});

test('compositions scale with the canvas (preview matches the export) and vary with the seed', () => {
  for (const kind of COMPOSITION_KINDS) {
    if (kind === 'none') continue;
    const art = { colours: COLOURS, motifs: ['strawberry', 'cloud', 'star'] as const, composition: kind };
    const small = compositionLayout({ ...art, motifs: [...art.motifs] }, 300, 650, 11);
    const big = compositionLayout({ ...art, motifs: [...art.motifs] }, 600, 1300, 11);
    assert.equal(small.length, big.length, kind);
    const bs = artBounds(small);
    const bb = artBounds(big);
    assert.ok(Math.abs(bb.maxX - 2 * bs.maxX) < 2 && Math.abs(bb.maxY - 2 * bs.maxY) < 2, kind);
  }
  const art = { colours: COLOURS, motifs: ['daisy' as const], composition: 'scatter' as const };
  assert.notDeepEqual(compositionLayout(art, 390, 844, 1), compositionLayout(art, 390, 844, 2));
  assert.deepEqual(compositionLayout(null, 390, 844, 1), []);
  assert.deepEqual(compositionLayout({ ...art, composition: 'none' }, 390, 844, 1), []);
});

// ---------------------------------------------------------------- themes

const iconBg = (bg: IconBackground, wallpaperAvg: string): string[] =>
  bg.kind === 'solid' ? [bg.colour] : bg.kind === 'gradient' ? [bg.from, bg.to] : [bg.tint, mix(wallpaperAvg, bg.tint, bg.opacity)];

test('every theme has valid artwork whose halves travel in iconStyle and wallpaper', () => {
  for (const t of ALL_THEMES) {
    const a = t.art;
    for (const r of FILL_ROLES) assert.ok(isHex(a.colours[r]), `${t.id}.${r}`);
    assert.ok(a.motifs.length >= 1 && a.motifs.every(isMotifId), t.id);
    assert.ok(FRAME_KINDS.includes(a.frame) && FILL_ROLES.includes(a.frameRole), t.id);
    assert.ok(TEXTURE_KINDS.includes(a.texture) && FILL_ROLES.includes(a.textureRole), t.id);
    assert.ok(COMPOSITION_KINDS.includes(a.composition) && a.composition !== 'none', t.id);
    assert.ok(DISPLAY_FONTS.includes(a.displayFont), t.id);
    assert.ok(a.stickers.length <= MAX_STICKERS, t.id);
    for (const s of a.stickers) {
      assert.ok(isMotifId(s.motif) && CORNERS.includes(s.corner), t.id);
      assert.ok(s.scale >= 0.12 && s.scale <= 0.4 && Number.isFinite(s.rotation), t.id);
    }
    assert.deepEqual(t.iconStyle.art, iconArtOf(a), t.id);
    assert.deepEqual(t.wallpaper.art, wallpaperArtOf(a), t.id);
    assert.ok(!FRANCHISE.test(`${t.id} ${t.name} ${t.tagline}`), `${t.id}: no characters or brands`);
  }
});

test('no two themes share the same motif set, frame and composition', () => {
  const seen = new Map<string, string>();
  for (const t of ALL_THEMES) {
    const key = `${[...t.art.motifs].sort().join('+')}|${t.art.frame}|${t.art.composition}`;
    assert.ok(!seen.has(key), `${t.id} looks like ${seen.get(key)} (${key})`);
    seen.set(key, t.id);
  }
});

test('free themes are genuinely varied', () => {
  const free = THEMES;
  assert.ok(free.length >= 14);
  assert.ok(new Set(free.map((t) => t.art.composition)).size >= 9, 'compositions');
  assert.ok(new Set(free.map((t) => t.art.frame)).size >= 6, 'frames');
  assert.ok(new Set(free.map((t) => t.art.texture)).size >= 7, 'textures');
  assert.ok(new Set(free.map((t) => t.iconStyle.shape)).size >= 4, 'shapes');
  assert.ok(new Set(free.map((t) => t.art.displayFont)).size >= 4, 'display type');
  // Each free theme leads with its own hero motif.
  assert.equal(new Set(free.map((t) => t.art.motifs[0])).size, free.length, 'hero motifs');
  // Every motif in the library appears somewhere in the free themes or as a sticker.
  const used = new Set(free.flatMap((t) => [...t.art.motifs, ...t.art.stickers.map((s) => s.motif)]));
  assert.ok(used.size >= 20, `${used.size} motifs used`);
});

test('glyph contrast stays at least 3:1 over the background with its texture laid on top', () => {
  for (const t of ALL_THEMES) {
    const avg = averageColour(t.wallpaper);
    const art = t.art;
    const tex = art.colours[art.textureRole];
    for (const bg of iconBg(t.iconStyle.background, avg)) {
      const worst = mix(bg, tex, TEXTURE_TINT[art.texture]);
      for (const c of [bg, worst]) {
        const r = contrastRatio(t.iconStyle.glyphColour, c);
        assert.ok(r >= MIN_GLYPH_CONTRAST, `${t.id}: glyph ${t.iconStyle.glyphColour} on ${c} = ${r.toFixed(2)}`);
      }
    }
  }
});

test('retired starter ids still resolve to a new theme', () => {
  assert.equal(Object.keys(LEGACY_THEME_IDS).length, 12);
  for (const [old, now] of Object.entries(LEGACY_THEME_IDS)) {
    assert.equal(getTheme(old)?.id, now, old);
    assert.ok(!THEMES.some((t) => t.id === old), `${old} is retired`);
  }
});

test('theme art reaches every IconSpec; the manual Icon Studio style has none', () => {
  const t = getTheme('celestial-night')!;
  for (const s of previewSpecs(t)) assert.deepEqual(s.art, t.iconStyle.art);
  assert.equal(DEFAULT_STYLE.art, undefined);
  for (const s of resolveSpecs(previewApps(), DEFAULT_STYLE)) assert.equal(s.art, undefined);
});

test('art survives the Icon Studio state round trip and junk is dropped', () => {
  for (const t of [...THEMES, PLUS_THEMES[0]]) {
    assert.deepEqual(sanitizeStyle(JSON.parse(JSON.stringify(t.iconStyle))).art, t.iconStyle.art, t.id);
  }
  assert.equal(sanitizeIconArt(null), null);
  assert.equal(sanitizeIconArt({ colours: { primary: 'red' } }), null);
  const a = sanitizeIconArt({
    colours: COLOURS,
    frame: 'zigzag',
    texture: 'gingham',
    frameRole: 'nope',
    stickers: [{ motif: 'strawberry', corner: 'tl', scale: 9, rotation: 'x' }, { motif: 'logo', corner: 'tr' }, 5],
  })!;
  assert.equal(a.frame, 'none');
  assert.equal(a.texture, 'gingham');
  assert.equal(a.frameRole, 'accent');
  assert.deepEqual(a.stickers, [{ motif: 'strawberry', corner: 'tl', scale: 0.4, rotation: 0 }]);
  assert.equal(sanitizeWallpaperArt({ colours: COLOURS, motifs: ['nope'], composition: 'scatter' }), null);
  assert.deepEqual(sanitizeWallpaperArt({ colours: COLOURS, motifs: ['daisy', 'x'], composition: 'scatter' })?.motifs, ['daisy']);
});
