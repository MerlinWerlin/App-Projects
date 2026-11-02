// T282 / T284 source guards: the photo frame and the habit streak widget (targets/widget). No Xcode
// here, so these pin the shape of the Swift: theme colours in every size, the photo-picker deep
// link to a route that exists, the streak widget's data, intent and bundle registration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const code = (src: string): string => src.replace(/\/\/.*$/gm, '');

test('T282 photo frame: themed mat, accent rule, rounded photo, date caption, all sizes', () => {
  const src = code(read('targets/widget/PhotoWidget.swift'));
  assert.match(src, /ThemeStore\.loadPhoto\(\)/);
  assert.match(src, /GlazeBackground\(theme: t\)/);
  assert.match(src, /strokeBorder\(t\.accentColor/);
  assert.match(src, /RoundedRectangle\(cornerRadius: m\.radius, style: \.continuous\)/);
  assert.match(src, /\.clipShape\(shape\)/);
  assert.match(src, /Text\(entry\.date, format: \.dateTime/);
  assert.match(src, /Text\("Choose a photo in Glaze"\)/);
  assert.match(src, /t\.typeface\(/);
  assert.match(src, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.systemLarge\]\)/);
  assert.match(src, /provider: DayProvider\(\)/);
  assert.doesNotMatch(src, /\bt\.name\b|theme\.name\b/);
  assert.doesNotMatch(src, /\w!\.|as!/, 'no force unwraps');
});

test('T282 photo frame deep link opens Widget Studio on the photo widget in the active theme', () => {
  const src = code(read('targets/widget/PhotoWidget.swift'));
  assert.match(src, /\.widgetURL\(PhotoWidgetLink\.studio\(themeId: t\.themeId, family: family\)\)/);
  assert.match(src, /c\.scheme = "glaze"/);
  assert.match(src, /c\.host = "widget-studio"/);
  for (const q of ['theme', 'kind', 'size']) assert.match(src, new RegExp(`URLQueryItem\\(name: "${q}"`));
  assert.match(src, /value: "photo"/);
  const app = JSON.parse(read('app.json')) as { expo: { scheme: string } };
  assert.equal(app.expo.scheme, 'glaze');
  assert.ok(existsSync(join(root, 'app/widget-studio.tsx')));
  const studio = read('app/widget-studio.tsx');
  assert.match(studio, /useLocalSearchParams<\{ theme\?: string; kind\?: string; size\?: string \}>/);
  // The photo widget's saved-design kind is "photo" (GlazeDesignedWidget), which Studio edits.
  assert.match(code(read('targets/widget/PhotoWidget.swift')), /GlazeDesignedWidget\(kind: "photo"/);
});

test('T284 streak summary mirrors habitStreak: 7 ticks, goal / logged rule, today only once met', () => {
  const store = code(read('targets/widget/HabitStore.swift'));
  assert.match(store, /static func streakSummary\(_ kind: HabitKindID, days: Int = 7, now: Date = Date\(\)\) -> StreakSummary/);
  assert.match(store, /if HabitDef\.of\(kind\)\.mode == \.scale \{ return true \}/);
  assert.match(store, /return value >= \(goal \?\? 1\)/);
  assert.match(store, /var streak = met\(kind, value: todayValue, goal: goal\) \? 1 : 0/);
  assert.match(store, /while streak <= historyDays && met\(/);
  assert.match(store, /for e in pending\(readLog\(\), mark\) where e\.kind == kind/);
});

test('T284 tick intent: set tap to the goal (mood: okay), never undoes a met day, reloads the streak', () => {
  const intents = code(read('targets/widget/HabitIntents.swift'));
  assert.match(intents, /struct TickHabitIntent: AppIntent/);
  assert.match(intents, /if !HabitStore\.met\(kind, value: today, goal: goal\)/);
  assert.match(intents, /HabitStore\.record\(kind, setTo: 3, now: now\)/);
  assert.match(intents, /HabitStore\.record\(kind, setTo: goal \?\? HabitDef\.of\(kind\)\.step, now: now\)/);
  assert.match(intents, /static let streak = "GlazeHabitStreak"/);
  assert.match(intents, /reloadTimelines\(ofKind: streak\)/);
  const bridge = read('modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /habitWidgetKinds = \[[^\]]*"GlazeHabitStreak"/);
});

test('T284 streak widget: themed, all sizes, tick button, preview, nested habit bundle', () => {
  const src = code(read('targets/widget/HabitStreakWidget.swift'));
  assert.match(src, /AppIntentConfiguration\(kind: HabitWidgetKinds\.streak, intent: HabitStreakConfigIntent\.self/);
  assert.match(src, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.systemLarge\]\)/);
  assert.match(src, /\.containerBackground\(for: \.widget\) \{ GlazeBackground\(theme: t\) \}/);
  assert.match(src, /Button\(intent: TickHabitIntent\(habit: habit\)\)/);
  assert.match(src, /HabitStore\.streakSummary\(kind, days: 7, now: now\)/);
  assert.match(src, /sample: context\.isPreview/);
  assert.match(src, /func placeholder\(in context: Context\) -> HabitStreakEntry \{\s*entry\(/);
  assert.match(src, /ThemeStore\.load\(\)/);
  assert.doesNotMatch(src, /\.fallback\b/);
  assert.doesNotMatch(src, /\bt\.name\b|theme\.name\b/);
  assert.doesNotMatch(src, /as!|\w!\./);
  // Every visible string goes through HabitText / HabitStreakText (localised), none inline.
  for (const m of src.matchAll(/Text\(\s*"/g)) assert.fail(`inline Text literal at ${m.index}`);
  const bundle = code(read('targets/widget/GlazeWidgetsBundle.swift'));
  const habitBlock = bundle.slice(bundle.indexOf('struct GlazeHabitWidgetsBundle'));
  assert.match(habitBlock.slice(0, habitBlock.indexOf('\n}')), /^\s*HabitStreakWidget\(\)\s*$/m);
});
