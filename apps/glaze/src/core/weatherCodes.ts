// owner-1102b T281: WMO weather interpretation codes (Open-Meteo `weather_code`) to SF Symbols, plus
// the Open-Meteo request the Weather widget makes. Pure data; the widget extension has a Swift mirror
// (targets/widget/WeatherCodes.swift) and weatherCodes.test.ts checks the two are identical.
//
// Open-Meteo (https://open-meteo.com) data is CC BY 4.0: credit "Weather data by Open-Meteo.com"
// (docs/LICENSES.md, docs/privacy.html). Codes: https://open-meteo.com/en/docs ("WMO Weather
// interpretation codes").

/** [WMO code, day symbol, night symbol]. Every symbol exists in SF Symbols 2 (iOS 14+). */
export const WEATHER_CODE_SYMBOLS: ReadonlyArray<readonly [number, string, string]> = [
  [0, 'sun.max.fill', 'moon.stars.fill'],
  [1, 'sun.max.fill', 'moon.stars.fill'],
  [2, 'cloud.sun.fill', 'cloud.moon.fill'],
  [3, 'cloud.fill', 'cloud.fill'],
  [45, 'cloud.fog.fill', 'cloud.fog.fill'],
  [48, 'cloud.fog.fill', 'cloud.fog.fill'],
  [51, 'cloud.drizzle.fill', 'cloud.drizzle.fill'],
  [53, 'cloud.drizzle.fill', 'cloud.drizzle.fill'],
  [55, 'cloud.drizzle.fill', 'cloud.drizzle.fill'],
  [56, 'cloud.sleet.fill', 'cloud.sleet.fill'],
  [57, 'cloud.sleet.fill', 'cloud.sleet.fill'],
  [61, 'cloud.rain.fill', 'cloud.rain.fill'],
  [63, 'cloud.rain.fill', 'cloud.rain.fill'],
  [65, 'cloud.heavyrain.fill', 'cloud.heavyrain.fill'],
  [66, 'cloud.sleet.fill', 'cloud.sleet.fill'],
  [67, 'cloud.sleet.fill', 'cloud.sleet.fill'],
  [71, 'cloud.snow.fill', 'cloud.snow.fill'],
  [73, 'cloud.snow.fill', 'cloud.snow.fill'],
  [75, 'snowflake', 'snowflake'],
  [77, 'snowflake', 'snowflake'],
  [80, 'cloud.sun.rain.fill', 'cloud.moon.rain.fill'],
  [81, 'cloud.rain.fill', 'cloud.rain.fill'],
  [82, 'cloud.heavyrain.fill', 'cloud.heavyrain.fill'],
  [85, 'cloud.snow.fill', 'cloud.snow.fill'],
  [86, 'cloud.snow.fill', 'cloud.snow.fill'],
  [95, 'cloud.bolt.rain.fill', 'cloud.bolt.rain.fill'],
  [96, 'cloud.hail.fill', 'cloud.hail.fill'],
  [99, 'cloud.hail.fill', 'cloud.hail.fill'],
];

/** Shown for a code outside the table (Open-Meteo may add codes). */
export const WEATHER_UNKNOWN_SYMBOL = 'cloud.fill';

/** SF Symbol for a WMO code; `isDay` false picks the night variant. Unknown codes get a plain cloud. */
export function weatherSymbol(code: number, isDay = true): string {
  const row = WEATHER_CODE_SYMBOLS.find(([c]) => c === code);
  if (!row) return WEATHER_UNKNOWN_SYMBOL;
  return isDay ? row[1] : row[2];
}

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fields requested (same literal in WeatherCodes.swift). Unix times, local timezone, two days so the
 * hourly row of the large widget still has entries late in the evening.
 */
export const OPEN_METEO_QUERY =
  'current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto&timeformat=unixtime';

/** Coordinates are rounded to 2 decimals (about 1 km) before they leave the device. */
export function roundCoordinate(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  const r = Math.round(value * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toFixed(2);
}

/** The exact URL the widget fetches. `fahrenheit` adds `&temperature_unit=fahrenheit`. */
export function openMeteoUrl(lat: number, lon: number, fahrenheit: boolean): string {
  const unit = fahrenheit ? '&temperature_unit=fahrenheit' : '';
  return `${OPEN_METEO_ENDPOINT}?latitude=${roundCoordinate(lat)}&longitude=${roundCoordinate(lon)}&${OPEN_METEO_QUERY}${unit}`;
}
