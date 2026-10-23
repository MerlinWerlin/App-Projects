// Glaze Plus theme packs: 24 more original themes in three packs of eight, each with its own
// artwork (motifs, frame, texture, composition) from src/core/artwork.ts.
// Data only; whether a person owns Plus is decided in src/plus (never here).
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import type { CompositionKind, Corner, DisplayFont, FillRole, FrameKind, MotifId, TextureKind, ThemeArt } from './artwork.ts';
import { contrastRatio, mix } from './colour.ts';
import type { IconBackground, IconShape } from './iconspec.ts';
import { FIRST_CATALOGUE_DATE, THEMES, getTheme, withArt, type Theme, type ThemeCategoryId } from './themes.ts';
import type { WallpaperParams } from './wallpaper.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';
import { spaceThemeById } from './spacePack.ts';
import { STORYPLAY_PACK_ID, STORYPLAY_PACK_NAME, STORYPLAY_PLUS_THEMES } from './themesStoryPlay.ts';

export type PlusPack = {
  id: string;
  name: string;
  tagline: string;
  themes: readonly Theme[];
};

type Spec = {
  id: string;
  name: string;
  tagline: string;
  /** Browse categories (at least one) and lower-case search tags (R4). */
  categories: readonly ThemeCategoryId[];
  tags: readonly string[];
  /** ISO date added; defaults to the launch catalogue date. */
  addedAt?: string;
  /** bg, surface, accent, ink, glyph */
  palette: [string, string, string, string, string];
  shape: IconShape;
  background: IconBackground;
  glyphSet: 'feather' | 'glaze';
  showLabel?: boolean;
  glyphScale?: number;
  wallpaper: WallpaperParams;
  widget: Theme['widget'];
};

/** Artwork per Plus theme: [motifs, frame, texture, texture colour, sticker, composition, display type]. */
type ArtRow = [MotifId[], FrameKind, TextureKind, FillRole, [MotifId, Corner, number, number] | null, CompositionKind, DisplayFont];

