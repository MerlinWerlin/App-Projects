// Habit streak ticks (T284): the last 7 days as ticks, the current streak, and a tap-to-tick
// button (TickHabitIntent, iOS 17 interactive widgets) for today. Small and medium show the habit
// picked in Edit Widget (HabitStreakConfigIntent, water by default); large shows all four trackers,
// the picked one first. Data: HabitStore.streakSummary (the app's trackers + taps not yet read),
// the same day keys and goal rules as habitStreak / habitHistory in src/core/habits.ts.
// Theme colours, typeface and background in every size and in the gallery preview; never the
// theme's name. Not compiled or run on a device yet. VERIFY on a dev build: Edit Widget habit
// picker, tick button hit area at small size, `.invalidatableContent()` while a tap is pending.
import AppIntents
import SwiftUI
import WidgetKit

/// The habit a streak widget follows (Edit Widget). Names use the habit.name.* keys.
@available(iOS 17.0, *)
enum StreakHabitOption: String, AppEnum {
  case water, sleep, steps, mood

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Habit"
  static var caseDisplayRepresentations: [StreakHabitOption: DisplayRepresentation] = [
    .water: DisplayRepresentation(title: LocalizedStringResource("habit.name.water", defaultValue: "Water")),
    .sleep: DisplayRepresentation(title: LocalizedStringResource("habit.name.sleep", defaultValue: "Sleep")),
    .steps: DisplayRepresentation(title: LocalizedStringResource("habit.name.steps", defaultValue: "Steps")),
    .mood: DisplayRepresentation(title: LocalizedStringResource("habit.name.mood", defaultValue: "Mood")),
  ]

  var kind: HabitKindID { HabitKindID(rawValue: rawValue) ?? .water }
}

@available(iOS 17.0, *)
struct HabitStreakConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Streak habit"
  static var description = IntentDescription("Choose the habit this streak widget follows.")

  @Parameter(title: "Habit", default: .water)
  var habit: StreakHabitOption

  init() {}
}

struct HabitStreakRow {
  let habit: HabitKindID
  let summary: HabitStore.StreakSummary
}

struct HabitStreakEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// The picked habit first; small and medium show only rows[0].
  let rows: [HabitStreakRow]
}

@available(iOS 17.0, *)
struct HabitStreakProvider: AppIntentTimelineProvider {
  private func order(_ first: HabitKindID) -> [HabitKindID] {
    [first] + [HabitKindID.water, .sleep, .steps, .mood].filter { $0 != first }
  }

  private func entry(_ habit: HabitKindID, now: Date, sample: Bool) -> HabitStreakEntry {
    let rows = order(habit).map { kind -> HabitStreakRow in
      let real = HabitStore.streakSummary(kind, days: 7, now: now)
      return HabitStreakRow(habit: kind, summary: sample && real.streak == 0 ? Self.sample(real) : real)
    }
    return HabitStreakEntry(date: now, theme: ThemeStore.load(), rows: rows)
  }

  /// Gallery preview with no history yet: a few ticked days, so the widget reads at a glance.
  /// Same day keys and weekdays as the real summary; only the ticks are filled in.
  private static func sample(_ real: HabitStore.StreakSummary) -> HabitStore.StreakSummary {
    let pattern = [true, false, true, true, true, true, false]
    let ticks = real.ticks.enumerated().map { i, t in
      HabitStore.DayTick(day: t.day, weekday: t.weekday, value: t.value, met: pattern.indices.contains(i) ? pattern[i] : false)
    }
    return HabitStore.StreakSummary(ticks: ticks, streak: 4, today: real.today, goal: real.goal)
  }

  func placeholder(in context: Context) -> HabitStreakEntry {
    entry(.water, now: Date(), sample: true)
  }

  func snapshot(for configuration: HabitStreakConfigIntent, in context: Context) async -> HabitStreakEntry {
    entry(configuration.habit.kind, now: Date(), sample: context.isPreview)
  }

