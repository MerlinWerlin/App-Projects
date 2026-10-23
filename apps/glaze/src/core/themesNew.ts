// T46 (owner request 16 Oct 2026, R6): 12 new original themes across the browse categories.
// NEW_FREE_THEMES (4) ship in the app bundle; NEW_PLUS_THEMES (8) belong to the downloadable
// theme pack `pack-aurora-2026` (see docs/THEME_PACKS.md). Three are tagged 'halloween' for the
// seasonal collection (src/core/seasons.ts matches collection ids against theme tags).
// All art is Glaze's own vector motifs (src/core/artwork.ts): anime-STYLE energy (speed lines,
// sparkly eyes, petals), never characters, franchises or brands.
// Pure TS. Imports only types from themes.ts (themes.ts imports this file, so no runtime cycle).

import { iconArtOf, wallpaperArtOf, type ThemeArt } from './artwork.ts';
import type { IconBackground, IconShape } from './iconspec.ts';
import type { Theme, ThemeCategoryId } from './themes.ts';
import type { WallpaperParams } from './wallpaper.ts';

/** Pack that carries the eight new Plus themes. */
export const AURORA_PACK_ID = 'pack-aurora-2026';
export const NEW_THEMES_ADDED_AT = '2026-10-16';

type Def = {
  id: string;
  name: string;
  tagline: string;
  /** bg, surface, accent, ink, glyph */
  palette: [string, string, string, string, string];
  shape: IconShape;
  background: IconBackground;
  glyphSet: 'feather' | 'glaze';
  glyphScale?: number;
  wallpaper: WallpaperParams;
  widget: Theme['widget'];
  art: ThemeArt;
  categories: ThemeCategoryId[];
  tags: string[];
};

function make(d: Def, plus: boolean): Theme {
  const [bg, surface, accent, ink, glyph] = d.palette;
  const t: Theme = {
    id: d.id,
    name: d.name,
    tagline: d.tagline,
    palette: { bg, surface, accent, ink, glyph },
    iconStyle: {
      shape: d.shape,
      background: d.background,
      glyphColour: glyph,
      glyphSet: d.glyphSet,
      showLabel: true,
      glyphScale: d.glyphScale ?? 0.46,
      art: iconArtOf(d.art),
    },
    wallpaper: { ...d.wallpaper, art: wallpaperArtOf(d.art) },
    widget: d.widget,
    plus,
    art: d.art,
    categories: Object.freeze([...d.categories]),
    tags: Object.freeze([...d.tags]),
    addedAt: NEW_THEMES_ADDED_AT,
  };
  if (plus) t.packId = AURORA_PACK_ID;
  return t;
}

// ------------------------------------------------------------ free (bundled)

