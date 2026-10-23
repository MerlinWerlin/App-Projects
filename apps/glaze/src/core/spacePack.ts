// The free Space collection (T103, owner feedback 22 Oct 2026, G5a): eight themes whose wallpaper
// is a real James Webb Space Telescope image from an official ESA/Webb release (CC BY 4.0).
// The manifest ships in the app; each photo is downloaded only when the person taps Download
// (src/core/photoPack.ts). Until then the theme shows its generated deep-space wallpaper.
// Credits are copied exactly as the release pages state them (checked 2026-10-22) and must not
// be edited. The same manifest is written to packs/space-webb/manifest.json by
// `node ops/build-photo-pack.ts` (a test fails if it is stale). Sources: docs/THEME_PACKS.md.
// Icons, widgets and the fallback art are Glaze's own (generic stars, sparkles, planets).

import type { ThemeArt } from './artwork.ts';
import type { IconBackground, IconShape } from './iconspec.ts';
import { PHOTO_LICENCES, PHOTO_PACK_FORMAT, PHOTO_PACK_VERSION, photoThemeFromData, type PhotoPackManifest, type PhotoSource, type PhotoTheme, type PhotoThemeData } from './photoPack.ts';
import type { ThemeCategoryId, WidgetStyle } from './themes.ts';

export const SPACE_PACK_ID = 'space-webb';
export const SPACE_ADDED_AT = '2026-10-22';
export const SPACE_CHECKED_AT = '2026-10-22';
export const SPACE_MANIFEST_PATH = 'packs/space-webb/manifest.json';

const CC_BY = { licence: 'CC-BY-4.0' as const, licenceUrl: PHOTO_LICENCES['CC-BY-4.0'].url };

type Def = {
  id: string;
  name: string;
  tagline: string;
  /** bg, surface, accent, ink, glyph */
  palette: [string, string, string, string, string];
  shape: IconShape;
  background: IconBackground;
  /** Fallback wallpaper colours (deep space) shown until the photo is downloaded. */
  colours: string[];
  widget: WidgetStyle;
  /** primary, secondary, accent (ink and light are shared). */
  art: [string, string, string];
  motifs: ThemeArt['motifs'];
  sticker: ThemeArt['stickers'][number]['motif'];
  tags: string[];
  categories?: ThemeCategoryId[];
  photo: Omit<PhotoSource, 'licence' | 'licenceUrl' | 'checkedAt'>;
  seed: number;
};

function data(d: Def): PhotoThemeData {
  const [bg, surface, accent, ink, glyph] = d.palette;
  const [primary, secondary, art] = d.art;
  return {
    id: d.id,
    name: d.name,
    tagline: d.tagline,
    palette: { bg, surface, accent, ink, glyph },
    iconStyle: { shape: d.shape, background: d.background, glyphColour: glyph, glyphSet: 'feather', showLabel: true, glyphScale: 0.44 },
    wallpaper: { kind: 'mesh', colours: d.colours, seed: d.seed, angle: 170, grain: 0.08 },
    widget: d.widget,
    plus: false,
    packId: SPACE_PACK_ID,
    art: {
      colours: { primary, secondary, accent: art, ink: '#0B0A1F', light: '#FFF8E7' },
      motifs: d.motifs,
      frame: 'none',
      frameRole: 'light',
      texture: 'starfield',
      textureRole: 'light',
      stickers: [{ motif: d.sticker, corner: 'tr', scale: 0.2, rotation: 0 }],
      composition: 'sky',
      displayFont: 'display',
    },
    categories: d.categories ?? ['dark', 'nature'],
    tags: ['space', 'webb', 'jwst', 'telescope', 'astronomy', 'stars', 'photo', 'free', ...d.tags],
    addedAt: SPACE_ADDED_AT,
    photo: { ...d.photo, ...CC_BY, checkedAt: SPACE_CHECKED_AT },
  };
}

