// T104 (owner feedback 22 Oct 2026, docs/OWNER_1022.md G5 b–d): 13 new ORIGINAL themes in three
// groups: game-inspired (pixel arcade, cyber neon, fantasy quest, cosy farm, racing), movie-night
// moods (sci-fi, noir, cute monsters, a superhero style with our own emblem) and storybook themes
// for kids (castle, crown and gown, little dragon, woodland friends).
// STORYPLAY_FREE_THEMES (6, at least one per group) ship in the app bundle and show no Plus badge;
// STORYPLAY_PLUS_THEMES (7) are Glaze Plus and belong to the downloadable theme pack
// `pack-storyplay-2026` (docs/THEME_PACKS.md), built like `pack-aurora-2026`.
// Styles and moods only: every motif is Glaze's own vector art (src/core/artwork.ts), never a known
// character, franchise, film, game, studio or team, and no names, logos or likenesses of them.
// Pure TS. Imports only types from themes.ts (themes.ts imports this file, so no runtime cycle).

import { iconArtOf, wallpaperArtOf, type ThemeArt } from './artwork.ts';
import type { IconBackground, IconShape } from './iconspec.ts';
import type { Theme, ThemeCategoryId } from './themes.ts';
import type { WallpaperParams } from './wallpaper.ts';

/** Pack that carries the seven Plus themes. */
export const STORYPLAY_PACK_ID = 'pack-storyplay-2026';
export const STORYPLAY_PACK_NAME = 'Story & Play';
export const STORYPLAY_ADDED_AT = '2026-10-22';

/** Which owner request group a theme answers (G5 b, c, d). */
export type StoryPlayGroup = 'games' | 'movie-night' | 'storybook';

type Def = {
  id: string;
  name: string;
  tagline: string;
  group: StoryPlayGroup;
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

const GROUP_OF = new Map<string, StoryPlayGroup>();

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
    addedAt: STORYPLAY_ADDED_AT,
  };
  if (plus) t.packId = STORYPLAY_PACK_ID;
  GROUP_OF.set(d.id, d.group);
  return t;
}

// ------------------------------------------------------------ free (bundled)