export const NEW_FREE_THEMES: readonly Theme[] = Object.freeze([
  make(
    {
      id: 'still-water',
      name: 'Still Water',
      tagline: 'One drop, soft grey-blue and a lot of calm.',
      palette: ['#F2F5F7', '#FFFFFF', '#4D7A93', '#1C2A33', '#FFFFFF'],
      shape: 'square',
      background: { kind: 'solid', colour: '#46728A' },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#F2F5F7', '#DDE7EE', '#C4D5E1'], seed: 4601, angle: 180, grain: 0.05 },
      widget: { style: 'outline', font: 'body', accent: '#4D7A93' },
      art: {
        colours: { primary: '#9CC3D9', secondary: '#4D7A93', accent: '#7FB2CF', ink: '#1C2A33', light: '#FFFFFF' },
        motifs: ['droplet', 'sparkle'],
        frame: 'none',
        frameRole: 'light',
        texture: 'none',
        textureRole: 'ink',
        stickers: [{ motif: 'droplet', corner: 'br', scale: 0.2, rotation: 0 }],
        composition: 'tiled',
        displayFont: 'mono',
      },
      categories: ['minimal', 'nature', 'pastel'],
      tags: ['calm', 'water', 'rain', 'blue', 'minimal'],
    },
    false,
  ),
  make(
    {
      id: 'sakura-sprint',
      name: 'Sakura Sprint',
      tagline: 'Speed lines, petals and a big finish.',
      palette: ['#FFF1F6', '#FFFFFF', '#E0457B', '#3A1426', '#FFFFFF'],
      shape: 'squircle',
      background: { kind: 'gradient', from: '#D63A71', to: '#B8285E', angle: 160 },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#FFE3EE', '#FFF6FA', '#FFD0E0', '#E8E6FF'], seed: 4602, angle: 160, grain: 0.06 },
      widget: { style: 'glass', font: 'display', accent: '#E0457B' },
      art: {
        colours: { primary: '#F7A1C0', secondary: '#E0457B', accent: '#FFD36E', ink: '#3A1426', light: '#FFFFFF' },
        motifs: ['speed-lines', 'petal', 'sparkle'],
        frame: 'ribbon',
        frameRole: 'light',
        texture: 'speckle',
        textureRole: 'ink',
        stickers: [{ motif: 'petal', corner: 'tr', scale: 0.24, rotation: -20 }],
        composition: 'petals',
        displayFont: 'display',
      },
      categories: ['anime', 'pastel', 'cute'],
      tags: ['anime', 'manga', 'sakura', 'petals', 'pink', 'spring'],
    },
    false,
  ),
  make(
    {
      id: 'little-ghosts',
      name: 'Little Ghosts',
      tagline: 'Friendly ghosts drifting past a purple moon.',
      palette: ['#1D1530', '#2C2147', '#B59CFF', '#F3EEFF', '#2C2147'],
      shape: 'circle',
      background: { kind: 'solid', colour: '#EDE6FF' },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#1D1530', '#3A2A66', '#5B3F8F', '#140F24'], seed: 4603, angle: 190, grain: 0.12 },
      widget: { style: 'glass', font: 'body', accent: '#B59CFF' },
      art: {
        colours: { primary: '#B59CFF', secondary: '#6E58B8', accent: '#FFB25B', ink: '#1D1530', light: '#FFFFFF' },
        motifs: ['ghost', 'moon', 'star'],
        frame: 'scalloped',
        frameRole: 'accent',
        texture: 'polka',
        textureRole: 'light',
        stickers: [{ motif: 'ghost', corner: 'br', scale: 0.3, rotation: -8 }],
        composition: 'sky',
        displayFont: 'rounded',
      },
      categories: ['seasonal', 'cute', 'dark'],
      tags: ['halloween', 'ghost', 'spooky', 'october', 'purple', 'cute'],
    },
    false,
  ),
  make(
    {
      id: 'night-drive',
      name: 'Night Drive',
      tagline: 'A neon sunset grid and a bolt of electric pink.',
      palette: ['#120A24', '#21123D', '#FF4FB8', '#FBEFFF', '#120A24'],
      shape: 'rounded',
      background: { kind: 'gradient', from: '#FF4FB8', to: '#FF8A3D', angle: 180 },
      glyphSet: 'glaze',
      wallpaper: { kind: 'pattern', pattern: 'grid', colours: ['#120A24', '#2A1150', '#FF4FB8'], seed: 4604, angle: 180 },
      widget: { style: 'outline', font: 'display', accent: '#FF4FB8' },
      art: {
        colours: { primary: '#FF4FB8', secondary: '#7A3CFF', accent: '#FFD23F', ink: '#120A24', light: '#FFF4FF' },
        motifs: ['sun', 'lightning', 'star'],
        frame: 'double',
        frameRole: 'secondary',
        texture: 'stripes',
        textureRole: 'light',
        stickers: [{ motif: 'lightning', corner: 'tr', scale: 0.26, rotation: 12 }],
        composition: 'ground',
        displayFont: 'display',
      },
      categories: ['neon', 'retro', 'dark'],
      tags: ['neon', 'synth', '80s', 'sunset', 'grid', 'retro'],
    },
    false,
  ),
]);

// ------------------------------------------------------------ Plus (pack-aurora-2026)

