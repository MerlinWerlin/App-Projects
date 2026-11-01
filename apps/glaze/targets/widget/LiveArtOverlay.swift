// T237 (owner-1101g #2, TestFlight build 18: "widgets that LOOK functional must WORK"): the live
// value drawn over theme art on the Glaze "Seamless" widget. docs/WIDGETS.md "Live values over art".
//
// The app stores what to draw with each piece in "My widget art" (widget-art/index.json, record
// field `live`, built by src/core/liveArt.ts liveArtSpec; keep the two in sync):
//   { kind: clock|date|countdown|battery|focus, rect: [x, y, w, h] (0..1 of the composed image),
//     shape: circle|plate, cover: Bool, plate: "#RRGGBB", ink: "#RRGGBB", target?: "YYYY-MM-DD" }
// A widget with no chosen piece shows seamless-<size>.png; its spec is the newest theme piece made
// for that size, used only when it was saved after that file was written (so a stale record never
// puts a value over a different picture).
//
// What is drawn (never a made-up number):
//   clock     live hands + the time (Text(date, style: .time)); the timeline has an entry per minute
//   date      today's weekday, day and month (current locale); reloads after midnight
//   countdown whole days to the stored target day; without a target the piece is never live
//   battery   UIDevice batteryLevel with monitoring on, refreshed every 15 min; unknown (-1) = a dash
//   focus     Button(intent: ToggleFocusIntent()): "25:00 · Start", Text(timerInterval:) while running
// `cover` plates are nearly opaque in the piece's own palette so the value painted into the art
// (e.g. '25:00', '29 THU OCT', fixed hands) is hidden, not doubled.
//
// Not compiled here (no Xcode in the build environment). VERIFY on a dev build.
import AppIntents
import SwiftUI
import UIKit
import WidgetKit

struct LiveArtSpec {
  enum Kind: String {
    case clock, date, countdown, battery, focus
  }

  let kind: Kind
  /// 0..1 of the composed image.
  let rect: CGRect
  let circle: Bool
  let cover: Bool
  let plate: String
  let ink: String
  /// Countdown target (start of that day, current calendar).
  let target: Date?

  /// Tolerant parse of a record's `live` value (same rules as parseLiveArtSpec in TS).
  static func parse(_ raw: Any?) -> LiveArtSpec? {
    guard
      let r = raw as? [String: Any],
      let kindRaw = r["kind"] as? String,
      let kind = Kind(rawValue: kindRaw),
      let list = r["rect"] as? [NSNumber], list.count == 4
    else { return nil }
    let v = list.map { $0.doubleValue }
    guard v.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 1 }), v[2] > 0, v[3] > 0 else { return nil }
    var target: Date? = nil
    if kind == .countdown {
      guard let day = r["target"] as? String, let d = LiveArtSpec.day(day) else { return nil }
      target = d
    }
    let plate = (r["plate"] as? String).flatMap { Color.isHex($0) ? $0 : nil } ?? "#000000"
    let ink = (r["ink"] as? String).flatMap { Color.isHex($0) ? $0 : nil } ?? "#FFFFFF"
    return LiveArtSpec(
      kind: kind,
      rect: CGRect(x: v[0], y: v[1], width: v[2], height: v[3]),
      circle: (r["shape"] as? String) == "circle",
      cover: (r["cover"] as? Bool) == true,
      plate: plate,
      ink: ink,
      target: target
    )
  }

  /// "YYYY-MM-DD" → the start of that day in the current calendar, or nil.
  static func day(_ s: String) -> Date? {
    let parts = s.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var c = DateComponents()
    c.year = parts[0]
    c.month = parts[1]
    c.day = parts[2]
    guard let d = Calendar.current.date(from: c) else { return nil }
    let back = Calendar.current.dateComponents([.year, .month, .day], from: d)
    guard back.year == parts[0], back.month == parts[1], back.day == parts[2] else { return nil }
    return Calendar.current.startOfDay(for: d)
  }
}

enum LiveArtStore {
  /// The spec for what this widget shows: the chosen piece, else the last applied image for its size.
  static func spec(pieceID: String?, family: WidgetFamily) -> LiveArtSpec? {
    guard
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup),
      let dir = WidgetArtStore.directory(),
      let data = try? Data(contentsOf: dir.appendingPathComponent(WidgetArtStore.indexName)),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      root["v"] as? Int == 1,
      let pieces = root["pieces"] as? [[String: Any]]
    else { return nil }
    // Same choice as SeamlessWidgetView: the chosen piece when its file is there.
    if let id = pieceID, WidgetArtStore.validID(id),
      FileManager.default.fileExists(atPath: dir.appendingPathComponent("\(id).jpg").path)
    {
      guard let record = pieces.first(where: { ($0["id"] as? String) == id }) else { return nil }
      return LiveArtSpec.parse(record["live"])
    }
    guard let name = SeamlessStore.familyName(family) else { return nil }
    // T259: the plain background (no image) has no live value.
    if WidgetArtStore.unpinnedShowsBackground(family) { return nil }
    let file = container.appendingPathComponent("seamless-\(name).png")
    guard
      let attrs = try? FileManager.default.attributesOfItem(atPath: file.path),
      let written = attrs[.modificationDate] as? Date
    else { return nil }
    let created: ([String: Any]) -> Double = { ($0["created"] as? NSNumber)?.doubleValue ?? 0 }
    let mine = pieces.filter { ($0["size"] as? String) == name && ($0["source"] as? String) != "photo" }
    guard let newest = mine.max(by: { created($0) < created($1) }) else { return nil }
    // The app saves the piece (created, ms) just after writing the file; an older record is stale.
    guard created(newest) / 1000 >= written.timeIntervalSince1970 - 2 else { return nil }
    return LiveArtSpec.parse(newest["live"])
  }
}

