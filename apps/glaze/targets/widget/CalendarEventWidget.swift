// owner-1102b T280: Next event. Reads the user's calendars with EventKit inside the extension, which
// works once the APP has full calendar access (asked only from Glaze's widget-access screen, reached
// by tapping this widget; a widget can't show a permission prompt). Without access it shows a themed
// "Open Glaze to show your next event" state. Nothing read here leaves the device.
// Refresh: an entry at every event start / end in the next 30 minutes, a new timeline every 30 minutes
// (and whenever the app reloads timelines).
import EventKit
import SwiftUI
import WidgetKit

/// One event, already reduced to what the views show.
struct GlazeCalendarItem: Identifiable {
  let id: String
  let title: String
  let start: Date
  let end: Date
  let allDay: Bool
  let color: Color?
}

struct CalendarEventEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// false: no full calendar access yet (the "Open Glaze" state).
  let hasAccess: Bool
  /// Upcoming or running events (end after `date`), soonest first.
  let items: [GlazeCalendarItem]
}

enum GlazeCalendarReader {
  static let accessURL = URL(string: "glaze://widget-access?kind=calendar")

  static func hasFullAccess() -> Bool {
    EKEventStore.authorizationStatus(for: .event) == .fullAccess
  }

  /// Events ending after `now` in the next 7 days: timed events first by start, all-day after them
  /// on the same day. At most `limit`.
  static func upcoming(from now: Date, limit: Int = 8) -> [GlazeCalendarItem] {
    guard hasFullAccess() else { return [] }
    let store = EKEventStore()
    let end = now.addingTimeInterval(7 * 24 * 3600)
    let predicate = store.predicateForEvents(withStart: now.addingTimeInterval(-12 * 3600), end: end, calendars: nil)
    let events = store.events(matching: predicate)
    let items: [GlazeCalendarItem] = events.compactMap { ev in
      guard let start = ev.startDate, let finish = ev.endDate, finish > now else { return nil }
      let color: Color? = ev.calendar.flatMap { source in source.cgColor.map { Color(cgColor: $0) } }
      let title = (ev.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      return GlazeCalendarItem(
        id: (ev.eventIdentifier ?? UUID().uuidString) + "@\(start.timeIntervalSince1970)",
        title: title,
        start: start,
        end: finish,
        allDay: ev.isAllDay,
        color: color
      )
    }
    let cal = Calendar.current
    let sorted = items.sorted { a, b in
      let dayA = cal.startOfDay(for: max(a.start, now))
      let dayB = cal.startOfDay(for: max(b.start, now))
      if dayA != dayB { return dayA < dayB }
      if a.allDay != b.allDay { return !a.allDay }
      return a.start < b.start
    }
    return Array(sorted.prefix(limit))
  }

  /// Gallery / placeholder content: sample events in the theme (never real data, never the theme name).
  static func sample(now: Date) -> [GlazeCalendarItem] {
    let cal = Calendar.current
    let base = cal.date(bySettingHour: cal.component(.hour, from: now) + 1, minute: 0, second: 0, of: now) ?? now.addingTimeInterval(3600)
    return [
      GlazeCalendarItem(id: "sample-1", title: String(localized: "calendar.sample.1", defaultValue: "Coffee with Sam"), start: base, end: base.addingTimeInterval(1800), allDay: false, color: nil),
      GlazeCalendarItem(id: "sample-2", title: String(localized: "calendar.sample.2", defaultValue: "Team check-in"), start: base.addingTimeInterval(7200), end: base.addingTimeInterval(9000), allDay: false, color: nil),
      GlazeCalendarItem(id: "sample-3", title: String(localized: "calendar.sample.3", defaultValue: "Yoga"), start: base.addingTimeInterval(4 * 3600), end: base.addingTimeInterval(5 * 3600), allDay: false, color: nil),
    ]
  }
}

struct CalendarEventProvider: TimelineProvider {
  func placeholder(in context: Context) -> CalendarEventEntry {
    let now = Date()
    return CalendarEventEntry(date: now, theme: GallerySample.theme(4), hasAccess: true, items: GlazeCalendarReader.sample(now: now))
  }

  func getSnapshot(in context: Context, completion: @escaping (CalendarEventEntry) -> Void) {
    let now = Date()
    let theme = context.isPreview ? GallerySample.theme(4) : ThemeStore.load()
    if context.isPreview || !GlazeCalendarReader.hasFullAccess() {
      // Gallery: sample events in a fixed sample palette (GallerySample).
      completion(CalendarEventEntry(date: now, theme: theme, hasAccess: true, items: GlazeCalendarReader.sample(now: now)))
      return
    }
    completion(CalendarEventEntry(date: now, theme: theme, hasAccess: true, items: GlazeCalendarReader.upcoming(from: now)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEventEntry>) -> Void) {
    let now = Date()
    let theme = ThemeStore.load()
    let refresh = now.addingTimeInterval(30 * 60)
    guard GlazeCalendarReader.hasFullAccess() else {
      completion(Timeline(entries: [CalendarEventEntry(date: now, theme: theme, hasAccess: false, items: [])], policy: .after(refresh)))
      return
    }
    let items = GlazeCalendarReader.upcoming(from: now)
    // An entry at each start / end in the next 30 minutes, so "Now" and the next event roll over on time.
    var moments: [Date] = [now]
    for item in items {
      for d in [item.start, item.end] where d > now && d < refresh { moments.append(d) }
    }
    let unique = Array(Set(moments)).sorted()
    let entries = unique.map { d in
      CalendarEventEntry(date: d, theme: theme, hasAccess: true, items: items.filter { $0.end > d })
    }
    completion(Timeline(entries: entries, policy: .after(refresh)))
  }
}

// MARK: - Views

struct CalendarEventWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: CalendarEventEntry