export const NEW_PLUS_THEMES: readonly Theme[] = Object.freeze([
  make(
    {
      id: 'starry-gaze',
      name: 'Starry Gaze',
      tagline: 'Sparkling eyes, twinkles and cotton-candy skies.',
      palette: ['#F4EEFF', '#FFFFFF', '#7A4FE0', '#24163F', '#FFFFFF'],
      shape: 'blob',
      background: { kind: 'gradient', from: '#7A4FE0', to: '#5A34B8', angle: 150 },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#E9DEFF', '#FFE3F3', '#DDF0FF', '#F4EEFF'], seed: 4611, angle: 150, grain: 0.06 },
      widget: { style: 'glass', font: 'display', accent: '#7A4FE0' },
      art: {
        colours: { primary: '#9E7BFF', secondary: '#F49AC8', accent: '#FFE07A', ink: '#24163F', light: '#FFFFFF' },
        motifs: ['starry-eye', 'sparkle', 'heart'],
        frame: 'lace',
        frameRole: 'light',
        texture: 'starfield',
        textureRole: 'ink',
        stickers: [{ motif: 'sparkle', corner: 'tl', scale: 0.2, rotation: 0 }],
        composition: 'scatter',
        displayFont: 'rounded',
      },
      categories: ['anime', 'cute', 'pastel'],
      tags: ['anime', 'kawaii', 'sparkle', 'eyes', 'purple'],
    },
    true,
  ),
  make(
    {
      id: 'moonlit-bats',
      name: 'Moonlit Bats',
      tagline: 'Bats wheeling past an orange harvest moon.',
      palette: ['#140E0A', '#241912', '#FF9A3C', '#FFF0E0', '#FFE2C2'],
      shape: 'squircle',
      background: { kind: 'gradient', from: '#3A2618', to: '#1C120C', angle: 170 },
      glyphSet: 'glaze',
      wallpaper: { kind: 'grain', colours: ['#140E0A', '#3A1F12', '#7A3A16'], seed: 4612, angle: 180, grain: 0.35 },
      widget: { style: 'solid', font: 'display', accent: '#FF9A3C' },
      art: {
        colours: { primary: '#FF9A3C', secondary: '#5A3A28', accent: '#FFD08A', ink: '#140E0A', light: '#FFF0E0' },
        motifs: ['bat', 'moon', 'star'],
        frame: 'stitched',
        frameRole: 'accent',
        texture: 'speckle',
        textureRole: 'ink',
        stickers: [{ motif: 'bat', corner: 'tr', scale: 0.3, rotation: -10 }],
        composition: 'sky',
        displayFont: 'serif',
      },
      categories: ['seasonal', 'dark'],
      tags: ['halloween', 'bats', 'moon', 'october', 'spooky'],
    },
    true,
  ),
  make(
    {
      id: 'lantern-hollow',
      name: 'Lantern Hollow',
      tagline: 'Glowing pumpkins and shy ghosts in the hollow.',
      palette: ['#1A1206', '#2B1E0C', '#F2A33A', '#FFF3DC', '#2B1806'],
      shape: 'rounded',
      background: { kind: 'solid', colour: '#F2A33A' },
      glyphSet: 'glaze',
      wallpaper: { kind: 'mesh', colours: ['#1A1206', '#4A2A0C', '#8A4A12', '#20160A'], seed: 4613, angle: 180, grain: 0.2 },
      widget: { style: 'glass', font: 'body', accent: '#F2A33A' },
      art: {
        colours: { primary: '#F2A33A', secondary: '#5E6B2A', accent: '#FFD27A', ink: '#1A1206', light: '#FFF3DC' },
        motifs: ['pumpkin', 'ghost', 'leaf'],
        frame: 'scalloped',
        frameRole: 'ink',
        texture: 'linen',
        textureRole: 'light',
        stickers: [
          { motif: 'pumpkin', corner: 'br', scale: 0.3, rotation: 0 },
          { motif: 'ghost', corner: 'tl', scale: 0.2, rotation: -10 },
        ],
        composition: 'ground',
        displayFont: 'display',
      },
      categories: ['seasonal', 'nature', 'cute'],
      tags: ['halloween', 'pumpkin', 'ghost', 'autumn', 'october'],
    },
    true,
  ),
  make(
    {
      id: 'gilded-noir',
      name: 'Gilded Noir',
      tagline: 'Cut gems and fine gold lines on velvet black.',
      palette: ['#0D0C0E', '#1A181C', '#D9B26A', '#F6EFE2', '#D9B26A'],
      shape: 'squircle',
      background: { kind: 'solid', colour: '#1A181C' },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#0D0C0E', '#1F1B22', '#2E2630'], seed: 4614, angle: 170, grain: 0.25 },
      widget: { style: 'outline', font: 'display', accent: '#D9B26A' },
      art: {
        colours: { primary: '#D9B26A', secondary: '#6E5A86', accent: '#F2DCA8', ink: '#0D0C0E', light: '#FFF8EA' },
        motifs: ['gem', 'sparkle', 'star'],
        frame: 'double',
        frameRole: 'primary',
        texture: 'linen',
        textureRole: 'ink',
        stickers: [{ motif: 'gem', corner: 'tr', scale: 0.24, rotation: 0 }],
        composition: 'corners',
        displayFont: 'serif',
      },
      categories: ['luxury', 'dark', 'minimal'],
      tags: ['gold', 'luxury', 'gem', 'black', 'elegant'],
    },
    true,
  ),
  make(
    {
      id: 'aurora-veil',
      name: 'Aurora Veil',
      tagline: 'Green-violet ribbons over a snowy ridge.',
      palette: ['#07141A', '#0F2229', '#5CF2B5', '#E6FFF6', '#07141A'],
      shape: 'circle',
      background: { kind: 'gradient', from: '#5CF2B5', to: '#3FB8E8', angle: 160 },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#07141A', '#0F4A44', '#2E8F7A', '#4A2A7A'], seed: 4615, angle: 200, grain: 0.1 },
      widget: { style: 'glass', font: 'body', accent: '#5CF2B5' },
      art: {
        colours: { primary: '#5CF2B5', secondary: '#8A6CFF', accent: '#B8FFE4', ink: '#07141A', light: '#F2FFFA' },
        motifs: ['star', 'snowflake', 'moon'],
        frame: 'none',
        frameRole: 'light',
        texture: 'wash',
        textureRole: 'light',
        stickers: [{ motif: 'star', corner: 'tr', scale: 0.2, rotation: 0 }],
        composition: 'sky',
        displayFont: 'rounded',
      },
      categories: ['nature', 'dark', 'neon'],
      tags: ['aurora', 'northern lights', 'night', 'green', 'winter'],
    },
    true,
  ),
  make(
    {
      id: 'pocket-arcade',
      name: 'Pocket Arcade',
      tagline: 'Chunky bolts, hearts and a high-score glow.',
      palette: ['#0E1030', '#1A1D4A', '#3DF2E0', '#EFFFFD', '#0E1030'],
      shape: 'square',
      background: { kind: 'solid', colour: '#3DF2E0' },
      glyphSet: 'glaze',
      wallpaper: { kind: 'pattern', pattern: 'grid', colours: ['#0E1030', '#1E2366', '#3DF2E0'], seed: 4616, angle: 180 },
      widget: { style: 'solid', font: 'display', accent: '#FF5FA2' },
      art: {
        colours: { primary: '#3DF2E0', secondary: '#FF5FA2', accent: '#FFE14D', ink: '#0E1030', light: '#FFFFFF' },
        motifs: ['lightning', 'heart', 'star'],
        frame: 'stitched',
        frameRole: 'secondary',
        texture: 'gingham',
        textureRole: 'light',
        stickers: [{ motif: 'heart', corner: 'tr', scale: 0.24, rotation: 0 }],
        composition: 'tiled',
        displayFont: 'mono',
      },
      categories: ['retro', 'neon', 'cute'],
      tags: ['arcade', 'pixel', 'retro', 'games', 'neon'],
    },
    true,
  ),
  make(
    {
      id: 'macaron-box',
      name: 'Macaron Box',
      tagline: 'Pistachio, rose and lemon in a ribboned box.',
      palette: ['#FFF7F2', '#FFFFFF', '#C24F78', '#3B1E2A', '#FFFFFF'],
      shape: 'circle',
      background: { kind: 'solid', colour: '#B8466F' },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#FFE6EC', '#E6F5DC', '#FFF6CC', '#FFF7F2'], seed: 4617, angle: 160, grain: 0.06 },
      widget: { style: 'solid', font: 'body', accent: '#C24F78' },
      art: {
        colours: { primary: '#F2A7BE', secondary: '#A8D8A0', accent: '#FFE58A', ink: '#3B1E2A', light: '#FFFFFF' },
        motifs: ['candy', 'bow', 'heart'],
        frame: 'ribbon',
        frameRole: 'accent',
        texture: 'polka',
        textureRole: 'ink',
        stickers: [{ motif: 'bow', corner: 'tl', scale: 0.26, rotation: -10 }],
        composition: 'picnic',
        displayFont: 'script',
      },
      categories: ['cute', 'pastel', 'luxury'],
      tags: ['macaron', 'dessert', 'pastel', 'sweet', 'bakery'],
    },
    true,
  ),
  make(
    {
      id: 'first-frost',
      name: 'First Frost',
      tagline: 'Snowflakes settling on a pale winter morning.',
      palette: ['#EEF4FA', '#FFFFFF', '#3E6E9E', '#14243A', '#FFFFFF'],
      shape: 'rounded',
      background: { kind: 'gradient', from: '#3E6E9E', to: '#2C5480', angle: 180 },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#DCE9F6', '#EEF4FA', '#FFFFFF'], seed: 4618, angle: 180, grain: 0.05 },
      widget: { style: 'outline', font: 'body', accent: '#3E6E9E' },
      art: {
        colours: { primary: '#9EC3E6', secondary: '#3E6E9E', accent: '#E8C77A', ink: '#14243A', light: '#FFFFFF' },
        motifs: ['snowflake', 'sparkle', 'star'],
        frame: 'lace',
        frameRole: 'light',
        texture: 'speckle',
        textureRole: 'ink',
        stickers: [{ motif: 'snowflake', corner: 'tr', scale: 0.26, rotation: 15 }],
        composition: 'scatter',
        displayFont: 'serif',
      },
      categories: ['seasonal', 'minimal', 'nature'],
      tags: ['winter', 'christmas', 'snow', 'frost', 'december'],
    },
    true,
  ),
]);

/** Every theme added in T46, free first. */
export const NEW_THEMES: readonly Theme[] = Object.freeze([...NEW_FREE_THEMES, ...NEW_PLUS_THEMES]);