  /// One entry now, refreshed just after local midnight (the ticks shift by a day). Taps reload it.
  func timeline(for configuration: HabitStreakConfigIntent, in context: Context) async -> Timeline<HabitStreakEntry> {
    let now = Date()
    let cal = Calendar.current
    let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
    return Timeline(entries: [entry(configuration.habit.kind, now: now, sample: false)], policy: .after(tomorrow.addingTimeInterval(5)))
  }
}

// MARK: - Copy

enum HabitStreakText {
  static var caption: String { String(localized: "habit.streak.caption", defaultValue: "Streak") }
  static var tick: String { String(localized: "habit.streak.tick", defaultValue: "Tick today") }
  static var done: String { String(localized: "habit.streak.done", defaultValue: "Done today") }
  static var name: String { String(localized: "habit.streak.name", defaultValue: "Streaks") }
  static var description: String {
    String(localized: "habit.streak.desc", defaultValue: "Tick a habit off each day and watch the streak grow.")
  }

  /// Accessibility label of the streak count and ticks: "4-day streak".
  static func streakA11y(_ days: String) -> String {
    String(localized: "habit.a11y.streak", defaultValue: "\(days)-day streak")
  }

  /// Accessibility label of the tick button: "Tick off Water for today".
  static func tickA11y(_ habit: String) -> String {
    String(localized: "habit.a11y.tick", defaultValue: "Tick off \(habit) for today")
  }
}

// MARK: - Views

@available(iOS 17.0, *)
struct HabitStreakWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: HabitStreakEntry

  var body: some View {
    let t = entry.theme
    Group {
      if family == .systemLarge {
        VStack(alignment: .leading, spacing: 10) {
          ForEach(entry.rows, id: \.habit.rawValue) { row in
            StreakRowCompact(row: row, theme: t)
            if row.habit != entry.rows.last?.habit {
              Rectangle()
                .fill(t.inkColor.opacity(0.12))
                .frame(height: 1)
            }
          }
        }
      } else if let row = entry.rows.first {
        StreakCard(row: row, theme: t, medium: family == .systemMedium)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

/// Small / medium: name, streak count, the week's ticks and the tick button.
@available(iOS 17.0, *)
private struct StreakCard: View {
  let row: HabitStreakRow
  let theme: WidgetTheme
  let medium: Bool

  var body: some View {
    let t = theme
    let s = row.summary
    VStack(alignment: .leading, spacing: medium ? 8 : 6) {
      HStack(alignment: .firstTextBaseline) {
        Text(HabitText.name(row.habit).uppercased(with: .current))
          .font(t.typeface(size: 11, weight: .bold))
          .foregroundStyle(t.accentColor)
          .lineLimit(1)
        Spacer(minLength: 4)
        StreakCount(streak: s.streak, theme: t, size: medium ? 24 : 20)
      }
      if medium {
        Text(HabitStreakText.caption)
          .font(t.typeface(size: 11, weight: .medium))
          .foregroundStyle(t.inkColor.opacity(0.7))
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .trailing)
      }
      Spacer(minLength: 0)
      StreakTicks(ticks: medium ? s.ticks : Array(s.ticks.suffix(7)), theme: t, letters: medium, dot: medium ? 22 : 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(HabitStreakText.streakA11y(String(s.streak))))
      Spacer(minLength: 0)
      TickButton(habit: row.habit, done: s.metToday, theme: t, compact: !medium)
    }
  }
}

/// Large: one line per tracker.
@available(iOS 17.0, *)
private struct StreakRowCompact: View {
  let row: HabitStreakRow
  let theme: WidgetTheme

  var body: some View {
    let t = theme
    let s = row.summary
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        Text(HabitText.name(row.habit).uppercased(with: .current))
          .font(t.typeface(size: 12, weight: .bold))
          .foregroundStyle(t.accentColor)
          .lineLimit(1)
        Spacer(minLength: 4)
        StreakCount(streak: s.streak, theme: t, size: 18)
      }
      HStack(spacing: 10) {
        StreakTicks(ticks: s.ticks, theme: t, letters: false, dot: 18)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(Text(HabitStreakText.streakA11y(String(s.streak))))
        TickButton(habit: row.habit, done: s.metToday, theme: t, compact: true)
          .frame(width: 44)
      }
    }
  }
}