const PLUS_ART: Record<string, ArtRow> = {
  // Studio Shelf: cups, drips and painted china.
  tenmoku: [['teacup', 'droplet'], 'double', 'speckle', 'light', ['teacup', 'br', 0.3, 0], 'scatter', 'serif'],
  'shino-blush': [['teacup', 'blossom'], 'stitched', 'speckle', 'ink', ['blossom', 'tr', 0.26, 10], 'corners', 'serif'],
  'ash-glaze': [['leaf', 'droplet'], 'none', 'linen', 'ink', ['leaf', 'tl', 0.26, 20], 'tiled', 'mono'],
  'cobalt-slip': [['blossom', 'leaf-sprig'], 'double', 'none', 'light', ['blossom', 'tr', 0.26, 0], 'tiled', 'serif'],
  'raku-smoke': [['droplet', 'sparkle'], 'none', 'speckle', 'light', null, 'scatter', 'display'],
  'oribe-green': [['leaf', 'teacup'], 'stitched', 'wash', 'light', ['leaf', 'br', 0.28, -20], 'garland', 'rounded'],
  bisque: [['teacup', 'cream'], 'scalloped', 'linen', 'ink', ['cream', 'tr', 0.26, 0], 'tiled', 'rounded'],
  'copper-red': [['heart', 'droplet'], 'double', 'none', 'light', ['heart', 'tr', 0.24, 12], 'corners', 'display'],
  // Night Market: lanterns, rain and neon sweets.
  'lantern-row': [['star', 'sparkle', 'moon'], 'ribbon', 'none', 'light', ['star', 'tr', 0.24, 10], 'garland', 'display'],
  'wet-asphalt': [['droplet', 'cloud'], 'none', 'stripes', 'light', ['droplet', 'tr', 0.24, 0], 'scatter', 'mono'],
  'sodium-glow': [['sun', 'star'], 'double', 'speckle', 'ink', ['sun', 'tr', 0.26, 0], 'sky', 'display'],
  'arcade-pink': [['heart', 'star', 'lollipop'], 'scalloped', 'polka', 'ink', ['heart', 'tr', 0.26, 12], 'tiled', 'display'],
  'noodle-steam': [['teacup', 'cloud'], 'stitched', 'linen', 'ink', ['teacup', 'br', 0.3, 0], 'scatter', 'rounded'],
  'tram-wire': [['sparkle', 'star'], 'double', 'linen', 'ink', ['sparkle', 'tr', 0.22, 0], 'sky', 'mono'],
  'mango-stall': [['sun', 'leaf', 'cherry'], 'ribbon', 'stripes', 'light', ['sun', 'tr', 0.26, 0], 'picnic', 'rounded'],
  'last-train': [['moon', 'star', 'cloud'], 'stitched', 'starfield', 'light', ['moon', 'tr', 0.26, -15], 'phases', 'mono'],
  // Pressed Garden: flowers and leaves kept between pages.
  'pressed-violet': [['blossom', 'leaf-sprig', 'petal'], 'lace', 'linen', 'ink', ['blossom', 'tr', 0.28, 0], 'bouquet', 'script'],
  'fern-print': [['leaf-sprig', 'leaf'], 'stitched', 'linen', 'ink', ['leaf-sprig', 'br', 0.3, 20], 'scatter', 'serif'],
  marigold: [['daisy', 'leaf-sprig', 'sun'], 'scalloped', 'wash', 'light', ['daisy', 'tr', 0.28, 0], 'bouquet', 'rounded'],
  eucalyptus: [['leaf', 'leaf-sprig'], 'none', 'speckle', 'ink', ['leaf', 'tl', 0.26, 20], 'garland', 'serif'],
  rosehip: [['cherry', 'leaf', 'heart'], 'double', 'none', 'light', ['cherry', 'tr', 0.28, 10], 'corners', 'script'],
  'lavender-field': [['tulip', 'star', 'sparkle'], 'none', 'starfield', 'light', ['tulip', 'br', 0.28, 0], 'ground', 'serif'],
  chamomile: [['daisy', 'leaf', 'petal'], 'lace', 'speckle', 'ink', ['daisy', 'tl', 0.28, 0], 'petals', 'script'],
  moonflower: [['moon', 'blossom', 'sparkle'], 'double', 'speckle', 'secondary', ['moon', 'tl', 0.26, -20], 'sky', 'serif'],
};

/** Art colours derived from a Plus palette (bg, surface, accent, ink, glyph). */
function plusArt(id: string, p: [string, string, string, string, string]): ThemeArt {
  const [bg, surface, accent, ink] = p;
  const row = PLUS_ART[id] ?? [['sparkle'], 'none', 'none', 'light', null, 'scatter', 'display'];
  const [motifs, frame, texture, textureRole, sticker, composition, displayFont] = row;
  // The lighter of ink / surface plays "light"; the darker plays "ink".
  const inkIsLight = contrastRatio(ink, '#000000') > contrastRatio(surface, '#000000');
  return {
    colours: {
      primary: accent,
      secondary: mix(accent, bg, 0.45),
      accent: mix(accent, '#FFFFFF', 0.45),
      ink: inkIsLight ? surface : ink,
      light: inkIsLight ? ink : surface,
    },
    motifs,
    frame,
    frameRole: 'accent',
    texture,
    textureRole,
    stickers: sticker ? [{ motif: sticker[0], corner: sticker[1], scale: sticker[2], rotation: sticker[3] }] : [],
    composition,
    displayFont,
  };
}

function make(s: Spec): Theme {
  const [bg, surface, accent, ink, glyph] = s.palette;
  return withArt(
    {
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      palette: { bg, surface, accent, ink, glyph },
      iconStyle: {
        shape: s.shape,
        background: s.background,
        glyphColour: glyph,
        glyphSet: s.glyphSet,
        showLabel: s.showLabel ?? true,
        glyphScale: s.glyphScale ?? 0.5,
      },
      wallpaper: s.wallpaper,
      widget: s.widget,
      plus: true,
      categories: Object.freeze([...s.categories]),
      tags: Object.freeze([...s.tags]),
      addedAt: s.addedAt ?? FIRST_CATALOGUE_DATE,
    },
    plusArt(s.id, s.palette),
  );
}