/// Timeline entry dates and reload policy for a Seamless widget, from what it shows live.
enum LiveArtSchedule {
  static func plan(pieceID: String?, family: WidgetFamily, from now: Date) -> (dates: [Date], policy: TimelineReloadPolicy) {
    guard let spec = LiveArtStore.spec(pieceID: pieceID, family: family) else { return ([now], .never) }
    let cal = Calendar.current
    switch spec.kind {
    case .clock:
      // One entry per minute for the next hour, then a new timeline.
      let minuteStart = cal.dateInterval(of: .minute, for: now)?.start ?? now
      var dates = [now]
      for i in 1...60 {
        dates.append(minuteStart.addingTimeInterval(Double(i) * 60))
      }
      return (dates, .atEnd)
    case .date, .countdown:
      let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
      return ([now], .after(tomorrow))
    case .battery:
      return ([now], .after(now.addingTimeInterval(15 * 60)))
    case .focus:
      switch FocusStore.phase(at: now) {
      case .running(let end):
        // The countdown text runs by itself; the entry at `end` shows "Start" again.
        return ([now, end], .atEnd)
      case .idle, .paused:
        return ([now], .never)
      }
    }
  }
}

enum LiveBattery {
  /// 0-100, or nil when iOS does not report a level (never a guessed number).
  static func percent() -> Int? {
    UIDevice.current.isBatteryMonitoringEnabled = true
    let level = UIDevice.current.batteryLevel
    guard level >= 0, level <= 1 else { return nil }
    return Int((Double(level) * 100).rounded())
  }
}

/// The live value over the art, placed on the composed image (fitted whole in the widget).
@available(iOS 17.0, *)
struct LiveArtLayer: View {
  @Environment(\.widgetFamily) private var family
  let pieceID: String?
  let imageSize: CGSize
  let theme: WidgetTheme
  let date: Date

  var body: some View {
    if let spec = LiveArtStore.spec(pieceID: pieceID, family: family) {
      GeometryReader { geo in
        let frame = LiveArtLayer.fitted(imageSize, in: geo.size)
        let r = CGRect(
          x: frame.minX + spec.rect.minX * frame.width,
          y: frame.minY + spec.rect.minY * frame.height,
          width: spec.rect.width * frame.width,
          height: spec.rect.height * frame.height
        )
        let side = min(r.width, r.height)
        LiveArtValueView(spec: spec, theme: theme, date: date)
          .frame(width: spec.circle ? side : r.width, height: spec.circle ? side : r.height)
          .position(x: r.midX, y: r.midY)
      }
    }
  }

  /// Where scaledToFit puts an image of `image` size in `box` (the same as SeamlessWidgetView).
  static func fitted(_ image: CGSize, in box: CGSize) -> CGRect {
    guard image.width > 0, image.height > 0, box.width > 0, box.height > 0 else {
      return CGRect(origin: .zero, size: box)
    }
    let k = min(box.width / image.width, box.height / image.height)
    let w = image.width * k
    let h = image.height * k
    return CGRect(x: (box.width - w) / 2, y: (box.height - h) / 2, width: w, height: h)
  }
}

@available(iOS 17.0, *)
struct LiveArtValueView: View {
  let spec: LiveArtSpec
  let theme: WidgetTheme
  let date: Date

  private var ink: Color { Color(hex: spec.ink) }

  var body: some View {
    GeometryReader { geo in
      let s = min(geo.size.width, geo.size.height)
      ZStack {
        plate
        content(s: s)
          .foregroundStyle(ink)
          .shadow(color: Color.black.opacity(0.25), radius: 2, y: 1)
      }
      .frame(width: geo.size.width, height: geo.size.height)
    }
  }