private struct StreakCount: View {
  let streak: Int
  let theme: WidgetTheme
  let size: CGFloat

  var body: some View {
    HStack(spacing: 3) {
      Image(systemName: "flame.fill")
        .font(.system(size: size * 0.6, weight: .bold))
        .foregroundStyle(streak > 0 ? theme.accentColor : theme.inkColor.opacity(0.35))
      Text(String(streak))
        .font(theme.typeface(size: size, weight: .bold))
        .foregroundStyle(theme.inkColor)
        .contentTransition(.numericText())
        .invalidatableContent()
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(HabitStreakText.streakA11y(String(streak))))
  }
}

/// The week as dots: filled accent where the goal was met, an outline where not, today ringed.
private struct StreakTicks: View {
  let ticks: [HabitStore.DayTick]
  let theme: WidgetTheme
  let letters: Bool
  let dot: CGFloat

  /// The theme colour (ink or surface) that stands out more against the accent fill.
  private var checkColour: Color {
    let a = GlazeHex.luminance(theme.accent)
    let ink = abs(GlazeHex.luminance(theme.ink) - a)
    let surface = abs(GlazeHex.luminance(theme.surface) - a)
    return ink >= surface ? theme.inkColor : theme.surfaceColor
  }

  private func letter(_ weekday: Int) -> String {
    let symbols = Calendar.current.veryShortWeekdaySymbols
    return symbols.indices.contains(weekday - 1) ? symbols[weekday - 1] : ""
  }

  var body: some View {
    HStack(spacing: 0) {
      ForEach(Array(ticks.enumerated()), id: \.offset) { i, tick in
        let today = i == ticks.count - 1
        VStack(spacing: 3) {
          ZStack {
            Circle()
              .fill(tick.met ? theme.accentColor : theme.inkColor.opacity(0.08))
            Circle()
              .strokeBorder(
                today ? theme.inkColor.opacity(0.85) : theme.inkColor.opacity(tick.met ? 0 : 0.3),
                lineWidth: today ? 2 : 1
              )
            if tick.met {
              Image(systemName: "checkmark")
                .font(.system(size: dot * 0.45, weight: .heavy))
                .foregroundStyle(checkColour)
            }
          }
          .frame(width: dot, height: dot)
          .invalidatableContent()
          if letters {
            Text(letter(tick.weekday))
              .font(theme.typeface(size: 10, weight: today ? .bold : .medium))
              .foregroundStyle(theme.inkColor.opacity(today ? 0.95 : 0.6))
              .lineLimit(1)
          }
        }
        .frame(maxWidth: .infinity)
      }
    }
  }
}

@available(iOS 17.0, *)
private struct TickButton: View {
  let habit: HabitKindID
  let done: Bool
  let theme: WidgetTheme
  let compact: Bool

  var body: some View {
    Button(intent: TickHabitIntent(habit: habit)) {
      HStack(spacing: 4) {
        Image(systemName: done ? "checkmark.circle.fill" : "checkmark.circle")
          .font(.system(size: 15, weight: .bold))
        if !compact {
          Text(done ? HabitStreakText.done : HabitStreakText.tick)
            .font(theme.typeface(size: 13, weight: .bold))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        }
      }
      .foregroundStyle(done ? theme.accentColor : theme.inkColor)
      .frame(maxWidth: .infinity, minHeight: 36)
      .background(Capsule().fill(done ? theme.accentColor.opacity(0.18) : theme.inkColor.opacity(0.12)))
      .overlay(Capsule().strokeBorder(done ? theme.accentColor : theme.inkColor.opacity(0.35), lineWidth: 1))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(Text(done ? HabitStreakText.done : HabitStreakText.tickA11y(HabitText.name(habit))))
  }
}

// MARK: - Widget

@available(iOS 17.0, *)
struct HabitStreakWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: HabitWidgetKinds.streak, intent: HabitStreakConfigIntent.self, provider: HabitStreakProvider()) { entry in
      HabitStreakWidgetView(entry: entry)
    }
    .configurationDisplayName(HabitStreakText.name)
    .description(HabitStreakText.description)
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