// ------------------------------------------------------------ Studio Shelf
// Fired-clay looks: glazes, slips and ash.
const STUDIO_SHELF: Theme[] = [
  make({
    id: 'tenmoku',
    name: 'Tenmoku',
    tagline: 'Iron-black glaze breaking to rust at the rim.',
    categories: ['dark', 'luxury', 'minimal'],
    tags: ['pottery', 'ceramic', 'glaze', 'rust', 'black', 'brown', 'autumn'],
    palette: ['#17100C', '#2C1D15', '#C77A3E', '#F8EBDD', '#F3D9BF'],
    shape: 'squircle',
    background: { kind: 'gradient', from: '#3A2418', to: '#1A110C', angle: 170 },
    glyphSet: 'glaze',
    wallpaper: { kind: 'grain', colours: ['#17100C', '#4A2A18', '#9A5A2E'], seed: 15101, angle: 180, grain: 0.5 },
    widget: { style: 'solid', font: 'display', accent: '#C77A3E' },
  }),
  make({
    id: 'shino-blush',
    name: 'Shino Blush',
    tagline: 'Milky white with warm pinholes of flame.',
    categories: ['minimal', 'pastel'],
    tags: ['pottery', 'ceramic', 'glaze', 'blush', 'cream', 'pink', 'blossom'],
    palette: ['#FBF4EE', '#FFFFFF', '#B5543A', '#2D1C16', '#8E3E2A'],
    shape: 'rounded',
    background: { kind: 'solid', colour: '#F6E3D8' },
    glyphSet: 'feather',
    wallpaper: { kind: 'mesh', colours: ['#FBF4EE', '#F3D8C8', '#EBC0A8', '#FFF8F2'], seed: 15102, angle: 160, grain: 0.15 },
    widget: { style: 'solid', font: 'body', accent: '#B5543A' },
  }),
  make({
    id: 'ash-glaze',
    name: 'Ash Glaze',
    tagline: 'Wood-ash runs, olive and stone.',
    categories: ['minimal', 'nature'],
    tags: ['pottery', 'ceramic', 'glaze', 'olive', 'stone', 'green', 'earthy'],
    palette: ['#E9E6DA', '#F6F4EC', '#5E6A3A', '#1F2416', '#3B4423'],
    shape: 'squircle',
    background: { kind: 'gradient', from: '#D4D6B8', to: '#B9BE93', angle: 180 },
    glyphSet: 'glaze',
    wallpaper: { kind: 'gradient', colours: ['#E9E6DA', '#C9CCA6', '#8E9A62'], seed: 15103, angle: 175, grain: 0.3 },
    widget: { style: 'outline', font: 'body', accent: '#5E6A3A' },
  }),
  make({
    id: 'cobalt-slip',
    name: 'Cobalt Slip',
    tagline: 'Hand-painted blue on a white body.',
    categories: ['minimal', 'retro'],
    tags: ['pottery', 'ceramic', 'blue', 'white', 'china', 'hand-painted'],
    palette: ['#F4F6FB', '#FFFFFF', '#1F4AA8', '#121A2E', '#1F4AA8'],
    shape: 'circle',
    background: { kind: 'solid', colour: '#FFFFFF' },
    glyphSet: 'feather',
    glyphScale: 0.48,
    wallpaper: { kind: 'pattern', pattern: 'waves', colours: ['#F4F6FB', '#D6DEF2', '#1F4AA8'], seed: 15104, angle: 180 },
    widget: { style: 'outline', font: 'display', accent: '#1F4AA8' },
  }),
  make({
    id: 'raku-smoke',
    name: 'Raku Smoke',
    tagline: 'Crackle and carbon from a fast firing.',
    categories: ['dark', 'minimal', 'luxury'],
    tags: ['pottery', 'ceramic', 'smoke', 'black', 'gold', 'crackle'],
    palette: ['#111214', '#222428', '#D7B46A', '#F0EEE8', '#F0EEE8'],
    shape: 'blob',
    background: { kind: 'glass', tint: '#24262A', opacity: 0.7 },
    glyphSet: 'feather',
    wallpaper: { kind: 'grain', colours: ['#111214', '#3A3B3F', '#7A6B4A'], seed: 15105, angle: 200, grain: 0.65 },
    widget: { style: 'glass', font: 'body', accent: '#D7B46A' },
  }),
  make({
    id: 'oribe-green',
    name: 'Oribe Green',
    tagline: 'Copper green pooled in the hollows.',
    categories: ['dark', 'nature'],
    tags: ['pottery', 'ceramic', 'glaze', 'green', 'copper', 'jade'],
    palette: ['#0F2A22', '#1B3F33', '#9BD3A8', '#E9F7EE', '#0B241C'],
    shape: 'rounded',
    background: { kind: 'gradient', from: '#7FC296', to: '#4F9A6E', angle: 150 },
    glyphSet: 'glaze',
    wallpaper: { kind: 'mesh', colours: ['#0F2A22', '#2E6B50', '#4F9A6E', '#123A2E'], seed: 15106, angle: 165, grain: 0.2 },
    widget: { style: 'solid', font: 'display', accent: '#9BD3A8' },
  }),
  make({
    id: 'bisque',
    name: 'Bisque',
    tagline: 'Unglazed and honest, straight from the first fire.',
    categories: ['minimal', 'pastel'],
    tags: ['pottery', 'clay', 'terracotta', 'cream', 'earthy'],
    palette: ['#F3E7DA', '#FBF5EE', '#9C5B3A', '#2A1A12', '#6E3D24'],
    shape: 'squircle',
    background: { kind: 'solid', colour: '#EBD5C0' },
    glyphSet: 'feather',
    showLabel: false,
    glyphScale: 0.46,
    wallpaper: { kind: 'pattern', pattern: 'dots', colours: ['#F3E7DA', '#E4CDB6', '#B98A68'], seed: 15107, angle: 180, grain: 0.1 },
    widget: { style: 'outline', font: 'body', accent: '#9C5B3A' },
  }),
  make({
    id: 'copper-red',
    name: 'Copper Red',
    tagline: 'Oxblood depth with a bright lip.',
    categories: ['dark', 'luxury'],
    tags: ['pottery', 'ceramic', 'glaze', 'red', 'oxblood', 'heart', 'christmas', 'lunar-new-year'],
    palette: ['#2A0A0C', '#4A1216', '#F08A7A', '#FFECEA', '#FFFFFF'],
    shape: 'circle',
    background: { kind: 'gradient', from: '#9E1F2A', to: '#5A0E16', angle: 160 },
    glyphSet: 'feather',
    wallpaper: { kind: 'gradient', colours: ['#2A0A0C', '#7A1620', '#C8343C'], seed: 15108, angle: 160, grain: 0.25 },
    widget: { style: 'glass', font: 'display', accent: '#F08A7A' },
  }),
];

