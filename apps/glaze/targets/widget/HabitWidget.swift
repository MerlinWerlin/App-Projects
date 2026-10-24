// Interactive habit widgets (T73): water (+150 ml), sleep (+1 h), steps (+500) and mood (faces).
// Small + medium Home Screen sizes, styled from the active Glaze theme. Buttons use
// Button(intent:) (iOS 17 interactive widgets) with the intents in HabitIntents.swift.
// Values come from HabitStore (the app's trackers + taps the app hasn't read yet).
// T86: every name, unit and accessibility label comes from HabitText (Localizable.strings), and the
// goal shown is the person's own daily goal when they set one in the app (Habit goals screen).
// Lock Screen accessory habit widgets carry no buttons in the catalogue and are a follow-up here.
//
// Not compiled or run on a device yet. VERIFY: button hit areas at small size, `.invalidatableContent()`
// look while a tap is pending, and mood faces in the tinted / StandBy rendering modes.
import AppIntents
import SwiftUI
import WidgetKit

struct HabitEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  let habit: HabitKindID
  let value: Double
  let goal: Double?
  let step: Double
}

/// One entry now, refreshed just after local midnight (when the day rolls over to 0).
/// Taps reload the timeline straight away (WidgetKit + HabitWidgetKinds.reload).
struct HabitProvider: TimelineProvider {
  let habit: HabitKindID

  private func entry(_ date: Date) -> HabitEntry {
    HabitEntry(
      date: date,
      theme: ThemeStore.load(),
      habit: habit,
      value: HabitStore.todayValue(habit, now: date),
      goal: HabitStore.goal(habit),
      step: HabitStore.step(habit)
    )
  }

  func placeholder(in context: Context) -> HabitEntry {
    let def = HabitDef.of(habit)
    return HabitEntry(date: Date(), theme: ThemeStore.load(), habit: habit, value: 0, goal: def.goal, step: def.step)
  }

  func getSnapshot(in context: Context, completion: @escaping (HabitEntry) -> Void) {
    completion(entry(Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HabitEntry>) -> Void) {
    let now = Date()
    let cal = Calendar.current
    let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
    completion(Timeline(entries: [entry(now)], policy: .after(tomorrow.addingTimeInterval(5))))
  }
}

// MARK: - Views

@available(iOS 17.0, *)
struct HabitWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: HabitEntry

  private var def: HabitDef { HabitDef.of(entry.habit) }
  private var stepText: String { HabitStore.format(entry.step, decimals: def.decimals) }

  var body: some View {
    let t = entry.theme
    Group {
      if entry.habit == .mood {
        MoodBody(entry: entry, medium: family == .systemMedium)
      } else {
        countBody(t)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }

  private func countBody(_ t: WidgetTheme) -> some View {
    let goal = entry.goal ?? 1
    let fraction = goal > 0 ? min(1, entry.value / goal) : 0
    let valueText = HabitStore.format(entry.value, decimals: def.decimals)
    let goalText = HabitStore.format(goal, decimals: def.decimals)
    return VStack(alignment: .leading, spacing: 6) {
      Text(def.name.uppercased(with: .current))
        .font(t.typeface(size: 11, weight: .bold))
        .foregroundStyle(t.accentColor)
        .lineLimit(1)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(valueText)
          .font(t.typeface(size: family == .systemMedium ? 34 : 28, weight: .bold))
          .foregroundStyle(t.inkColor)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .contentTransition(.numericText())
          .invalidatableContent()
        Text(def.unit)
          .font(t.typeface(size: 13, weight: .medium))
          .foregroundStyle(t.inkColor.opacity(0.75))
          .lineLimit(1)
      }
      Text(HabitText.goalOf(goalText, unit: def.unit))
        .font(t.typeface(size: 12, weight: .medium))
        .foregroundStyle(t.inkColor.opacity(0.75))
        .lineLimit(1)
      ProgressMeter(fraction: fraction, theme: t)
      Spacer(minLength: 0)
      HStack(spacing: 8) {
        Button(intent: StepHabitIntent(habit: entry.habit, direction: -1)) {
          HabitButtonLabel(text: "−", theme: t)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(HabitText.remove(stepText, unit: def.unit)))
        Button(intent: StepHabitIntent(habit: entry.habit, direction: 1)) {
          HabitButtonLabel(text: entry.habit == .steps ? "+\(stepText)" : "+\(stepText) \(def.unit)", theme: t)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(HabitText.add(stepText, unit: def.unit)))
      }
    }
  }
}

@available(iOS 17.0, *)
private struct MoodBody: View {
  let entry: HabitEntry
  let medium: Bool

