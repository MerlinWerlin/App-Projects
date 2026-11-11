// Timeline providers shared by the Glaze widgets. Every entry carries the theme read from the
// App Group at timeline time; the app calls WidgetCenter.reloadAllTimelines() after each write
// (modules/glaze-widget-bridge), so a newly applied theme shows up straight away.
// Owner 2026-11-11: placeholder() and gallery snapshots (context.isPreview) draw a fixed
// GallerySample palette, never the theme: iOS keeps gallery previews long after a swap.
import Foundation
import WidgetKit

private func startOfMinute(_ date: Date) -> Date {
  let cal = Calendar.current
  return cal.date(from: cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)) ?? date
}

/// One entry per minute for the next hour, then WidgetKit asks again.
struct MinuteProvider: TimelineProvider {
  /// GallerySample palette for the Add Widget gallery (each widget kind picks its own).
  var sample = 0

  func placeholder(in context: Context) -> GlazeEntry {
    GallerySample.entry(sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(context.isPreview ? GallerySample.entry(sample) : GlazeEntry(date: Date(), theme: ThemeStore.load()))
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

/// One entry now and one at midnight, refreshed just after (date widgets, the daily Little Line,
/// the photo frame's date caption).
struct DayProvider: TimelineProvider {
  /// GallerySample palette for the Add Widget gallery (each widget kind picks its own).
  var sample = 0

  func placeholder(in context: Context) -> GlazeEntry {
    GallerySample.entry(sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(context.isPreview ? GallerySample.entry(sample) : GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    let now = Date()
    let cal = Calendar.current
    let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
    let theme = ThemeStore.load()
    // T276: a second entry AT midnight, so the date rolls over even if the reload is late.
    let entries = [GlazeEntry(date: now, theme: theme), GlazeEntry(date: tomorrow, theme: theme)]
    completion(Timeline(entries: entries, policy: .after(tomorrow.addingTimeInterval(5))))
  }
}

// T283: the Little Line now changes once a day (DayProvider); HourProvider stays for the Moon widget.
/// One entry per hour for the next 24 hours (the Moon widget, owner-1102b T277).
struct HourProvider: TimelineProvider {
  /// GallerySample palette for the Add Widget gallery (each widget kind picks its own).
  var sample = 0

  func placeholder(in context: Context) -> GlazeEntry {
    GallerySample.entry(sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(context.isPreview ? GallerySample.entry(sample) : GlazeEntry(date: Date(), theme: ThemeStore.load()))
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


/// Static content: only changes when the app reloads timelines. (T282: the Photo widget moved to
/// DayProvider so its date caption rolls over at midnight.)
struct StaticProvider: TimelineProvider {
  /// GallerySample palette for the Add Widget gallery (each widget kind picks its own).
  var sample = 0

  func placeholder(in context: Context) -> GlazeEntry {
    GallerySample.entry(sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlazeEntry) -> Void) {
    completion(context.isPreview ? GallerySample.entry(sample) : GlazeEntry(date: Date(), theme: ThemeStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlazeEntry>) -> Void) {
    completion(Timeline(entries: [GlazeEntry(date: Date(), theme: ThemeStore.load())], policy: .never))
  }
}