// ------------------------------------------------------------ Night Market
// After-dark city colour: signs, steam, wet streets.
const NIGHT_MARKET: Theme[] = [
  make({
    id: 'lantern-row',
    name: 'Lantern Row',
    tagline: 'Paper lanterns strung over a dark lane.',
    categories: ['dark', 'anime', 'seasonal'],
    tags: ['lanterns', 'night', 'market', 'orange', 'gold', 'lunar-new-year', 'diwali', 'ramadan', 'eid-al-fitr'],
    palette: ['#120A14', '#24142A', '#FFB347', '#FFF2E0', '#2A1406'],
    shape: 'circle',
    background: { kind: 'gradient', from: '#FFC56B', to: '#F28A30', angle: 180 },
    glyphSet: 'glaze',
    wallpaper: { kind: 'mesh', colours: ['#120A14', '#5A1F3A', '#F28A30', '#2A1240'], seed: 15201, angle: 190, grain: 0.15 },
    widget: { style: 'glass', font: 'display', accent: '#FFB347' },
  }),
  make({
    id: 'wet-asphalt',
    name: 'Wet Asphalt',
    tagline: 'Reflections smeared across a rainy street.',
    categories: ['dark', 'neon', 'minimal'],
    tags: ['rain', 'city', 'street', 'blue', 'night', 'reflections', 'winter'],
    palette: ['#0D1014', '#1A1F26', '#5CC8FF', '#E6F4FF', '#E6F4FF'],
    shape: 'squircle',
    background: { kind: 'glass', tint: '#1A1F26', opacity: 0.65 },
    glyphSet: 'feather',
    wallpaper: { kind: 'gradient', colours: ['#0D1014', '#1E2B3A', '#2E4E6A'], seed: 15202, angle: 170, grain: 0.35 },
    widget: { style: 'glass', font: 'body', accent: '#5CC8FF' },
  }),
  make({
    id: 'sodium-glow',
    name: 'Sodium Glow',
    tagline: 'Amber street lamps on the late shift.',
    categories: ['dark', 'retro'],
    tags: ['lamp', 'street', 'amber', 'orange', 'night', 'city', 'diwali'],
    palette: ['#1A1206', '#2E210C', '#FFA62B', '#FFF3DC', '#1A1206'],
    shape: 'rounded',
    background: { kind: 'solid', colour: '#FFA62B' },
    glyphSet: 'feather',
    wallpaper: { kind: 'grain', colours: ['#1A1206', '#5A3A0E', '#C9771A'], seed: 15203, angle: 180, grain: 0.5 },
    widget: { style: 'solid', font: 'display', accent: '#FFA62B' },
  }),
  make({
    id: 'arcade-pink',
    name: 'Arcade Pink',
    tagline: 'Hot pink and violet from the claw machines.',
    categories: ['neon', 'dark', 'retro'],
    tags: ['arcade', 'pink', 'violet', 'night', 'games', 'new-year'],
    palette: ['#14061E', '#26103A', '#FF4FA3', '#FFE8F4', '#FFFFFF'],
    shape: 'blob',
    background: { kind: 'gradient', from: '#B0186A', to: '#5A1A9E', angle: 135 },
    glyphSet: 'feather',
    wallpaper: { kind: 'mesh', colours: ['#14061E', '#FF4FA3', '#7A2CFF', '#2A0A4A'], seed: 15204, angle: 150 },
    widget: { style: 'glass', font: 'display', accent: '#FF4FA3' },
  }),
  make({
    id: 'noodle-steam',
    name: 'Noodle Steam',
    tagline: 'Warm broth haze behind a fogged window.',
    categories: ['minimal', 'cute'],
    tags: ['noodles', 'food', 'steam', 'cosy', 'window', 'winter'],
    palette: ['#F2EEE8', '#FFFFFF', '#A0432C', '#241A16', '#3A2A22'],
    shape: 'squircle',
    background: { kind: 'solid', colour: '#FFFFFF' },
    glyphSet: 'glaze',
    wallpaper: { kind: 'mesh', colours: ['#F2EEE8', '#E8D6C6', '#F7E9DA', '#D9C2AE'], seed: 15205, angle: 180, grain: 0.2 },
    widget: { style: 'solid', font: 'body', accent: '#A0432C' },
  }),
  make({
    id: 'tram-wire',
    name: 'Tram Wire',
    tagline: 'Overhead lines in a grid of blue sparks.',
    categories: ['neon', 'dark', 'retro'],
    tags: ['tram', 'city', 'grid', 'blue', 'sparks', 'night'],
    palette: ['#08101E', '#122038', '#7FB2FF', '#E8F0FF', '#08101E'],
    shape: 'rounded',
    background: { kind: 'gradient', from: '#A9CBFF', to: '#6A9DF0', angle: 180 },
    glyphSet: 'feather',
    showLabel: false,
    glyphScale: 0.46,
    wallpaper: { kind: 'pattern', pattern: 'grid', colours: ['#08101E', '#18284A', '#4A6FB0'], seed: 15206, angle: 180 },
    widget: { style: 'outline', font: 'body', accent: '#7FB2FF' },
  }),
  make({
    id: 'mango-stall',
    name: 'Mango Stall',
    tagline: 'Ripe yellow crates under a striped awning.',
    categories: ['cute', 'retro'],
    tags: ['mango', 'fruit', 'yellow', 'market', 'awning', 'summer'],
    palette: ['#FFF6DE', '#FFFFFF', '#B5650A', '#2E1F06', '#5A3204'],
    shape: 'circle',
    background: { kind: 'gradient', from: '#FFE07A', to: '#FFC23D', angle: 160 },
    glyphSet: 'glaze',
    glyphScale: 0.48,
    wallpaper: { kind: 'pattern', pattern: 'checker', colours: ['#FFF6DE', '#FFE7A8', '#F5B53A'], seed: 15207, angle: 180 },
    widget: { style: 'solid', font: 'display', accent: '#B5650A' },
  }),
  make({
    id: 'last-train',
    name: 'Last Train',
    tagline: 'Empty carriage, green signal, home soon.',
    categories: ['dark', 'neon', 'anime'],
    tags: ['train', 'night', 'green', 'signal', 'city', 'commute'],
    palette: ['#071612', '#10261F', '#3DDC97', '#E5FFF4', '#D2FFEC'],
    shape: 'squircle',
    background: { kind: 'glass', tint: '#10261F', opacity: 0.7 },
    glyphSet: 'feather',
    wallpaper: { kind: 'gradient', colours: ['#071612', '#0F3A2C', '#1E7A58'], seed: 15208, angle: 200, grain: 0.2 },
    widget: { style: 'glass', font: 'body', accent: '#3DDC97' },
  }),
];

