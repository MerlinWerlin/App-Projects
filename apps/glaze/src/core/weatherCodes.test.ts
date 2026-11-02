// owner-1102b T280 + T281: WMO code table (TS and its Swift mirror), the Open-Meteo request, and
// source guards for the Next event and Weather widgets (permissions, config, privacy docs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OPEN_METEO_ENDPOINT,
  OPEN_METEO_QUERY,
  WEATHER_CODE_SYMBOLS,
  WEATHER_UNKNOWN_SYMBOL,
  openMeteoUrl,
  roundCoordinate,
  weatherSymbol,
} from './weatherCodes.ts';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const code = (src: string): string => src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// All WMO codes Open-Meteo documents.
const WMO = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

test('every documented WMO code has a day and night symbol, once, in order', () => {
  assert.deepEqual(WEATHER_CODE_SYMBOLS.map(([c]) => c), WMO);
  for (const [c, day, night] of WEATHER_CODE_SYMBOLS) {
    assert.match(day, /^[a-z.]+$/, `${c} day`);
    assert.match(night, /^[a-z.]+$/, `${c} night`);
  }
});

test('weatherSymbol: day / night variants and unknown codes', () => {
  assert.equal(weatherSymbol(0), 'sun.max.fill');
  assert.equal(weatherSymbol(0, false), 'moon.stars.fill');
  assert.equal(weatherSymbol(2, false), 'cloud.moon.fill');
  assert.equal(weatherSymbol(65), 'cloud.heavyrain.fill');
  assert.equal(weatherSymbol(75), 'snowflake');
  assert.equal(weatherSymbol(95), 'cloud.bolt.rain.fill');
  assert.equal(weatherSymbol(99, false), 'cloud.hail.fill');
  assert.equal(weatherSymbol(4), WEATHER_UNKNOWN_SYMBOL);
  assert.equal(weatherSymbol(-1), WEATHER_UNKNOWN_SYMBOL);
  assert.equal(weatherSymbol(Number.NaN), WEATHER_UNKNOWN_SYMBOL);
});