export const STORYPLAY_FREE_THEMES: readonly Theme[] = Object.freeze([
  make(
    {
      id: 'pixel-party',
      name: 'Pixel Party',
      tagline: 'Blocky critters, pixel hearts and coins worth collecting.',
      group: 'games',
      palette: ['#16123A', '#231D52', '#FFD23F', '#F7F3FF', '#16123A'],
      shape: 'square',
      background: { kind: 'solid', colour: '#FFD23F' },
      glyphSet: 'glaze',
      wallpaper: { kind: 'pattern', pattern: 'grid', colours: ['#16123A', '#211B55', '#3A2F86'], seed: 10401, angle: 180 },
      widget: { style: 'solid', font: 'display', accent: '#FF5C8A' },
      art: {
        colours: { primary: '#FF5C8A', secondary: '#3EC8F0', accent: '#FFD23F', ink: '#16123A', light: '#FFFFFF' },
        motifs: ['pixel-critter', 'pixel-heart', 'pixel-coin'],
        frame: 'double',
        frameRole: 'ink',
        texture: 'gingham',
        textureRole: 'light',
        stickers: [{ motif: 'pixel-heart', corner: 'br', scale: 0.24, rotation: 0 }],
        composition: 'tiled',
        displayFont: 'mono',
      },
      categories: ['retro', 'cute', 'neon'],
      tags: ['games', 'arcade', 'pixel', '8-bit', 'retro', 'coins', 'hearts'],
    },
    false,
  ),
  make(
    {
      id: 'little-acre',
      name: 'Little Acre',
      tagline: 'A red barn, golden wheat and mushrooms after the rain.',
      group: 'games',
      palette: ['#FBF4E4', '#FFFFFF', '#C8553D', '#3B2A1A', '#FFFFFF'],
      shape: 'rounded',
      background: { kind: 'solid', colour: '#B04A36' },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#FFF6E0', '#F6E3B8', '#E9CF8E'], seed: 10404, angle: 180, grain: 0.08 },
      widget: { style: 'solid', font: 'body', accent: '#C8553D' },
      art: {
        colours: { primary: '#C8553D', secondary: '#5E8C4A', accent: '#E8B64C', ink: '#3B2A1A', light: '#FFF8EC' },
        motifs: ['barn', 'wheat', 'mushroom'],
        frame: 'stitched',
        frameRole: 'light',
        texture: 'linen',
        textureRole: 'ink',
        stickers: [{ motif: 'wheat', corner: 'br', scale: 0.26, rotation: 0 }],
        composition: 'ground',
        displayFont: 'rounded',
      },
      categories: ['nature', 'cute', 'pastel'],
      tags: ['games', 'farm', 'cosy', 'cozy', 'barn', 'wheat', 'harvest', 'countryside'],
    },
    false,
  ),
  make(
    {
      id: 'midnight-munchers',
      name: 'Midnight Munchers',
      tagline: 'Round little monsters with one tooth and a tub of popcorn.',
      group: 'movie-night',
      palette: ['#1B1033', '#2A1A4A', '#9BE15D', '#F5EEFF', '#1B1033'],
      shape: 'blob',
      background: { kind: 'solid', colour: '#9BE15D' },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#1B1033', '#33205E', '#4B2A7A', '#140C26'], seed: 10408, angle: 190, grain: 0.12 },
      widget: { style: 'glass', font: 'display', accent: '#9BE15D' },
      art: {
        colours: { primary: '#8E6CFF', secondary: '#9BE15D', accent: '#FFC94A', ink: '#1B1033', light: '#FFFFFF' },
        motifs: ['monster', 'popcorn', 'star'],
        frame: 'scalloped',
        frameRole: 'ink',
        texture: 'polka',
        textureRole: 'light',
        stickers: [{ motif: 'monster', corner: 'br', scale: 0.3, rotation: -8 }],
        composition: 'scatter',
        displayFont: 'rounded',
      },
      categories: ['cute', 'dark', 'seasonal'],
      tags: ['movie night', 'monster', 'halloween', 'spooky', 'cute', 'popcorn', 'october'],
    },
    false,
  ),
  make(
    {
      id: 'cape-and-bolt',
      name: 'Cape & Bolt',
      tagline: 'Our own winged emblem, comic halftone and a lightning flash.',
      group: 'movie-night',
      palette: ['#FFF7E0', '#FFFFFF', '#E23B3B', '#1A1F4A', '#FFFFFF'],
      shape: 'squircle',
      background: { kind: 'gradient', from: '#2346C8', to: '#1A2F8F', angle: 160 },
      glyphSet: 'glaze',
      wallpaper: { kind: 'pattern', pattern: 'dots', colours: ['#FFD43B', '#FFE680', '#E23B3B'], seed: 10409, angle: 180 },
      widget: { style: 'solid', font: 'display', accent: '#E23B3B' },
      art: {
        colours: { primary: '#E23B3B', secondary: '#2346C8', accent: '#FFD43B', ink: '#1A1F4A', light: '#FFFFFF' },
        motifs: ['hero-emblem', 'comic-burst', 'lightning'],
        frame: 'double',
        frameRole: 'accent',
        texture: 'polka',
        textureRole: 'light',
        stickers: [{ motif: 'comic-burst', corner: 'tl', scale: 0.24, rotation: 0 }],
        composition: 'corners',
        displayFont: 'display',
      },
      categories: ['retro', 'neon'],
      tags: ['movie night', 'superhero', 'hero', 'comic', 'cape', 'lightning', 'halftone'],
    },
    false,
  ),
  make(
    {
      id: 'storybook-castle',
      name: 'Storybook Castle',
      tagline: 'Turrets, pennants and a sky full of wishes.',
      group: 'storybook',
      palette: ['#F3F0FF', '#FFFFFF', '#7B6CE0', '#2A2350', '#FFFFFF'],
      shape: 'rounded',
      background: { kind: 'gradient', from: '#6E5FD6', to: '#5244B8', angle: 170 },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#E9E4FF', '#F6DDF0', '#FFF1E0'], seed: 10410, angle: 180, grain: 0.06 },
      widget: { style: 'glass', font: 'display', accent: '#7B6CE0' },
      art: {
        colours: { primary: '#F06C9B', secondary: '#7B6CE0', accent: '#FFC94A', ink: '#2A2350', light: '#FFFFFF' },
        motifs: ['castle', 'star', 'cloud'],
        frame: 'lace',
        frameRole: 'light',
        texture: 'speckle',
        textureRole: 'light',
        stickers: [{ motif: 'star', corner: 'tr', scale: 0.2, rotation: 0 }],
        composition: 'sky',
        displayFont: 'script',
      },
      categories: ['cute', 'pastel'],
      tags: ['kids', 'storybook', 'fairy tale', 'castle', 'princess', 'magic'],
    },
    false,
  ),
  make(
    {
      id: 'woodland-friends',
      name: 'Woodland Friends',
      tagline: 'A fox, an owl and a hedgehog under the oak leaves.',
      group: 'storybook',
      palette: ['#F6F1E7', '#FFFFFF', '#C9692C', '#33261A', '#FFFFFF'],
      shape: 'squircle',
      background: { kind: 'solid', colour: '#A2552A' },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#F3EBDA', '#E6D8BC', '#D9E3C8', '#F6F1E7'], seed: 10413, angle: 170, grain: 0.1 },
      widget: { style: 'solid', font: 'body', accent: '#C9692C' },
      art: {
        colours: { primary: '#E07A3A', secondary: '#7A5A3A', accent: '#E9B44C', ink: '#33261A', light: '#FFF8EE' },
        motifs: ['fox-face', 'owl-face', 'hedgehog', 'leaf'],
        frame: 'stitched',
        frameRole: 'accent',
        texture: 'speckle',
        textureRole: 'ink',
        stickers: [{ motif: 'leaf', corner: 'tr', scale: 0.24, rotation: 20 }],
        composition: 'ground',
        displayFont: 'rounded',
      },
      categories: ['nature', 'cute'],
      tags: ['kids', 'storybook', 'woodland', 'fox', 'owl', 'hedgehog', 'forest', 'autumn'],
    },
    false,
  ),
]);