// ------------------------------------------------------------ Pressed Garden
// Flowers and leaves dried flat between pages.
const PRESSED_GARDEN: Theme[] = [
  make({
    id: 'pressed-violet',
    name: 'Pressed Violet',
    tagline: 'A small purple bloom kept in a notebook.',
    categories: ['pastel', 'nature'],
    tags: ['flowers', 'violet', 'purple', 'pressed', 'botanical', 'spring', 'easter'],
    palette: ['#F5F0FA', '#FFFFFF', '#6A3FA0', '#211A2B', '#5A3290'],
    shape: 'squircle',
    background: { kind: 'solid', colour: '#ECE2F7' },
    glyphSet: 'feather',
    wallpaper: { kind: 'mesh', colours: ['#F5F0FA', '#E2D3F2', '#D2BCEB', '#F8EEF6'], seed: 15301, angle: 170, grain: 0.1 },
    widget: { style: 'solid', font: 'display', accent: '#6A3FA0' },
  }),
  make({
    id: 'fern-print',
    name: 'Fern Print',
    tagline: 'Leaf fronds inked onto rough paper.',
    categories: ['nature', 'minimal'],
    tags: ['fern', 'leaves', 'botanical', 'green', 'print'],
    palette: ['#EEF2E6', '#FAFCF6', '#3E6B2E', '#18240F', '#2D5221'],
    shape: 'rounded',
    background: { kind: 'solid', colour: '#DCE8CF' },
    glyphSet: 'glaze',
    wallpaper: { kind: 'pattern', pattern: 'waves', colours: ['#EEF2E6', '#D3E1C3', '#7E9E62'], seed: 15302, angle: 180 },
    widget: { style: 'outline', font: 'body', accent: '#3E6B2E' },
  }),
  make({
    id: 'marigold',
    name: 'Marigold',
    tagline: 'Saffron petals warm against the dark.',
    categories: ['nature', 'dark', 'seasonal'],
    tags: ['flowers', 'marigold', 'saffron', 'orange', 'gold', 'diwali', 'autumn'],
    palette: ['#1E1206', '#33200C', '#F7B32B', '#FFF4DF', '#2B1806'],
    shape: 'blob',
    background: { kind: 'gradient', from: '#FFC94A', to: '#F28C1E', angle: 140 },
    glyphSet: 'feather',
    wallpaper: { kind: 'mesh', colours: ['#1E1206', '#7A3E0A', '#F28C1E', '#3A1E06'], seed: 15303, angle: 180, grain: 0.2 },
    widget: { style: 'glass', font: 'display', accent: '#F7B32B' },
  }),
  make({
    id: 'eucalyptus',
    name: 'Eucalyptus',
    tagline: 'Silver-blue leaves, cool and fragrant.',
    categories: ['nature', 'minimal'],
    tags: ['leaves', 'eucalyptus', 'silver', 'botanical', 'winter', 'christmas'],
    palette: ['#E6EEEC', '#F7FAF9', '#4A7470', '#162422', '#2F5551'],
    shape: 'circle',
    background: { kind: 'solid', colour: '#C9DCD8' },
    glyphSet: 'feather',
    glyphScale: 0.48,
    wallpaper: { kind: 'gradient', colours: ['#E6EEEC', '#BFD3CF', '#8DB0AA'], seed: 15304, angle: 165, grain: 0.15 },
    widget: { style: 'outline', font: 'body', accent: '#4A7470' },
  }),
  make({
    id: 'rosehip',
    name: 'Rosehip',
    tagline: 'Late-summer red on a bramble of brown.',
    categories: ['nature', 'dark'],
    tags: ['berries', 'red', 'bramble', 'autumn', 'heart', 'valentines'],
    palette: ['#2A0F10', '#45191B', '#F2867A', '#FFECE9', '#FFF4F2'],
    shape: 'squircle',
    background: { kind: 'gradient', from: '#A8302E', to: '#6A1A1C', angle: 170 },
    glyphSet: 'glaze',
    wallpaper: { kind: 'grain', colours: ['#2A0F10', '#6A1A1C', '#B8443A'], seed: 15305, angle: 180, grain: 0.45 },
    widget: { style: 'solid', font: 'display', accent: '#F2867A' },
  }),
  make({
    id: 'lavender-field',
    name: 'Lavender Field',
    tagline: 'Rows of purple stretching to dusk.',
    categories: ['nature', 'dark'],
    tags: ['lavender', 'purple', 'field', 'dusk', 'flowers', 'summer'],
    palette: ['#1A1430', '#2A2148', '#C7B2FF', '#F1ECFF', '#F1ECFF'],
    shape: 'rounded',
    background: { kind: 'glass', tint: '#2A2148', opacity: 0.65 },
    glyphSet: 'feather',
    wallpaper: { kind: 'gradient', colours: ['#1A1430', '#4A3A80', '#9A7AD0', '#E8A6B8'], seed: 15306, angle: 180, grain: 0.15 },
    widget: { style: 'glass', font: 'body', accent: '#C7B2FF' },
  }),
  make({
    id: 'chamomile',
    name: 'Chamomile',
    tagline: 'White petals, a sunny centre, calm tea.',
    categories: ['nature', 'pastel', 'cute'],
    tags: ['daisy', 'flowers', 'tea', 'yellow', 'white', 'spring', 'easter'],
    palette: ['#FFFCF0', '#FFFFFF', '#8A6A00', '#2A2410', '#6B5200'],
    shape: 'circle',
    background: { kind: 'solid', colour: '#FFF1B8' },
    glyphSet: 'glaze',
    showLabel: false,
    glyphScale: 0.46,
    wallpaper: { kind: 'pattern', pattern: 'dots', colours: ['#FFFCF0', '#FFF1B8', '#E8C64A'], seed: 15307, angle: 180 },
    widget: { style: 'solid', font: 'body', accent: '#8A6A00' },
  }),
  make({
    id: 'moonflower',
    name: 'Moonflower',
    tagline: 'Pale blooms that only open at night.',
    categories: ['dark', 'nature', 'luxury'],
    tags: ['moon', 'flowers', 'night', 'pale', 'botanical', 'eid-al-fitr', 'halloween'],
    palette: ['#0A0F1A', '#141C2E', '#E8E4FF', '#F4F2FF', '#141C2E'],
    shape: 'blob',
    background: { kind: 'solid', colour: '#E8E4FF' },
    glyphSet: 'feather',
    wallpaper: { kind: 'mesh', colours: ['#0A0F1A', '#24305A', '#5A5A9E', '#101828'], seed: 15308, angle: 200, grain: 0.12 },
    widget: { style: 'outline', font: 'display', accent: '#E8E4FF' },
  }),
];