  /// Nearly opaque over a painted value (it must vanish), lighter as a badge on number-free art.
  @ViewBuilder private var plate: some View {
    let fill = Color(hex: spec.plate).opacity(spec.cover ? 0.94 : 0.72)
    if spec.circle {
      Circle()
        .fill(fill)
        .overlay(Circle().strokeBorder(ink.opacity(0.22), lineWidth: 1))
        .shadow(color: Color.black.opacity(0.2), radius: 4, y: 1)
    } else {
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(fill)
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(ink.opacity(0.22), lineWidth: 1))
        .shadow(color: Color.black.opacity(0.2), radius: 4, y: 1)
    }
  }

  @ViewBuilder private func content(s: CGFloat) -> some View {
    switch spec.kind {
    case .clock:
      ZStack {
        LiveClockHands(date: date, ink: ink)
          .frame(width: s * 0.86, height: s * 0.86)
        Text(date, style: .time)
          .font(theme.typeface(size: max(9, s * 0.1), weight: .semibold))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.5)
          .offset(y: s * 0.27)
      }
    case .date:
      VStack(spacing: s * 0.02) {
        Text(verbatim: date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
          .font(theme.typeface(size: max(9, s * 0.13), weight: .semibold))
        Text(verbatim: date.formatted(.dateTime.day()))
          .font(theme.typeface(size: max(18, s * 0.42), weight: .bold))
        Text(verbatim: date.formatted(.dateTime.month(.abbreviated)).uppercased())
          .font(theme.typeface(size: max(9, s * 0.13), weight: .semibold))
      }
      .lineLimit(1)
      .minimumScaleFactor(0.4)
      .padding(s * 0.06)
    case .countdown:
      if let target = spec.target {
        let cal = Calendar.current
        let days = max(0, cal.dateComponents([.day], from: cal.startOfDay(for: date), to: target).day ?? 0)
        VStack(spacing: s * 0.02) {
          Text(verbatim: "\(days)")
            .font(theme.typeface(size: max(18, s * 0.42), weight: .bold))
            .monospacedDigit()
          Text("Days")
            .font(theme.typeface(size: max(9, s * 0.13), weight: .semibold))
        }
        .lineLimit(1)
        .minimumScaleFactor(0.4)
        .padding(s * 0.06)
      }
    case .battery:
      if let pct = LiveBattery.percent() {
        Text(verbatim: "\(pct)%")
          .font(theme.typeface(size: max(14, s * 0.3), weight: .bold))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.4)
          .padding(s * 0.08)
      } else {
        // iOS gave no level: a dash, never a made-up number.
        Text(verbatim: "–")
          .font(theme.typeface(size: max(14, s * 0.3), weight: .bold))
      }
    case .focus:
      LiveFocusButton(date: date, theme: theme, s: s)
    }
  }
}

/// Start / pause / resume a 25 minute focus session (FocusIntents.swift).
@available(iOS 17.0, *)
struct LiveFocusButton: View {
  let date: Date
  let theme: WidgetTheme
  let s: CGFloat

  var body: some View {
    Button(intent: ToggleFocusIntent()) {
      VStack(spacing: s * 0.03) {
        switch FocusStore.phase(at: date) {
        case .running(let end):
          Text(timerInterval: min(date, end)...end, countsDown: true)
            .font(theme.typeface(size: max(14, s * 0.24), weight: .semibold))
            .monospacedDigit()
            .multilineTextAlignment(.center)
          Label("Pause", systemImage: "pause.fill")
            .font(theme.typeface(size: max(9, s * 0.1), weight: .semibold))
        case .paused(let remaining):
          Text(verbatim: FocusStore.clock(remaining))
            .font(theme.typeface(size: max(14, s * 0.24), weight: .semibold))
            .monospacedDigit()
          Label("Resume", systemImage: "play.fill")
            .font(theme.typeface(size: max(9, s * 0.1), weight: .semibold))
        case .idle:
          Text(verbatim: FocusStore.clock(FocusStore.length))
            .font(theme.typeface(size: max(14, s * 0.24), weight: .semibold))
            .monospacedDigit()
          Label("Start", systemImage: "play.fill")
            .font(theme.typeface(size: max(9, s * 0.1), weight: .semibold))
        }
      }
      .lineLimit(1)
      .minimumScaleFactor(0.5)
      .padding(s * 0.08)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

/// Hour and minute hands for `date` (re-drawn by the per-minute timeline).
struct LiveClockHands: View {
  let date: Date
  let ink: Color

  var body: some View {
    GeometryReader { g in
      let s = min(g.size.width, g.size.height)
      let cal = Calendar.current
      let hour = Double(cal.component(.hour, from: date) % 12)
      let minute = Double(cal.component(.minute, from: date))
      ZStack {
        Capsule()
          .fill(ink)
          .frame(width: max(2, s * 0.04), height: s * 0.28)
          .offset(y: -s * 0.14)
          .rotationEffect(.degrees((hour + minute / 60) * 30))
        Capsule()
          .fill(ink)
          .frame(width: max(1.5, s * 0.025), height: s * 0.42)
          .offset(y: -s * 0.21)
          .rotationEffect(.degrees(minute * 6))
        Circle()
          .fill(ink)
          .frame(width: s * 0.07, height: s * 0.07)
      }
      .frame(width: g.size.width, height: g.size.height)
    }
  }
}
