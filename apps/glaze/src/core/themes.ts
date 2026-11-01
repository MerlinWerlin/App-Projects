// Starter themes: a whole look (palette, icon style, artwork, wallpaper, widget style). All original:
// the motifs are Glaze's own vector art (src/core/artwork.ts), never characters, brands or logos.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import { iconArtOf, wallpaperArtOf, type ThemeArt } from './artwork.ts';
import { getById, type CatalogueEntry } from './catalogue.ts';
import { DEFAULT_ICON_LOOK, iconStyleForLook, type IconLook } from './iconLook.ts';
import { resolveSpecs, type IconShape, type IconSpec, type IconStyle } from './iconspec.ts';
import type { WallpaperParams } from './wallpaper.ts';
import { NEW_FREE_THEMES } from './themesNew.ts';
import { STORYPLAY_FREE_THEMES } from './themesStoryPlay.ts';

export type ThemePalette = {
  /** Screen / card background behind the theme's UI. */
  bg: string;
  surface: string;
  accent: string;
  /** Text on bg. */
  ink: string;
  /** Icon glyph colour (matches iconStyle.glyphColour). */
  glyph: string;
};

export type WidgetStyle = {
  style: 'glass' | 'solid' | 'outline';
  font: 'display' | 'body';
  accent: string;
};

export type Theme = {
  id: string;
  name: string;
  tagline: string;
  palette: ThemePalette;
  /** Icon style; `iconStyle.art` carries the icon half of `art` (texture, stickers, frame). */
  iconStyle: IconStyle;
  /** Wallpaper params; `wallpaper.art` carries the composition half of `art`. */
  wallpaper: WallpaperParams;
  widget: WidgetStyle;
  /** Plus-only theme (none of the starters are). */
  plus: boolean;
  /** The theme's artwork identity: motifs, frame, texture, stickers, composition, display type. */
  art: ThemeArt;
  /** Browse categories (src/core/categories.ts ids, e.g. 'minimal', 'dark'). Owner request 16 Oct, R4. */
  categories?: readonly ThemeCategoryId[];
  /** Free-text search tags (lower case). */
  tags?: readonly string[];
  /** ISO date the theme was added; drives the "New" badge. */
  addedAt?: string;
  /** Downloadable pack id when the artwork ships in a theme pack instead of the app bundle (R6). */
  packId?: string;
};

/** Category ids for theme browsing (R4). Labels live in the i18n catalogue. */
export type ThemeCategoryId =
  | 'minimal'
  | 'dark'
  | 'pastel'
  | 'nature'
  | 'neon'
  | 'retro'
  | 'anime'
  | 'cute'
  | 'luxury'
  | 'seasonal';

/** Attach artwork to a theme, copying the icon and wallpaper halves into iconStyle / wallpaper. */
export function withArt(base: Omit<Theme, 'art'>, art: ThemeArt): Theme {
  return {
    ...base,
    iconStyle: { ...base.iconStyle, art: iconArtOf(art) },
    wallpaper: { ...base.wallpaper, art: wallpaperArtOf(art) },
    art,
  };
}

type Def = {
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
  icon: Omit<IconStyle, 'glyphColour' | 'art'>;
  wallpaper: WallpaperParams;
  widget: WidgetStyle;
  art: ThemeArt;
};

function make(d: Def): Theme {
  const [bg, surface, accent, ink, glyph] = d.palette;
  return withArt(
    {
      id: d.id,
      name: d.name,
      tagline: d.tagline,
      palette: { bg, surface, accent, ink, glyph },
      iconStyle: { ...d.icon, glyphColour: glyph },
      wallpaper: d.wallpaper,
      widget: d.widget,
      plus: false,
      categories: Object.freeze([...d.categories]),
      tags: Object.freeze([...d.tags]),
      addedAt: d.addedAt ?? FIRST_CATALOGUE_DATE,
    },
    d.art,
  );
}