  var body: some View {
    let t = entry.theme
    let level = Int(entry.value)
    VStack(alignment: .leading, spacing: 6) {
      Text(HabitText.name(.mood).uppercased(with: .current))
        .font(t.typeface(size: 11, weight: .bold))
        .foregroundStyle(t.accentColor)
      if medium {
        Text(HabitText.mood(min(5, max(0, level))))
          .font(t.typeface(size: 20, weight: .bold))
          .foregroundStyle(t.inkColor)
          .invalidatableContent()
        Spacer(minLength: 0)
        HStack(spacing: 6) {
          ForEach(1...5, id: \.self) { i in
            Button(intent: SetMoodIntent(level: i)) {
              MoodFace(level: i, selected: i == level, theme: t)
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(HabitText.logMood(i)))
          }
        }
      } else {
        HStack {
          MoodFace(level: max(1, level), selected: level > 0, theme: t)
            .frame(width: 48, height: 48)
            .opacity(level > 0 ? 1 : 0.5)
            .invalidatableContent()
          Text(HabitText.mood(min(5, max(0, level))))
            .font(t.typeface(size: 15, weight: .semibold))
            .foregroundStyle(t.inkColor)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        Spacer(minLength: 0)
        HStack(spacing: 8) {
          Button(intent: StepHabitIntent(habit: .mood, direction: -1)) {
            HabitButtonLabel(text: "−", theme: t)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(Text(HabitText.moodDown))
          Button(intent: StepHabitIntent(habit: .mood, direction: 1)) {
            HabitButtonLabel(text: "+", theme: t)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(Text(HabitText.moodUp))
        }
      }
    }
  }
}

/// Pill button face. Ink on a soft ink tint, so it reads wherever the theme's text does.
private struct HabitButtonLabel: View {
  let text: String
  let theme: WidgetTheme

  var body: some View {
    Text(text)
      .font(theme.typeface(size: 15, weight: .bold))
      .foregroundStyle(theme.inkColor)
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .frame(maxWidth: .infinity, minHeight: 36)
      .background(Capsule().fill(theme.inkColor.opacity(0.12)))
      .overlay(Capsule().strokeBorder(theme.inkColor.opacity(0.35), lineWidth: 1))
  }
}

private struct ProgressMeter: View {
  let fraction: Double
  let theme: WidgetTheme

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(theme.inkColor.opacity(0.15))
        Capsule()
          .fill(theme.accentColor)
          .frame(width: max(0, min(1, fraction)) * geo.size.width)
      }
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}

/// Original line-drawn face: the mouth curves from a frown (1) to a wide smile (5).
private struct MoodFace: View {
  let level: Int
  let selected: Bool
  let theme: WidgetTheme

  var body: some View {
    GeometryReader { geo in
      let s = min(geo.size.width, geo.size.height)
      let colour = selected ? theme.accentColor : theme.inkColor.opacity(0.6)
      ZStack {
        Circle()
          .fill(selected ? theme.accentColor.opacity(0.15) : Color.clear)
        Circle()
          .strokeBorder(colour, lineWidth: max(1.5, s * 0.06))
        Path { p in
          let eyeR = s * 0.05
          p.addEllipse(in: CGRect(x: s * 0.33 - eyeR, y: s * 0.38 - eyeR, width: eyeR * 2, height: eyeR * 2))
          p.addEllipse(in: CGRect(x: s * 0.67 - eyeR, y: s * 0.38 - eyeR, width: eyeR * 2, height: eyeR * 2))
        }
        .fill(colour)
        Path { p in
          // level 1 → curve up (frown), 3 → flat, 5 → curve down (smile).
          let bend = CGFloat(level - 3) * s * 0.09
          p.move(to: CGPoint(x: s * 0.3, y: s * 0.64))
          p.addQuadCurve(to: CGPoint(x: s * 0.7, y: s * 0.64), control: CGPoint(x: s * 0.5, y: s * 0.64 + bend))
        }
        .stroke(colour, style: StrokeStyle(lineWidth: max(1.5, s * 0.06), lineCap: .round))
      }
      .frame(width: s, height: s)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .accessibilityHidden(true)
  }
}

// MARK: - Widgets

@available(iOS 17.0, *)
private func habitConfiguration(_ habit: HabitKindID, name: String, description: String) -> some WidgetConfiguration {
  StaticConfiguration(kind: HabitWidgetKinds.kind(for: habit), provider: HabitProvider(habit: habit)) { entry in
    HabitWidgetView(entry: entry)
  }
  .configurationDisplayName(name)
  .description(description)
  .supportedFamilies([.systemSmall, .systemMedium])
}

@available(iOS 17.0, *)
struct HabitWaterWidget: Widget {
  var body: some WidgetConfiguration {
    habitConfiguration(.water, name: HabitText.name(.water), description: HabitText.description(.water))
  }
}

@available(iOS 17.0, *)
struct HabitSleepWidget: Widget {
  var body: some WidgetConfiguration {
    habitConfiguration(.sleep, name: HabitText.name(.sleep), description: HabitText.description(.sleep))
  }
}

@available(iOS 17.0, *)
struct HabitStepsWidget: Widget {
  var body: some WidgetConfiguration {
    habitConfiguration(.steps, name: HabitText.name(.steps), description: HabitText.description(.steps))
  }
}

@available(iOS 17.0, *)
struct HabitMoodWidget: Widget {
  var body: some WidgetConfiguration {
    habitConfiguration(.mood, name: HabitText.name(.mood), description: HabitText.description(.mood))
  }
}
