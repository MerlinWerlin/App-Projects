/** PillButton colours per variant and tone (market-1018 M3). Pure TS, tested in Node. */
import { pickReadable, type DesignPalette } from '../../theme/design';

export type PillVariant = 'filled' | 'tinted' | 'plain';
export type PillTone = 'accent' | 'destructive';

export function pillColors(p: DesignPalette, variant: PillVariant, tone: PillTone): { bg: string; ink: string } {
  if (tone === 'destructive') {
    if (variant === 'filled') return { bg: p.destructive, ink: pickReadable(['#FFFFFF', '#111418'], p.destructive) };
    return { bg: variant === 'tinted' ? p.fill : 'transparent', ink: p.destructive };
  }
  if (variant === 'filled') return { bg: p.tint, ink: p.tintInk };
  if (variant === 'tinted') return { bg: p.tintedFill, ink: p.tintedLabel };
  return { bg: 'transparent', ink: p.tintLabel };
}