  var body: some View {
    let t = entry.theme
    Group {
      if !entry.hasAccess {
        CalendarAccessNeededView(theme: t)
      } else if entry.items.isEmpty {
        CalendarEmptyView(theme: t)
      } else {
        switch family {
        case .systemSmall:
          CalendarEventCard(item: entry.items[0], now: entry.date, theme: t, titleSize: 17, lines: 3)
        case .systemMedium:
          HStack(alignment: .top, spacing: 14) {
            CalendarEventCard(item: entry.items[0], now: entry.date, theme: t, titleSize: 18, lines: 3)
            if entry.items.count > 1 {
              CalendarEventList(items: Array(entry.items.dropFirst().prefix(2)), now: entry.date, theme: t)
            }
          }
        default:
          VStack(alignment: .leading, spacing: 14) {
            CalendarEventCard(item: entry.items[0], now: entry.date, theme: t, titleSize: 22, lines: 2)
            if entry.items.count > 1 {
              Rectangle().fill(t.inkColor.opacity(0.15)).frame(height: 1)
              CalendarEventList(items: Array(entry.items.dropFirst().prefix(5)), now: entry.date, theme: t)
            }
            Spacer(minLength: 0)
          }
        }
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(GlazeCalendarReader.accessURL)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

/// "Today 14:00", "Tomorrow", a weekday, or "Now" while it runs.
private struct CalendarWhenText: View {
  let item: GlazeCalendarItem
  let now: Date
  let theme: WidgetTheme
  let size: CGFloat

  var body: some View {
    let cal = Calendar.current
    let font = theme.typeface(size: size, weight: .semibold)
    Group {
      if item.start <= now && !item.allDay {
        Text("Now")
      } else if item.allDay {
        if cal.isDateInToday(max(item.start, now)) {
          Text("All day")
        } else {
          Text(item.start, format: .dateTime.weekday(.abbreviated).day())
        }
      } else if cal.isDateInToday(item.start) {
        Text(item.start, style: .time)
      } else if cal.isDateInTomorrow(item.start) {
        HStack(spacing: 4) {
          Text("Tomorrow")
          Text(item.start, style: .time)
        }
      } else {
        Text(item.start, format: .dateTime.weekday(.abbreviated).hour().minute())
      }
    }
    .font(font)
    .foregroundStyle(theme.accentColor)
    .lineLimit(1)
    .minimumScaleFactor(0.7)
  }
}

private struct CalendarDot: View {
  let item: GlazeCalendarItem
  let theme: WidgetTheme
  let size: CGFloat

  var body: some View {
    Circle()
      .fill(item.color ?? theme.accentColor)
      .overlay(Circle().strokeBorder(theme.inkColor.opacity(0.35), lineWidth: 1))
      .frame(width: size, height: size)
  }
}

private struct CalendarEventCard: View {
  let item: GlazeCalendarItem
  let now: Date
  let theme: WidgetTheme
  let titleSize: CGFloat
  let lines: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        CalendarDot(item: item, theme: theme, size: 10)
        Text("Next event")
          .font(theme.typeface(size: 12, weight: .bold))
          .foregroundStyle(theme.inkColor.opacity(0.7))
          .lineLimit(1)
      }
      Spacer(minLength: 0)
      Text(item.title.isEmpty ? String(localized: "calendar.untitled", defaultValue: "Event") : item.title)
        .font(theme.typeface(size: titleSize, weight: .bold))
        .foregroundStyle(theme.inkColor)
        .lineLimit(lines)
        .minimumScaleFactor(0.75)
      CalendarWhenText(item: item, now: now, theme: theme, size: 14)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct CalendarEventList: View {
  let items: [GlazeCalendarItem]
  let now: Date
  let theme: WidgetTheme

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      ForEach(items) { item in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          CalendarDot(item: item, theme: theme, size: 8)
          VStack(alignment: .leading, spacing: 2) {
            Text(item.title.isEmpty ? String(localized: "calendar.untitled", defaultValue: "Event") : item.title)
              .font(theme.typeface(size: 14, weight: .semibold))
              .foregroundStyle(theme.inkColor)
              .lineLimit(1)
            CalendarWhenText(item: item, now: now, theme: theme, size: 12)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct CalendarEmptyView: View {
  let theme: WidgetTheme

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: "calendar")
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(theme.accentColor)
      Spacer(minLength: 0)
      Text("No events in the next 7 days")
        .font(theme.typeface(size: 15, weight: .semibold))
        .foregroundStyle(theme.inkColor)
        .lineLimit(3)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct CalendarAccessNeededView: View {
  let theme: WidgetTheme

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: "calendar.badge.plus")
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(theme.accentColor)
      Spacer(minLength: 0)
      Text("Open Glaze to show your next event")
        .font(theme.typeface(size: 15, weight: .semibold))
        .foregroundStyle(theme.inkColor)
        .lineLimit(4)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct CalendarEventWidget: Widget {
  let kind = "GlazeCalendarEvent"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: CalendarEventProvider()) { entry in
      CalendarEventWidgetView(entry: entry)
    }
    .configurationDisplayName("Next event")
    .description("Your next calendar event, in your Glaze theme.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .legacyGlazeGallery()
  }
}
