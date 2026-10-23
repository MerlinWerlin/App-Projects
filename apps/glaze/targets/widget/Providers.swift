// Timeline providers shared by the Glaze widgets. Every entry carries the theme read from the
// App Group at timeline time; the app calls WidgetCenter.reloadAllTimelines() after each write
// (modules/glaze-widget-bridge), so a newly applied theme shows up straight away.
import Foundation
import WidgetKit

private func startOfMinute(_ date: Date) -> Date {
  let cal = Calendar.current
  return cal.date(from: cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)) ?? date
}

/// One entry per minute for the next hour, then WidgetKit asks again.
struct MinuteProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlazeEntry {
    GlazeEntry(date: Date(), theme: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    let theme = ThemeStore.load()
    let start = startOfMinute(Date())
    let entries = (0..<60).compactMap { i -> GlazeEntry? in
      guard let d = Calendar.current.date(byAdding: .minute, value: i, to: start) else { return nil }
      return GlazeEntry(date: d, theme: theme)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

/// One entry now, refreshed just after midnight (for date-only widgets).
struct DayProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlazeEntry {
    GlazeEntry(date: Date(), theme: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    let now = Date()
    let cal = Calendar.current
    let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
    let entry = GlazeEntry(date: now, theme: ThemeStore.load())
    completion(Timeline(entries: [entry], policy: .after(tomorrow.addingTimeInterval(5))))
  }
}

/// One entry per hour for the next 24 hours (the Quote widget rotates hourly).
struct HourProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlazeEntry {
    GlazeEntry(date: Date(), theme: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    let theme = ThemeStore.load()
    let cal = Calendar.current
    let now = Date()
    let hourStart = cal.date(from: cal.dateComponents([.year, .month, .day, .hour], from: now)) ?? now
    let entries = (0..<24).compactMap { i -> GlazeEntry? in
      guard let d = cal.date(byAdding: .hour, value: i, to: hourStart) else { return nil }
      return GlazeEntry(date: i == 0 ? now : d, theme: theme)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

/// Static content (the Photo widget): only changes when the app reloads timelines.
struct StaticProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlazeEntry {
    GlazeEntry(date: Date(), theme: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    completion(Timeline(entries: [GlazeEntry(date: Date(), theme: ThemeStore.load())], policy: .never))
  }
}