/** Date the first theme catalogue (starters + Plus packs) was added; see categories.ts LAUNCH_CATALOGUE_DATE. */
export const FIRST_CATALOGUE_DATE = '2026-10-12';

const FEATHER = 'feather';
const INHOUSE = 'glaze';

export const THEMES: readonly Theme[] = Object.freeze([
  make({
    id: 'strawberry-dessert',
    name: 'Strawberry Dessert',
    tagline: 'Berries, whipped cream and a gingham picnic.',
    categories: ['cute', 'pastel'],
    tags: ['strawberry', 'berries', 'dessert', 'picnic', 'gingham', 'pink', 'red', 'sweet', 'food', 'valentines', 'summer'],
    palette: ['#FFF4F1', '#FFFFFF', '#E0475B', '#4A1E24', '#B8283C'],
    icon: { shape: 'squircle', background: { kind: 'solid', colour: '#FFE3E3' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'gradient', colours: ['#FFF4F1', '#FFD9DC', '#FFC2C8'], seed: 2401, angle: 180, grain: 0.1 },
    widget: { style: 'solid', font: 'display', accent: '#E0475B' },
    art: {
      colours: { primary: '#E8475A', secondary: '#5FA35A', accent: '#F7B6C2', ink: '#4A1E24', light: '#FFFFFF' },
      motifs: ['strawberry', 'cream', 'heart', 'bow'],
      frame: 'scalloped',
      frameRole: 'primary',
      texture: 'gingham',
      textureRole: 'primary',
      stickers: [{ motif: 'strawberry', corner: 'tr', scale: 0.3, rotation: 15 }],
      composition: 'picnic',
      displayFont: 'rounded',
    },
  }),
  make({
    id: 'cottage-garden',
    name: 'Cottage Garden',
    tagline: 'Tulips, leafy sprigs and linen in the sun.',
    categories: ['nature', 'pastel'],
    tags: ['flowers', 'tulip', 'garden', 'cottage', 'spring', 'green', 'linen', 'easter'],
    palette: ['#F5F1E6', '#FFFDF7', '#6E8B4E', '#26301C', '#3F5A2B'],
    icon: { shape: 'rounded', background: { kind: 'solid', colour: '#E9EFD9' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'mesh', colours: ['#F5F1E6', '#E3EBCF', '#F6DCD8', '#FFF6DE'], seed: 2402, angle: 170, grain: 0.12 },
    widget: { style: 'outline', font: 'body', accent: '#6E8B4E' },
    art: {
      colours: { primary: '#E58A9A', secondary: '#6E8B4E', accent: '#F2C14E', ink: '#26301C', light: '#FFFFFF' },
      motifs: ['tulip', 'leaf-sprig', 'daisy'],
      frame: 'stitched',
      frameRole: 'secondary',
      texture: 'linen',
      textureRole: 'secondary',
      stickers: [{ motif: 'tulip', corner: 'br', scale: 0.3, rotation: -10 }],
      composition: 'bouquet',
      displayFont: 'serif',
    },
  }),
  make({
    id: 'wildflower-meadow',
    name: 'Wildflower Meadow',
    tagline: 'Daisies and butterflies tumbling through long grass.',
    categories: ['nature', 'cute'],
    tags: ['flowers', 'daisy', 'butterfly', 'meadow', 'grass', 'green', 'summer'],
    palette: ['#FFF9EC', '#FFFFFF', '#C9861E', '#2F2A14', '#FFFFFF'],
    icon: {
      shape: 'circle',
      background: { kind: 'gradient', from: '#4F7A34', to: '#36602A', angle: 180 },
      glyphSet: FEATHER,
      showLabel: true,
      glyphScale: 0.46,
    },
    wallpaper: { kind: 'gradient', colours: ['#E4F2C8', '#B5D98A', '#86B65C'], seed: 2403, angle: 180, grain: 0.15 },
    widget: { style: 'solid', font: 'body', accent: '#C9861E' },
    art: {
      colours: { primary: '#EE7AA0', secondary: '#4F7A34', accent: '#F6C445', ink: '#2F2A14', light: '#FFFFFF' },
      motifs: ['daisy', 'butterfly', 'leaf-sprig'],
      frame: 'ribbon',
      frameRole: 'accent',
      texture: 'wash',
      textureRole: 'accent',
      stickers: [
        { motif: 'daisy', corner: 'tl', scale: 0.3, rotation: 0 },
        { motif: 'daisy', corner: 'tr', scale: 0.18, rotation: 20 },
      ],
      composition: 'scatter',
      displayFont: 'rounded',
    },
  }),
  make({
    id: 'celestial-night',
    name: 'Celestial Night',
    tagline: 'Ringed planets, gold stars and a sky full of sparkle.',
    categories: ['dark', 'anime', 'luxury'],
    tags: ['space', 'stars', 'planet', 'moon', 'night', 'gold', 'sparkle', 'sky', 'new-year', 'ramadan', 'eid-al-fitr', 'christmas'],
    palette: ['#0E0B2A', '#1C1745', '#F5C96B', '#F3EEFF', '#F5C96B'],
    icon: {
      shape: 'squircle',
      background: { kind: 'gradient', from: '#2A2266', to: '#120E36', angle: 160 },
      glyphSet: FEATHER,
      showLabel: true,
      glyphScale: 0.46,
    },
    wallpaper: { kind: 'mesh', colours: ['#0E0B2A', '#2A2266', '#4B2C7A', '#101A44'], seed: 2404, angle: 200, grain: 0.12 },
    widget: { style: 'glass', font: 'display', accent: '#F5C96B' },
    art: {
      colours: { primary: '#8C7BFF', secondary: '#3B3290', accent: '#F5C96B', ink: '#0E0B2A', light: '#FFF6DA' },
      motifs: ['planet', 'star', 'sparkle', 'moon'],
      frame: 'double',
      frameRole: 'accent',
      texture: 'starfield',
      textureRole: 'light',
      stickers: [
        { motif: 'planet', corner: 'tr', scale: 0.3, rotation: -10 },
        { motif: 'sparkle', corner: 'bl', scale: 0.2, rotation: 0 },
      ],
      composition: 'sky',
      displayFont: 'display',
    },
  }),
  make({
    id: 'moon-phase',
    name: 'Moon Phase',
    tagline: 'Silver crescents waxing over a quiet midnight.',
    categories: ['dark', 'minimal'],
    tags: ['moon', 'crescent', 'night', 'silver', 'stars', 'calm', 'ramadan', 'winter'],
    palette: ['#1B2235', '#283250', '#C9D4F0', '#EEF2FF', '#1B2235'],
    icon: { shape: 'circle', background: { kind: 'solid', colour: '#DDE3F4' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'gradient', colours: ['#0F1424', '#1B2235', '#33405F'], seed: 2405, angle: 180, grain: 0.2 },
    widget: { style: 'glass', font: 'display', accent: '#C9D4F0' },
    art: {
      colours: { primary: '#B9C4E4', secondary: '#7D8BB8', accent: '#F2CF7A', ink: '#1B2235', light: '#F4F6FF' },
      motifs: ['moon', 'star', 'cloud'],
      frame: 'none',
      frameRole: 'secondary',
      texture: 'speckle',
      textureRole: 'secondary',
      stickers: [{ motif: 'moon', corner: 'tl', scale: 0.3, rotation: -20 }],
      composition: 'phases',
      displayFont: 'serif',
    },
  }),
  make({
    id: 'whimsy-forest',
    name: 'Whimsy Forest',
    tagline: 'Spotted mushrooms and acorns on a mossy floor.',
    categories: ['nature', 'dark', 'cute'],
    tags: ['mushroom', 'forest', 'acorn', 'woodland', 'moss', 'autumn', 'halloween'],
    palette: ['#1F2A1C', '#2F3F2A', '#E2543F', '#F2EEDC', '#2B2418'],
    icon: { shape: 'blob', background: { kind: 'solid', colour: '#F2E3C6' }, glyphSet: INHOUSE, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'grain', colours: ['#1F2A1C', '#3A4E30', '#6E7F48'], seed: 2406, angle: 200, grain: 0.5 },
    widget: { style: 'glass', font: 'body', accent: '#E2543F' },
    art: {
      colours: { primary: '#D9473A', secondary: '#7C9A55', accent: '#C88A4A', ink: '#2B2418', light: '#FFF6E6' },
      motifs: ['mushroom', 'acorn', 'leaf-sprig', 'sparkle'],
      frame: 'stitched',
      frameRole: 'accent',
      texture: 'polka',
      textureRole: 'primary',
      stickers: [
        { motif: 'mushroom', corner: 'br', scale: 0.32, rotation: 8 },
        { motif: 'leaf-sprig', corner: 'tl', scale: 0.22, rotation: -30 },
      ],
      composition: 'ground',
      displayFont: 'rounded',
    },
  }),
  make({
    id: 'romantic-lace',
    name: 'Romantic Lace',
    tagline: 'Bows, hearts and lace doilies in dusty pink.',
    categories: ['pastel', 'luxury', 'seasonal'],
    tags: ['lace', 'bow', 'heart', 'pink', 'romantic', 'love', 'valentines'],
    palette: ['#F7E9EC', '#FFF8F9', '#B5536C', '#3D1A24', '#FFFFFF'],
    icon: {
      shape: 'squircle',
      background: { kind: 'gradient', from: '#B9637A', to: '#94405A', angle: 170 },
      glyphSet: FEATHER,
      showLabel: true,
      glyphScale: 0.44,
    },
    wallpaper: { kind: 'mesh', colours: ['#F7E9EC', '#EFCFD7', '#F9DDE3', '#FFF5F6'], seed: 2407, angle: 160, grain: 0.1 },
    widget: { style: 'solid', font: 'display', accent: '#B5536C' },
    art: {
      colours: { primary: '#D97F97', secondary: '#B5536C', accent: '#FBE3E8', ink: '#3D1A24', light: '#FFFFFF' },
      motifs: ['doily', 'bow', 'heart'],
      frame: 'lace',
      frameRole: 'light',
      texture: 'none',
      textureRole: 'light',
      stickers: [{ motif: 'bow', corner: 'tl', scale: 0.3, rotation: -12 }],
      composition: 'corners',
      displayFont: 'script',
    },
  }),
  make({
    id: 'cloud-nine',
    name: 'Cloud Nine',
    tagline: 'Puffy clouds, little hearts and a pastel sky.',
    categories: ['pastel', 'cute', 'anime'],
    tags: ['clouds', 'sky', 'heart', 'sparkle', 'blue', 'dreamy', 'easter'],
    palette: ['#EAF4FF', '#FFFFFF', '#5F86C9', '#1E2F4D', '#3B5FA8'],
    icon: { shape: 'circle', background: { kind: 'solid', colour: '#FFFFFF' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'gradient', colours: ['#BFDDFF', '#E2F0FF', '#FFE1EE'], seed: 2408, angle: 180, grain: 0.08 },
    widget: { style: 'glass', font: 'display', accent: '#5F86C9' },
    art: {
      colours: { primary: '#F49AC1', secondary: '#A9CBF5', accent: '#FFE29A', ink: '#1E2F4D', light: '#FFFFFF' },
      motifs: ['cloud', 'heart', 'sparkle'],
      frame: 'scalloped',
      frameRole: 'secondary',
      texture: 'wash',
      textureRole: 'secondary',
      stickers: [
        { motif: 'cloud', corner: 'bl', scale: 0.34, rotation: 0 },
        { motif: 'heart', corner: 'tr', scale: 0.2, rotation: 12 },
      ],
      composition: 'sky',
      displayFont: 'rounded',
    },
  }),
  make({
    id: 'seaside-shells',
    name: 'Seaside Shells',
    tagline: 'Scallop shells and starfish along warm sand.',
    categories: ['nature', 'minimal'],
    tags: ['beach', 'sea', 'ocean', 'shell', 'starfish', 'sand', 'teal', 'summer'],
    palette: ['#F6EEDF', '#FFFBF3', '#267D8A', '#1F2C30', '#FFFFFF'],
    icon: {
      shape: 'rounded',
      background: { kind: 'gradient', from: '#267D8A', to: '#1A5C66', angle: 180 },
      glyphSet: FEATHER,
      showLabel: true,
      glyphScale: 0.44,
    },
    wallpaper: { kind: 'pattern', pattern: 'waves', colours: ['#F6EEDF', '#E9DCC4', '#8FD3D6'], seed: 2409, angle: 180 },
    widget: { style: 'solid', font: 'body', accent: '#267D8A' },
    art: {
      colours: { primary: '#F3A98C', secondary: '#5FBFC4', accent: '#F7D59B', ink: '#1F2C30', light: '#FFFFFF' },
      motifs: ['shell', 'starfish'],
      frame: 'ribbon',
      frameRole: 'light',
      texture: 'stripes',
      textureRole: 'light',
      stickers: [
        { motif: 'shell', corner: 'tr', scale: 0.3, rotation: -15 },
        { motif: 'starfish', corner: 'tl', scale: 0.2, rotation: 10 },
      ],
      composition: 'garland',
      displayFont: 'serif',
    },
  }),
  make({
    id: 'retro-diner',
    name: 'Retro Diner',
    tagline: 'Cherry red booths, sundaes and a checker floor.',
    categories: ['retro', 'cute'],
    tags: ['diner', 'cherry', 'ice-cream', 'sundae', 'checker', 'red', 'fifties'],
    palette: ['#FFF6E8', '#FFFFFF', '#D7263D', '#2A1414', '#FFFFFF'],
    icon: { shape: 'rounded', background: { kind: 'solid', colour: '#D7263D' }, glyphSet: INHOUSE, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'pattern', pattern: 'checker', colours: ['#FFF6E8', '#F8E1DA', '#E9B9B2'], seed: 2410, angle: 180 },
    widget: { style: 'solid', font: 'display', accent: '#D7263D' },
    art: {
      colours: { primary: '#D7263D', secondary: '#2BB3B1', accent: '#FFD23F', ink: '#2A1414', light: '#FFFFFF' },
      motifs: ['cherry', 'ice-cream', 'star'],
      frame: 'scalloped',
      frameRole: 'light',
      texture: 'gingham',
      textureRole: 'light',
      stickers: [
        { motif: 'cherry', corner: 'tr', scale: 0.3, rotation: 10 },
        { motif: 'star', corner: 'bl', scale: 0.2, rotation: -8 },
      ],
      composition: 'garland',
      displayFont: 'display',
    },
  }),
  make({
    id: 'matcha-cafe',
    name: 'Matcha Café',
    tagline: 'Whisked green tea, soft cream and paper cups.',
    categories: ['minimal', 'nature'],
    tags: ['matcha', 'tea', 'cafe', 'green', 'cream', 'cosy'],
    palette: ['#EEF2E4', '#FAFCF5', '#5E7F35', '#1F2A14', '#F6F8EE'],
    icon: { shape: 'squircle', background: { kind: 'solid', colour: '#5E7F35' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'mesh', colours: ['#B9CF92', '#A8C47A', '#D9E4BF', '#8FAE62'], seed: 2411, angle: 170, grain: 0.18 },
    widget: { style: 'solid', font: 'body', accent: '#5E7F35' },
    art: {
      colours: { primary: '#A8C47A', secondary: '#4E6B2B', accent: '#E9D8B4', ink: '#1F2A14', light: '#FFFFFF' },
      motifs: ['teacup', 'leaf', 'cream'],
      frame: 'double',
      frameRole: 'accent',
      texture: 'speckle',
      textureRole: 'light',
      stickers: [{ motif: 'teacup', corner: 'br', scale: 0.32, rotation: 0 }],
      composition: 'scatter',
      displayFont: 'mono',
    },
  }),
  make({
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    tagline: 'Pink petals drifting across a spring sky.',
    categories: ['pastel', 'nature', 'anime', 'seasonal'],
    tags: ['blossom', 'petals', 'pink', 'spring', 'sky', 'lunar-new-year'],
    palette: ['#FFF0F4', '#FFFFFF', '#D9668A', '#3E1F2B', '#8C2F52'],
    icon: { shape: 'squircle', background: { kind: 'solid', colour: '#FFFFFF' }, glyphSet: FEATHER, showLabel: true, glyphScale: 0.46 },
    wallpaper: { kind: 'gradient', colours: ['#DCEBFF', '#FFF0F4', '#FFD6E2'], seed: 2412, angle: 180, grain: 0.06 },
    widget: { style: 'outline', font: 'display', accent: '#D9668A' },
    art: {
      colours: { primary: '#F29BB5', secondary: '#7A4E40', accent: '#D9668A', ink: '#3E1F2B', light: '#FFFFFF' },
      motifs: ['blossom', 'petal', 'sparkle'],
      frame: 'none',
      frameRole: 'accent',
      texture: 'wash',
      textureRole: 'primary',
      stickers: [
        { motif: 'blossom', corner: 'tr', scale: 0.32, rotation: 10 },
        { motif: 'petal', corner: 'bl', scale: 0.18, rotation: -30 },
      ],
      composition: 'petals',
      displayFont: 'serif',
    },
  }),
  make({
    id: 'pumpkin-patch',
    name: 'Pumpkin Patch',
    tagline: 'Plump pumpkins, acorns and crisp autumn leaves.',
    categories: ['seasonal', 'nature', 'dark'],
    tags: ['pumpkin', 'autumn', 'fall', 'harvest', 'acorn', 'leaves', 'orange', 'halloween'],
    palette: ['#2B1A10', '#3F2717', '#F08A2C', '#FBEBDA', '#3A1F0C'],
    icon: {
      shape: 'rounded',
      background: { kind: 'gradient', from: '#F6A24A', to: '#E07A22', angle: 180 },
      glyphSet: INHOUSE,
      showLabel: true,
      glyphScale: 0.46,
    },
    wallpaper: { kind: 'grain', colours: ['#2B1A10', '#5A3418', '#8A4E22'], seed: 2413, angle: 180, grain: 0.45 },
    widget: { style: 'solid', font: 'display', accent: '#F08A2C' },
    art: {
      colours: { primary: '#F08A2C', secondary: '#6E7A3A', accent: '#F6C35B', ink: '#3A1F0C', light: '#FFE8C8' },
      motifs: ['pumpkin', 'acorn', 'leaf', 'star'],
      frame: 'stitched',
      frameRole: 'ink',
      texture: 'linen',
      textureRole: 'ink',
      stickers: [
        { motif: 'pumpkin', corner: 'br', scale: 0.32, rotation: 0 },
        { motif: 'leaf', corner: 'tl', scale: 0.22, rotation: 30 },
      ],
      composition: 'ground',
      displayFont: 'serif',
    },
  }),
  make({
    id: 'candy-arcade',
    name: 'Candy Arcade',
    tagline: 'Lollipops, wrapped sweets and sugar sparkles.',
    categories: ['neon', 'cute', 'retro'],
    tags: ['candy', 'lollipop', 'sweets', 'sparkle', 'pink', 'purple', 'arcade', 'new-year', 'christmas'],
    palette: ['#FFF2FB', '#FFFFFF', '#D6338A', '#3A1030', '#FFFFFF'],
    icon: {
      shape: 'blob',
      background: { kind: 'gradient', from: '#A63FD6', to: '#6E28C2', angle: 150 },
      glyphSet: FEATHER,
      showLabel: true,
      glyphScale: 0.46,
    },
    wallpaper: { kind: 'mesh', colours: ['#FFD6EC', '#D9F1FF', '#FFF4B8', '#F2D9FF'], seed: 2414, angle: 150, grain: 0.08 },
    widget: { style: 'glass', font: 'display', accent: '#D6338A' },
    art: {
      colours: { primary: '#FF6FB5', secondary: '#7CD6F2', accent: '#FFE066', ink: '#3A1030', light: '#FFFFFF' },
      motifs: ['lollipop', 'candy', 'star', 'heart'],
      frame: 'double',
      frameRole: 'accent',
      texture: 'polka',
      textureRole: 'secondary',
      stickers: [
        { motif: 'lollipop', corner: 'tr', scale: 0.3, rotation: 20 },
        { motif: 'candy', corner: 'bl', scale: 0.24, rotation: -15 },
      ],
      composition: 'tiled',
      displayFont: 'display',
    },
  }),
  // T46: the four new free themes (src/core/themesNew.ts) follow the original starters.
  // T104: then the six free game, movie-night and storybook themes (src/core/themesStoryPlay.ts).
].concat(NEW_FREE_THEMES, STORYPLAY_FREE_THEMES));

/**
 * Ids of the first 12 starter themes (palette-only looks, replaced in Oct 2026) and the new theme
 * each now opens, so saved Icon Studio state, links and widget settings keep working.
 */
export const LEGACY_THEME_IDS: Readonly<Record<string, string>> = Object.freeze({
  porcelain: 'cloud-nine',
  'plum-glaze': 'romantic-lace',
  'kiln-ember': 'pumpkin-patch',
  celadon: 'matcha-cafe',
  'midnight-ink': 'celestial-night',
  terrazzo: 'retro-diner',
  'salt-flat': 'seaside-shells',
  'neon-tide': 'candy-arcade',
  moss: 'whimsy-forest',
  'peach-fuzz': 'strawberry-dessert',
  graphite: 'moon-phase',
  aurora: 'celestial-night',
});

/** Current id for a theme id (legacy ids map to their replacement). */
export function canonicalThemeId(id: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_THEME_IDS, id) ? LEGACY_THEME_IDS[id] : id;
}

export function getTheme(id: string | null | undefined): Theme | undefined {
  if (typeof id !== 'string') return undefined;
  const key = canonicalThemeId(id.trim());
  return THEMES.find((t) => t.id === key);
}

/** Generic apps used for theme previews (mock Home Screens). */
export const PREVIEW_APP_IDS: readonly string[] = Object.freeze([
  'camera',
  'photos',
  'messages',
  'phone',
  'mail',
  'maps',
  'music',
  'calendar',
  'notes',
  'weather',
  'clock',
  'settings',
]);

export function previewApps(): CatalogueEntry[] {
  return PREVIEW_APP_IDS.map((id) => getById(id)).filter((e): e is CatalogueEntry => e !== undefined);
}

/**
 * Icon specs for a theme over the preview apps, optionally in another shape (the user's choice)
 * and look (T240; default 'themed', the textured look, T241).
 */
export function previewSpecs(
  theme: Theme,
  count: number = PREVIEW_APP_IDS.length,
  shape?: IconShape,
  look: IconLook = DEFAULT_ICON_LOOK,
): IconSpec[] {
  const lookStyle = iconStyleForLook(theme, look);
  const style = shape ? { ...lookStyle, shape } : lookStyle;
  return resolveSpecs(previewApps().slice(0, Math.max(0, count)), style);
}