// ------------------------------------------------------------ Plus (pack-storyplay-2026)

export const STORYPLAY_PLUS_THEMES: readonly Theme[] = Object.freeze([
  make(
    {
      id: 'neon-circuit',
      name: 'Neon Circuit',
      tagline: 'A glowing grid horizon and a bolt of cyan.',
      group: 'games',
      palette: ['#080B1F', '#121838', '#22F0FF', '#E9FDFF', '#080B1F'],
      shape: 'rounded',
      background: { kind: 'gradient', from: '#22F0FF', to: '#B04DFF', angle: 135 },
      glyphSet: 'glaze',
      wallpaper: { kind: 'mesh', colours: ['#080B1F', '#1A1450', '#3B0F6B', '#0A2A4A'], seed: 10402, angle: 200, grain: 0.1 },
      widget: { style: 'outline', font: 'display', accent: '#22F0FF' },
      art: {
        colours: { primary: '#22F0FF', secondary: '#B04DFF', accent: '#FF3DCB', ink: '#080B1F', light: '#E9FDFF' },
        motifs: ['neon-grid', 'lightning', 'sparkle'],
        frame: 'stitched',
        frameRole: 'ink',
        texture: 'speckle',
        textureRole: 'light',
        stickers: [{ motif: 'lightning', corner: 'tr', scale: 0.22, rotation: 10 }],
        composition: 'ground',
        displayFont: 'mono',
      },
      categories: ['neon', 'dark', 'retro'],
      tags: ['games', 'cyber', 'neon', 'grid', 'future', 'synth'],
    },
    true,
  ),
  make(
    {
      id: 'questing-crest',
      name: 'Questing Crest',
      tagline: 'Sword, shield and a potion for the long road.',
      group: 'games',
      palette: ['#14110E', '#221C16', '#D9A441', '#F5ECD9', '#F5ECD9'],
      shape: 'squircle',
      background: { kind: 'gradient', from: '#6A2431', to: '#3A1219', angle: 170 },
      glyphSet: 'feather',
      wallpaper: { kind: 'grain', colours: ['#14110E', '#2B1D14', '#4A2A1A'], seed: 10403, angle: 180, grain: 0.3 },
      widget: { style: 'solid', font: 'display', accent: '#D9A441' },
      art: {
        colours: { primary: '#8E2A3B', secondary: '#2F4A7A', accent: '#D9A441', ink: '#14110E', light: '#E8E2D6' },
        motifs: ['sword-shield', 'potion', 'gem'],
        frame: 'double',
        frameRole: 'accent',
        texture: 'linen',
        textureRole: 'ink',
        stickers: [{ motif: 'gem', corner: 'tl', scale: 0.2, rotation: 0 }],
        composition: 'corners',
        displayFont: 'serif',
      },
      categories: ['dark', 'luxury', 'retro'],
      tags: ['games', 'fantasy', 'quest', 'rpg', 'sword', 'shield', 'potion', 'medieval'],
    },
    true,
  ),
  make(
    {
      id: 'chequered-dash',
      name: 'Chequered Dash',
      tagline: 'Speed stripes, a chequered flag and a podium finish.',
      group: 'games',
      palette: ['#F4F4F2', '#FFFFFF', '#E63329', '#151515', '#FFFFFF'],
      shape: 'squircle',
      background: { kind: 'gradient', from: '#E03128', to: '#B81F18', angle: 160 },
      glyphSet: 'glaze',
      wallpaper: { kind: 'pattern', pattern: 'checker', colours: ['#F4F4F2', '#E4E4E0', '#151515'], seed: 10405, angle: 180 },
      widget: { style: 'solid', font: 'display', accent: '#E63329' },
      art: {
        colours: { primary: '#E63329', secondary: '#1F3FAE', accent: '#FFC531', ink: '#151515', light: '#FFFFFF' },
        motifs: ['chequered-flag', 'speed-stripes', 'trophy'],
        frame: 'ribbon',
        frameRole: 'light',
        texture: 'stripes',
        textureRole: 'ink',
        stickers: [{ motif: 'chequered-flag', corner: 'tr', scale: 0.24, rotation: 0 }],
        composition: 'scatter',
        displayFont: 'display',
      },
      categories: ['retro'],
      tags: ['games', 'racing', 'cars', 'speed', 'chequered flag', 'checkered', 'trophy'],
    },
    true,
  ),
  make(
    {
      id: 'deep-orbit',
      name: 'Deep Orbit',
      tagline: 'Rockets, ringed planets and a long night of stars.',
      group: 'movie-night',
      palette: ['#0A0E24', '#141A3A', '#7FD1FF', '#EAF6FF', '#0A0E24'],
      shape: 'circle',
      background: { kind: 'gradient', from: '#7FD1FF', to: '#9C8BFF', angle: 150 },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#0A0E24', '#1B1F55', '#3A2470', '#0B2742'], seed: 10406, angle: 190, grain: 0.12 },
      widget: { style: 'glass', font: 'body', accent: '#7FD1FF' },
      art: {
        colours: { primary: '#FF7A59', secondary: '#3949AB', accent: '#FFD36E', ink: '#0A0E24', light: '#F4F7FF' },
        motifs: ['rocket', 'planet', 'star'],
        frame: 'none',
        frameRole: 'light',
        texture: 'starfield',
        textureRole: 'light',
        stickers: [{ motif: 'rocket', corner: 'br', scale: 0.28, rotation: 0 }],
        composition: 'sky',
        displayFont: 'display',
      },
      categories: ['dark', 'neon'],
      tags: ['movie night', 'sci-fi', 'space', 'rocket', 'planet', 'stars', 'film'],
    },
    true,
  ),
  make(
    {
      id: 'after-rain',
      name: 'After Rain',
      tagline: 'Blind-slat shadows, rain on the glass, one lamp still lit.',
      group: 'movie-night',
      palette: ['#0E0E10', '#1A1A1E', '#E8C987', '#EDEAE4', '#EDEAE4'],
      shape: 'square',
      background: { kind: 'solid', colour: '#26262B' },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#0E0E10', '#1E1E24', '#34343C'], seed: 10407, angle: 160, grain: 0.3 },
      widget: { style: 'outline', font: 'display', accent: '#E8C987' },
      art: {
        colours: { primary: '#2C3A4A', secondary: '#4A4A52', accent: '#E8C987', ink: '#0E0E10', light: '#D9D6CF' },
        motifs: ['blinds', 'rain-window', 'droplet'],
        frame: 'none',
        frameRole: 'light',
        texture: 'linen',
        textureRole: 'ink',
        stickers: [{ motif: 'droplet', corner: 'tr', scale: 0.18, rotation: 0 }],
        composition: 'tiled',
        displayFont: 'serif',
      },
      categories: ['dark', 'minimal', 'retro'],
      tags: ['movie night', 'noir', 'detective', 'rain', 'black and white', 'mystery', 'film'],
    },
    true,
  ),
  make(
    {
      id: 'tiara-and-gown',
      name: 'Tiara & Gown',
      tagline: 'A crown, a twirling gown and a sprinkle of sparkle.',
      group: 'storybook',
      palette: ['#FFF0F6', '#FFFFFF', '#D94F8C', '#3D1430', '#FFFFFF'],
      shape: 'circle',
      background: { kind: 'solid', colour: '#C2417C' },
      glyphSet: 'feather',
      wallpaper: { kind: 'mesh', colours: ['#FFE0EE', '#FFF4F9', '#F2E0FF', '#FFE9D6'], seed: 10411, angle: 160, grain: 0.05 },
      widget: { style: 'solid', font: 'display', accent: '#D94F8C' },
      art: {
        colours: { primary: '#F49AC1', secondary: '#B9A3F5', accent: '#F2C14E', ink: '#3D1430', light: '#FFFFFF' },
        motifs: ['crown', 'gown', 'sparkle', 'heart'],
        frame: 'ribbon',
        frameRole: 'accent',
        texture: 'wash',
        textureRole: 'ink',
        stickers: [{ motif: 'crown', corner: 'tl', scale: 0.26, rotation: -12 }],
        composition: 'garland',
        displayFont: 'script',
      },
      categories: ['cute', 'pastel', 'luxury'],
      tags: ['kids', 'storybook', 'fairy tale', 'princess', 'crown', 'tiara', 'ball gown', 'pink'],
    },
    true,
  ),
  make(
    {
      id: 'ember-hatchling',
      name: 'Ember Hatchling',
      tagline: 'A small dragon, a warm glow and gems to guard.',
      group: 'storybook',
      palette: ['#EAF7F0', '#FFFFFF', '#2F9E77', '#123828', '#FFFFFF'],
      shape: 'blob',
      background: { kind: 'solid', colour: '#247A5C' },
      glyphSet: 'feather',
      wallpaper: { kind: 'gradient', colours: ['#DDF3E8', '#EAF7F0', '#FFF4DC'], seed: 10412, angle: 180, grain: 0.06 },
      widget: { style: 'solid', font: 'body', accent: '#2F9E77' },
      art: {
        colours: { primary: '#4CC38A', secondary: '#2F7FA6', accent: '#FFB547', ink: '#123828', light: '#FFFFFF' },
        motifs: ['dragon', 'gem', 'cloud'],
        frame: 'scalloped',
        frameRole: 'light',
        texture: 'speckle',
        textureRole: 'ink',
        stickers: [{ motif: 'dragon', corner: 'br', scale: 0.3, rotation: 0 }],
        composition: 'scatter',
        displayFont: 'rounded',
      },
      categories: ['cute', 'nature'],
      tags: ['kids', 'storybook', 'fairy tale', 'dragon', 'gems', 'green'],
    },
    true,
  ),
]);

/** Every theme added in T104, free first. */
export const STORYPLAY_THEMES: readonly Theme[] = Object.freeze([...STORYPLAY_FREE_THEMES, ...STORYPLAY_PLUS_THEMES]);

/** The owner-request group (G5 b games, c movie night, d storybook) of a T104 theme. */
export function storyPlayGroup(themeId: string): StoryPlayGroup | undefined {
  return GROUP_OF.get(themeId);
}