export const PLUS_PACKS: readonly PlusPack[] = Object.freeze([
  { id: 'studio-shelf', name: 'Studio Shelf', tagline: 'Fired-clay glazes, slips and ash.', themes: Object.freeze(STUDIO_SHELF) },
  { id: 'night-market', name: 'Night Market', tagline: 'Signs, steam and wet streets after dark.', themes: Object.freeze(NIGHT_MARKET) },
  { id: 'pressed-garden', name: 'Pressed Garden', tagline: 'Flowers and leaves kept between pages.', themes: Object.freeze(PRESSED_GARDEN) },
  // T46: the first downloadable pack (artwork fetched on demand; docs/THEME_PACKS.md).
  { id: AURORA_PACK_ID, name: 'Aurora', tagline: 'Anime sparkle, Halloween night, gold and neon.', themes: NEW_PLUS_THEMES },
  // T104: original game, movie-night and storybook looks, also downloadable (docs/THEME_PACKS.md).
  {
    id: STORYPLAY_PACK_ID,
    name: STORYPLAY_PACK_NAME,
    tagline: 'Pixel quests, movie nights and storybook dragons.',
    themes: STORYPLAY_PLUS_THEMES,
  },
]);

/** Every Plus theme, in pack order. */
export const PLUS_THEMES: readonly Theme[] = Object.freeze(PLUS_PACKS.flatMap((p) => [...p.themes]));