test('Swift mirror (targets/widget/WeatherCodes.swift) has the identical table, fallback and request', () => {
  const swift = code(read('targets/widget/WeatherCodes.swift'));
  const rows = [...swift.matchAll(/^\s*\((\d+), "([a-z.]+)", "([a-z.]+)"\),\s*$/gm)].map((m) => [Number(m[1]), m[2], m[3]]);
  assert.deepEqual(rows, WEATHER_CODE_SYMBOLS.map((r) => [...r]));
  assert.ok(swift.includes(`static let unknownSymbol = "${WEATHER_UNKNOWN_SYMBOL}"`));
  // (raw source: code() would cut string literals at `//`)
  const raw = read('targets/widget/WeatherCodes.swift');
  assert.ok(raw.includes(`static let endpoint = "${OPEN_METEO_ENDPOINT}"`));
  assert.ok(raw.includes(`static let query = "${OPEN_METEO_QUERY}"`));
  assert.match(swift, /String\(format: "%\.2f"/, 'coordinates rounded to 2 decimals');
  assert.match(swift, /&temperature_unit=fahrenheit/);
});

test('Open-Meteo URL: rounded coordinates, no key, unit only for Fahrenheit', () => {
  assert.equal(roundCoordinate(-33.86882), '-33.87');
  assert.equal(roundCoordinate(151.20929), '151.21');
  assert.equal(roundCoordinate(-0.001), '0.00');
  assert.equal(roundCoordinate(Number.NaN), '0.00');
  const metric = openMeteoUrl(-33.86882, 151.20929, false);
  assert.equal(metric, `https://api.open-meteo.com/v1/forecast?latitude=-33.87&longitude=151.21&${OPEN_METEO_QUERY}`);
  assert.doesNotMatch(metric, /apikey|key=|temperature_unit/);
  assert.match(openMeteoUrl(40.7128, -74.006, true), /latitude=40\.71&longitude=-74\.01&.*&temperature_unit=fahrenheit$/);
  for (const field of ['temperature_2m', 'weather_code', 'is_day', 'temperature_2m_max', 'temperature_2m_min', 'timeformat=unixtime']) {
    assert.ok(OPEN_METEO_QUERY.includes(field), field);
  }
});

// ---- widget extension guards ----

const BUNDLE = 'targets/widget/GlazeWidgetsBundle.swift';
const CAL = 'targets/widget/CalendarEventWidget.swift';
const WEATHER = 'targets/widget/WeatherWidget.swift';
const BRIDGE = 'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift';

test('data widgets live in their own nested bundle, added with one line', () => {
  const nested = code(read('targets/widget/DataWidgetsBundle.swift'));
  assert.match(nested, /struct GlazeDataWidgetsBundle: WidgetBundle \{\s*var body: some Widget \{\s*CalendarEventWidget\(\)\s*WeatherWidget\(\)\s*\}/);
  assert.equal((code(read(BUNDLE)).match(/^\s*GlazeDataWidgetsBundle\(\)\.body\s*$/gm) ?? []).length, 1);
});

test('calendar widget: EventKit full access only, themed no-access state that opens Glaze', () => {
  const src = code(read(CAL));
  assert.match(src, /EKEventStore\.authorizationStatus\(for: \.event\) == \.fullAccess/);
  // The extension never asks (a widget can't show a prompt).
  assert.doesNotMatch(src, /requestFullAccessToEvents|requestAccess\(to:/);
  assert.match(src, /Text\("Open Glaze to show your next event"\)/);
  assert.match(read(CAL), /URL\(string: "glaze:\/\/widget-access\?kind=calendar"\)/);
  assert.match(src, /\.widgetURL\(GlazeCalendarReader\.accessURL\)/);
  assert.match(src, /policy: \.after\(refresh\)/);
  assert.match(src, /addingTimeInterval\(30 \* 60\)/);
  // Gallery shows sample events in the theme, not real data and not the theme name.
  assert.match(src, /context\.isPreview/);
  assert.doesNotMatch(src, /theme\.name|t\.name/);
  assert.match(src, /\.containerBackground\(for: \.widget\) \{ GlazeBackground\(theme: t\) \}/);
  assert.match(src, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.systemLarge\]\)/);
});

test('weather widget: widget location or app-stored rounded coords, Open-Meteo only, cache, credit', () => {
  const src = code(read(WEATHER));
  assert.match(src, /isAuthorizedForWidgetUpdates/);
  assert.doesNotMatch(src, /requestWhenInUseAuthorization|requestAlwaysAuthorization/);
  assert.match(src, /GlazeWeatherCodes\.url\(lat: lat, lon: lon, fahrenheit: fahrenheit\)/);
  // The only URL the extension builds is the Open-Meteo one.
  const urls = [...read(WEATHER).matchAll(/"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(urls, []);
  assert.equal((src.match(/URLSession\.shared\.dataTask/g) ?? []).length, 1);
  assert.match(src, /Locale\.current\.measurementSystem == \.us/);
  assert.match(src, /static let cacheKey = "glaze\.weather\.cache\.v1"/);
  assert.match(src, /static let coordsKey = "glaze\.weather\.coords\.v1"/);
  assert.match(src, /UserDefaults\(suiteName: GlazeShared\.appGroup\)/);
  assert.match(src, /addingTimeInterval\(45 \* 60\)/);
  assert.match(src, /Text\("Open Glaze to set weather"\)/);
  assert.match(src, /Text\("Weather data by Open-Meteo\.com"\)/);
  assert.match(read(WEATHER), /URL\(string: "glaze:\/\/widget-access\?kind=weather"\)/);
  assert.doesNotMatch(src, /theme\.name|t\.name/);
  assert.match(src, /\.containerBackground\(for: \.widget\) \{ GlazeBackground\(theme: t\) \}/);
  assert.match(src, /context\.isPreview/);
});

test('bridge asks for access; app stores only rounded coordinates; adapter never throws', () => {
  const bridge = code(read(BRIDGE));
  for (const fn of ['calendarAccessStatus', 'requestCalendarAccess', 'locationAccessStatus', 'requestLocationAccess']) {
    assert.match(bridge, new RegExp(`AsyncFunction\\("${fn}"\\)`), fn);
  }
  assert.match(bridge, /requestFullAccessToEvents/);
  assert.match(bridge, /requestWhenInUseAuthorization\(\)/);
  assert.doesNotMatch(bridge, /requestAlwaysAuthorization/);
  assert.match(bridge, /String\(format: "%\.2f,%\.2f"/);
  assert.match(bridge, /private let weatherCoordsKey = "glaze\.weather\.coords\.v1"/);
  assert.doesNotMatch(bridge, /URLSession/, 'the app itself never sends the location');
  assert.match(read('modules/glaze-widget-bridge/ios/GlazeWidgetBridge.podspec'), /s\.frameworks = 'WidgetKit', 'EventKit', 'CoreLocation'/);

  const adapter = read('src/native/widgets.ts');
  const fn = adapter.slice(adapter.indexOf('export async function dataWidgetAccess'));
  assert.match(fn, /return 'unavailable'/);
  assert.match(fn, /catch \{\s*return 'unavailable';/);
  assert.match(adapter, /requireOptionalNativeModule/);
  const screen = read('app/widget-access.tsx');
  assert.match(screen, /dataWidgetAccess\(kind, false\)/, 'opening the screen only reads the status');
  assert.match(screen, /dataWidgetAccess\(kind, true\)/);
  assert.doesNotMatch(screen, /expo-calendar|expo-location/);
  assert.match(read('app/_layout.tsx'), /<Stack\.Screen name="widget-access"/);
});

test('config: usage strings only in the native piece; extension frameworks and NSWidgetWantsLocation', () => {
  const piece = JSON.parse(read('native-plugins/datawidgets.json')) as { infoPlist: Record<string, string>; plugins?: unknown };
  assert.deepEqual(Object.keys(piece), ['infoPlist']);
  assert.deepEqual(Object.keys(piece.infoPlist).sort(), ['NSCalendarsFullAccessUsageDescription', 'NSCalendarsUsageDescription', 'NSLocationWhenInUseUsageDescription']);
  for (const v of Object.values(piece.infoPlist)) assert.ok(v.length > 40);
  assert.match(piece.infoPlist.NSLocationWhenInUseUsageDescription, /Open-Meteo/);
  // The non-native config (Expo Go / plain production) never asks for these.
  const app = read('app.json');
  assert.doesNotMatch(app, /NSCalendars|NSLocation/);
  assert.doesNotMatch(read('package.json'), /expo-calendar|expo-location/);
  const target = read('targets/widget/expo-target.config.js');
  assert.match(target, /frameworks: \['SwiftUI', 'WidgetKit', 'AppIntents', 'EventKit', 'CoreLocation'\]/);
  assert.match(target, /NSWidgetWantsLocation: true/);
  assert.doesNotMatch(target, /NSLocationAlways/);
});

test('privacy, review, store and licence docs describe calendar + weather', () => {
  const privacy = read('docs/privacy.html');
  assert.match(privacy, /Open-Meteo/);
  assert.match(privacy, /calendar/i);
  assert.match(privacy, /CC BY 4\.0/);
  assert.equal(read('docs/site/privacy.html'), privacy);
  assert.match(read('docs/LICENSES.md'), /Open-Meteo[\s\S]*CC BY 4\.0/);
  const review = read('docs/REVIEW_NOTES.md');
  assert.match(review, /Next event/);
  assert.match(review, /Open-Meteo/);
  const paste = review.match(/```text\n([\s\S]*?)\n```/);
  assert.ok(paste && paste[1].length <= 4000, 'review-notes paste block stays within 4,000 characters');
  assert.match(paste?.[1] ?? '', /CALENDAR AND LOCATION/);
  assert.match(read('docs/STORE.md'), /Open-Meteo|weather/i);
  assert.match(read('ops/CONVENTIONS.md'), /Open-Meteo/);
  assert.match(read('docs/RELEASE_CHECKLIST.md'), /Open-Meteo/);
});
