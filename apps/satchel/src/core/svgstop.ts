// 1.0.0: react-native-svg gradient stops on the new architecture ignore the alpha inside an rgba() stopColor (the trip
// cover scrim drew as a solid block). Split a colour token into an opaque stopColor and a stopOpacity instead.

export type SvgStop = { stopColor: string; stopOpacity: number };

/** 'rgba(12, 20, 40, 0.5)' -> { stopColor: 'rgb(12,20,40)', stopOpacity: 0.5 }; any other colour stays opaque. */
export function stopOf(colour: string): SvgStop {
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(String(colour ?? '').trim());
  if (!m) return { stopColor: colour, stopOpacity: 1 };
  const a = m[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(m[4])));
  return { stopColor: `rgb(${m[1]},${m[2]},${m[3]})`, stopOpacity: Number.isFinite(a) ? a : 1 };
}