/** Starter themes followed by every Plus theme. */
export const ALL_THEMES: readonly Theme[] = Object.freeze([...THEMES, ...PLUS_THEMES]);

/** Look up any theme (starter or Plus) by id; retired starter ids open their replacement. */
export function getAnyTheme(id: string | null | undefined): Theme | undefined {
  if (typeof id !== 'string') return undefined;
  // T103: the free Space (Webb) photo themes resolve here too (detail, studio, apply).
  return ALL_THEMES.find((t) => t.id === id) ?? getTheme(id) ?? spaceThemeById(id);
}

/**
 * T81: the theme the wallpaper maker starts from. Any theme (starter or Plus) opens directly in
 * the maker; a Plus theme that is still locked falls back to the first starter theme, so the maker
 * never hands out Plus artwork. Whether it is locked is decided in src/plus and passed in here.
 */
export function wallpaperMakerTheme(id: string | null | undefined, plusLocked: boolean): Theme {
  const any = getAnyTheme(id);
  if (any && !(any.plus && plusLocked)) return any;
  return getTheme(id) ?? THEMES[0];
}

/** Colour swatches in the maker: the starter themes, with a Plus start theme first when there is one. */
export function wallpaperMakerSwatches(start: Theme): readonly Theme[] {
  return THEMES.some((t) => t.id === start.id) ? THEMES : [start, ...THEMES];
}

/** The pack a Plus theme belongs to, if any. */
export function packOf(themeId: string): PlusPack | undefined {
  return PLUS_PACKS.find((p) => p.themes.some((t) => t.id === themeId));
}
