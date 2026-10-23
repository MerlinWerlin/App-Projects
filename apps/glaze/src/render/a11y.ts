// VoiceOver / TalkBack descriptions for icons, e.g. "Spotify icon, squircle, purple gradient".
// The words come from the `iconsUi.a11y` catalogue, so the label follows the app language.
import { isHex, hexToHsl } from '../core/colour';
import type { IconBackground, IconShape } from '../core/iconspec';
import { t } from '../i18n';

export type ColourHue = 'black' | 'white' | 'grey' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';
export type ColourTone = 'dark' | 'light' | null;

/** Coarse colour bucket for a hex colour (null when it can't be read). Language-neutral. */
export function colourBucket(hex: string): { hue: ColourHue; tone: ColourTone } | null {
  if (!isHex(hex)) return null;
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.12) return { hue: 'black', tone: null };
  if (l > 0.92) return { hue: 'white', tone: null };
  if (s < 0.12) return { hue: 'grey', tone: null };
  const tone: ColourTone = l < 0.3 ? 'dark' : l > 0.78 ? 'light' : null;
  const hue: ColourHue =
    h < 15 || h >= 345
      ? 'red'
      : h < 40
        ? 'orange'
        : h < 65
          ? 'yellow'
          : h < 160
            ? 'green'
            : h < 195
              ? 'teal'
              : h < 255
                ? 'blue'
                : h < 290
                  ? 'purple'
                  : 'pink';
  return { hue, tone };
}

/** Coarse, speakable colour name for a hex colour in the app language ("" when it can't be read). */
export function colourName(hex: string): string {
  const b = colourBucket(hex);
  if (!b) return '';
  const colour = t(`iconsUi.a11y.colours.${b.hue}`);
  if (b.tone === 'dark') return t('iconsUi.a11y.dark', { colour });
  if (b.tone === 'light') return t('iconsUi.a11y.light', { colour });
  return colour;
}

function backgroundText(bg: IconBackground | undefined): string {
  if (!bg) return '';
  if (bg.kind === 'solid') return colourName(bg.colour);
  if (bg.kind === 'glass') {
    const n = colourName(bg.tint);
    return n ? t('iconsUi.a11y.glassTinted', { colour: n }) : t('iconsUi.a11y.glass');
  }
  const a = colourName(bg.from);
  const b = colourName(bg.to);
  if (!a && !b) return t('iconsUi.a11y.gradient');
  if (a === b || !b) return t('iconsUi.a11y.gradientOne', { colour: a });
  if (!a) return t('iconsUi.a11y.gradientOne', { colour: b });
  return t('iconsUi.a11y.gradientTwo', { from: a, to: b });
}

/** "Music icon, squircle, purple to pink gradient" (photo icons say "photo"), in the app language. */
export function iconAccessibilityLabel(spec: {
  label?: string;
  shape?: IconShape;
  background?: IconBackground;
  overrideImage?: string;
}): string {
  const label = spec.label?.trim() ?? '';
  const parts = [label.length > 0 ? t('iconsUi.a11y.named', { name: label }) : t('iconsUi.a11y.unnamed')];
  if (spec.shape) parts.push(t(`iconsUi.a11y.shapes.${spec.shape}`));
  const fill = spec.overrideImage ? t('iconsUi.a11y.photo') : backgroundText(spec.background);
  if (fill) parts.push(fill);
  return parts.join(t('iconsUi.a11y.separator'));
}