const DEFS: Def[] = [
  {
    id: 'space-pillars',
    name: 'Pillars of Creation',
    tagline: 'Towers of gas and newborn stars, seen by Webb.',
    palette: ['#0B0A1F', '#1A1638', '#F2B45C', '#FFF4E0', '#FFE7B8'],
    shape: 'squircle',
    background: { kind: 'glass', tint: '#1A1438', opacity: 0.55 },
    colours: ['#0B0A1F', '#3A1E3F', '#8A4B2E', '#1D2350'],
    widget: { style: 'glass', font: 'display', accent: '#F2B45C' },
    art: ['#F2B45C', '#7C5CFF', '#FFD98A'],
    motifs: ['star', 'sparkle'],
    sticker: 'sparkle',
    tags: ['nebula', 'pillars', 'eagle nebula', 'gold', 'navy'],
    seed: 10301,
    photo: {
      title: 'Webb Takes a Stunning, Star-Filled Portrait of the Pillars of Creation (Full View)',
      releaseId: 'weic2216b',
      pageUrl: 'https://esawebb.org/images/weic2216b/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2216b.jpg',
      credit: 'NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI).',
      approxBytes: 4_200_000,
    },
  },
  {
    id: 'space-cosmic-cliffs',
    name: 'Cosmic Cliffs',
    tagline: 'The glowing edge of a star-forming region in Carina.',
    palette: ['#0A0E24', '#18203F', '#F0A35E', '#FDF1E2', '#FFE2C0'],
    shape: 'rounded',
    background: { kind: 'glass', tint: '#14193A', opacity: 0.55 },
    colours: ['#0A0E24', '#23305E', '#7A4A3A', '#C98A55'],
    widget: { style: 'glass', font: 'display', accent: '#F0A35E' },
    art: ['#F0A35E', '#5C7CFF', '#FFD5A1'],
    motifs: ['star', 'sparkle', 'cloud'],
    sticker: 'star',
    tags: ['nebula', 'carina', 'cliffs', 'amber', 'blue'],
    seed: 10302,
    photo: {
      title: 'NIRCam Image of the "Cosmic Cliffs" in Carina',
      releaseId: 'weic2205a',
      pageUrl: 'https://esawebb.org/images/weic2205a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2205a.jpg',
      credit: 'NASA, ESA, CSA, and STScI',
      approxBytes: 2_300_000,
    },
  },
  {
    id: 'space-tarantula',
    name: 'Tarantula Nebula',
    tagline: 'A cavern of young stars in violet and rose.',
    palette: ['#120A26', '#231544', '#C78BFF', '#F7EEFF', '#F1DDFF'],
    shape: 'circle',
    background: { kind: 'glass', tint: '#24124A', opacity: 0.55 },
    colours: ['#120A26', '#3B1D63', '#8E3C7A', '#2A1F5C'],
    widget: { style: 'glass', font: 'display', accent: '#C78BFF' },
    art: ['#C78BFF', '#FF8FB8', '#FFE08A'],
    motifs: ['star', 'sparkle'],
    sticker: 'sparkle',
    tags: ['nebula', 'tarantula', 'violet', 'purple', 'pink'],
    seed: 10303,
    photo: {
      title: 'Tarantula Nebula (NIRCam Image)',
      releaseId: 'weic2212a',
      pageUrl: 'https://esawebb.org/images/weic2212a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2212a.jpg',
      credit: 'NASA, ESA, CSA, and STScI',
      approxBytes: 2_700_000,
    },
  },
  {
    id: 'space-cas-a',
    name: 'Cassiopeia A',
    tagline: 'The bright shell of an exploded star.',
    palette: ['#0C0B1C', '#1C1A36', '#FF9E6B', '#FFF0E6', '#FFD8C2'],
    shape: 'squircle',
    background: { kind: 'glass', tint: '#1E1534', opacity: 0.55 },
    colours: ['#0C0B1C', '#4A1F38', '#B8573C', '#3B3A7A'],
    widget: { style: 'glass', font: 'display', accent: '#FF9E6B' },
    art: ['#FF9E6B', '#9C7CFF', '#FFE6A3'],
    motifs: ['star', 'sparkle'],
    sticker: 'star',
    tags: ['supernova', 'cassiopeia', 'orange', 'remnant'],
    seed: 10304,
    photo: {
      title: 'Cas A (NIRCam image)',
      releaseId: 'weic2330a',
      pageUrl: 'https://esawebb.org/images/weic2330a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2330a.jpg',
      credit: 'NASA, ESA, CSA, STScI, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (University of Gent)',
      approxBytes: 3_400_000,
    },
  },
  {
    id: 'space-cas-a-infrared',
    name: 'Infrared Remnant',
    tagline: 'Cassiopeia A in mid-infrared: ember red and teal.',
    palette: ['#0D0A18', '#1F1730', '#FF6F61', '#FFEDEA', '#FFD3CC'],
    shape: 'rounded',
    background: { kind: 'glass', tint: '#24142E', opacity: 0.55 },
    colours: ['#0D0A18', '#4D1626', '#A33A2E', '#1E4F5C'],
    widget: { style: 'glass', font: 'body', accent: '#FF6F61' },
    art: ['#FF6F61', '#4FD1C5', '#FFC48A'],
    motifs: ['star', 'sparkle'],
    sticker: 'sparkle',
    tags: ['supernova', 'cassiopeia', 'infrared', 'red', 'teal'],
    seed: 10305,
    photo: {
      title: 'Cassiopeia A (MIRI Image)',
      releaseId: 'weic2311a',
      pageUrl: 'https://esawebb.org/images/weic2311a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2311a.jpg',
      credit: 'NASA, ESA, CSA, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (UGent), J. DePasquale (STScI)',
      approxBytes: 2_200_000,
    },
  },
  {
    id: 'space-rho-ophiuchi',
    name: 'Rho Ophiuchi',
    tagline: 'The closest star nursery to us, in Webb’s first-year portrait.',
    palette: ['#0A0C1E', '#191D3A', '#FFC861', '#FFF7E3', '#FFEBB5'],
    shape: 'squircle',
    background: { kind: 'glass', tint: '#141A3A', opacity: 0.55 },
    colours: ['#0A0C1E', '#2B2551', '#6B4A2E', '#B07A3E'],
    widget: { style: 'glass', font: 'display', accent: '#FFC861' },
    art: ['#FFC861', '#6F8CFF', '#FFE9A8'],
    motifs: ['star', 'sparkle', 'cloud'],
    sticker: 'star',
    tags: ['nebula', 'ophiuchus', 'nursery', 'gold', 'anniversary'],
    seed: 10306,
    photo: {
      title: 'Rho Ophiuchi cloud complex',
      releaseId: 'weic2316a',
      pageUrl: 'https://esawebb.org/images/weic2316a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2316a.jpg',
      credit: 'NASA, ESA, CSA, STScI, K. Pontoppidan (STScI), A. Pagan (STScI)',
      approxBytes: 2_000_000,
    },
  },
  {
    id: 'space-cartwheel',
    name: 'Cartwheel Galaxy',
    tagline: 'A galaxy ring half a billion light-years away.',
    palette: ['#070A1A', '#141A33', '#7FB8FF', '#EEF5FF', '#D8E8FF'],
    shape: 'circle',
    background: { kind: 'glass', tint: '#101834', opacity: 0.55 },
    colours: ['#070A1A', '#18264F', '#5A2E5E', '#B06A3A'],
    widget: { style: 'glass', font: 'display', accent: '#7FB8FF' },
    art: ['#7FB8FF', '#FF9F7A', '#FFE3A0'],
    motifs: ['star', 'sparkle', 'planet'],
    sticker: 'planet',
    tags: ['galaxy', 'cartwheel', 'blue', 'ring'],
    categories: ['dark'],
    seed: 10307,
    photo: {
      title: 'Cartwheel Galaxy (NIRCam and MIRI Composite Image)',
      releaseId: 'weic2211a',
      pageUrl: 'https://esawebb.org/images/weic2211a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/publicationjpg/weic2211a.jpg',
      credit: 'NASA, ESA, CSA, STScI',
      approxBytes: 4_000_000,
    },
  },
  {
    id: 'space-pillars-infrared',
    name: 'Ghostly Pillars',
    tagline: 'The Pillars of Creation in dusky mid-infrared.',
    palette: ['#0E0B1A', '#1E1A30', '#D9B99B', '#F6EFE8', '#EDE0D2'],
    shape: 'square',
    background: { kind: 'glass', tint: '#1E1A30', opacity: 0.6 },
    colours: ['#0E0B1A', '#2A2338', '#5E4A4A', '#2F3B52'],
    widget: { style: 'outline', font: 'body', accent: '#D9B99B' },
    art: ['#D9B99B', '#8E9CC8', '#F4E1C1'],
    motifs: ['star', 'moon'],
    sticker: 'moon',
    tags: ['nebula', 'pillars', 'infrared', 'grey', 'moody'],
    categories: ['dark', 'minimal'],
    seed: 10308,
    photo: {
      title: 'Pillars of Creation (MIRI Image)',
      releaseId: 'weic2218a',
      pageUrl: 'https://esawebb.org/images/weic2218a/',
      imageUrl: 'https://cdn.esawebb.org/archives/images/large/weic2218a.jpg',
      credit: 'NASA, ESA, CSA, STScI, J. DePasquale (STScI), A. Pagan (STScI)',
      approxBytes: 586_000,
    },
  },
];

/** The Space pack manifest (bundled; also written to SPACE_MANIFEST_PATH). */
export const SPACE_PACK_MANIFEST: PhotoPackManifest = Object.freeze({
  format: PHOTO_PACK_FORMAT,
  version: PHOTO_PACK_VERSION,
  kind: 'photo',
  id: SPACE_PACK_ID,
  name: 'Space',
  plus: false,
  minAppVersion: '0.1.0',
  themes: DEFS.map(data),
}) as PhotoPackManifest;

/** The eight free Space themes, ready for the gallery (wallpaper photo downloads on demand). */
export const SPACE_THEMES: readonly PhotoTheme[] = Object.freeze(SPACE_PACK_MANIFEST.themes.map(photoThemeFromData));

export function spaceThemeById(id: string): PhotoTheme | undefined {
  return SPACE_THEMES.find((t) => t.id === id);
}
