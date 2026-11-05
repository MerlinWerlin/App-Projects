import SwiftUI
import UIKit

struct WidgetIdentity {
  let outline: Path
  let inner: Path
  let hours: Path
  let minutes: Path
  let cardinals: [CGFloat]
  let subject: Path
  let detail: Path
  let hands: String
  let gauge: String
  let calendar: String
  let originalFace: String?

  static func parse(_ raw: Any?) -> WidgetIdentity? {
    guard let r = raw as? [String: Any],
      let outline = path(r["outline"]), let inner = path(r["inner"]),
      let hours = path(r["hours"]), let minutes = path(r["minutes"]),
      let subject = path(r["subject"]), let detail = path(r["detail"]),
      let cardinals = r["cardinals"] as? [Double], cardinals.count == 4,
      cardinals.allSatisfy({ (17...38).contains($0) }),
      let hands = r["hands"] as? String, ["baton", "needle", "sword", "leaf", "wedge"].contains(hands),
      let gauge = r["gauge"] as? String, ["column", "tiles", "trail", "basin"].contains(gauge),
      let calendar = r["calendar"] as? String, ["folio", "board", "band", "ledger", "ticket"].contains(calendar),
      r["originalFace"] == nil || r["originalFace"] as? String == "alpine"
    else { return nil }
    return WidgetIdentity(outline: outline, inner: inner, hours: hours, minutes: minutes,
      cardinals: cardinals.map { CGFloat($0) }, subject: subject, detail: detail,
      hands: hands, gauge: gauge, calendar: calendar, originalFace: r["originalFace"] as? String)
  }

  /// The JS compiler emits only absolute M, L, Q, T, C and Z with space-separated operands.
  private static func path(_ raw: Any?) -> Path? {
    guard let value = raw as? String, value.count <= 2400, value.hasPrefix("M ") else { return nil }
    let tokens = value.split(separator: " ")
    var i = 0, path = Path(), point = CGPoint.zero, start = CGPoint.zero
    var quadratic: CGPoint? = nil
    func nextPoint() -> CGPoint? {
      guard i + 1 < tokens.count, let x = Double(tokens[i]), let y = Double(tokens[i + 1]),
        (-25...125).contains(x), (-25...125).contains(y) else { return nil }
      i += 2
      return CGPoint(x: x, y: y)
    }
    while i < tokens.count {
      let command = tokens[i]
      i += 1
      switch command {
      case "M":
        guard let end = nextPoint() else { return nil }
        path.move(to: end); point = end; start = end; quadratic = nil
      case "L":
        guard let end = nextPoint() else { return nil }
        path.addLine(to: end); point = end; quadratic = nil
      case "Q":
        guard let control = nextPoint(), let end = nextPoint() else { return nil }
        path.addQuadCurve(to: end, control: control); point = end; quadratic = control
      case "T":
        guard let end = nextPoint() else { return nil }
        let control = quadratic.map { CGPoint(x: 2 * point.x - $0.x, y: 2 * point.y - $0.y) } ?? point
        path.addQuadCurve(to: end, control: control); point = end; quadratic = control
      case "C":
        guard let first = nextPoint(), let second = nextPoint(), let end = nextPoint() else { return nil }
        path.addCurve(to: end, control1: first, control2: second); point = end; quadratic = nil
      case "Z":
        path.closeSubpath(); point = start; quadratic = nil
      default: return nil
      }
    }
    return path.isEmpty ? nil : path
  }
}

enum ThemedClockArtwork {
  static let alpine = UIImage(named: "AlpineClockFace") ?? Bundle.main.url(forResource: "AlpineClockFace", withExtension: "jpg").flatMap { UIImage(contentsOfFile: $0.path) }
}

private extension Path {
  func placed(in box: CGRect) -> Path {
    applying(CGAffineTransform(a: box.width / 100, b: 0, c: 0, d: box.height / 100, tx: box.minX, ty: box.minY))
  }
}

extension DesignedDrawing {
  private func themedBox(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat? = nil) -> CGRect {
    CGRect(x: x, y: y, width: w, height: h ?? w)
  }

  private func shape(_ path: Path, in box: CGRect, color: Color, stroke: CGFloat? = nil) {
    let fitted = path.placed(in: box)
    if let stroke = stroke {
      context.stroke(fitted, with: .color(color), style: StrokeStyle(lineWidth: min(box.width, box.height) * stroke / 100, lineCap: .round, lineJoin: .round))
    } else {
      context.fill(fitted, with: .color(color))
    }
  }

  private mutating func clipped(to path: Path, in box: CGRect, draw: (inout DesignedDrawing) -> Void) {
    var layer = self
    layer.context.clip(to: path.placed(in: box))
    draw(&layer)
  }

  private func hand(angle: Double, length: CGFloat, width: CGFloat, style: String, y: CGFloat) -> Path {
    let points: [(CGFloat, CGFloat)]
    switch style {
    case "needle": points = [(-8, -width), (length, 0), (-8, width)]
    case "sword": points = [(-5, -width), (length * 0.72, -width), (length, 0), (length * 0.72, width), (-5, width)]
    case "leaf": points = [(-4, 0), (length * 0.32, -width * 1.3), (length, 0), (length * 0.32, width * 1.3)]
    case "wedge": points = [(-5, -width * 0.55), (length * 0.76, -width * 1.45), (length, 0), (length * 0.76, width * 1.45), (-5, width * 0.55)]
    default: points = [(-5, -width), (length - 1, -width), (length, 0), (length - 1, width), (-5, width)]
    }
    let c = CGFloat(cos(angle)), s = CGFloat(sin(angle))
    var path = Path()
    for (i, point) in points.enumerated() {
      let (along, across) = point
      let p = CGPoint(x: 50 + c * along - s * across, y: y + s * along + c * across)
      if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
    }
    path.closeSubpath()
    return path
  }

  mutating func themedClock(_ design: WidgetIdentity, date: Date, wide: Bool, large: Bool) {
    let side: CGFloat = large ? 364 : 170
    let box = themedBox(0, large ? 9 : 0, side)
    let background = Color(hex: spec.background[0])
    let original = design.originalFace == "alpine" ? ThemedClockArtwork.alpine : nil
    if let original = original {
      context.draw(Image(uiImage: original), in: box)
    } else {
      shape(design.outline, in: box, color: ink.opacity(0.045))
      clipped(to: design.inner, in: box) { face in
        face.shape(design.detail, in: face.themedBox(box.minX + side * 0.05, box.minY + side * 0.36, side * 0.90, side * 0.58), color: face.accent.opacity(0.36), stroke: 1.8)
        face.shape(design.subject, in: face.themedBox(box.minX + side * 0.14, box.minY + side * 0.18, side * 0.72, side * 0.64), color: face.secondary.opacity(0.47), stroke: 2.15)
      }
      shape(design.outline, in: box, color: secondary.opacity(0.76), stroke: 0.9)
      shape(design.inner, in: box, color: accent.opacity(0.55), stroke: 0.55)
      shape(design.minutes, in: box, color: secondary.opacity(0.68), stroke: 0.45)
      shape(design.hours, in: box, color: ink.opacity(0.97), stroke: 1.18)
      for (i, label) in [12, 3, 6, 9].enumerated() {
        let angle = Double(i) * .pi / 2 - .pi / 2
        let radius = design.cardinals[i] / 100 * side
        let x = box.midX + CGFloat(cos(angle)) * radius, y = box.midY + CGFloat(sin(angle)) * radius
        circle(x, y, side * 0.049, color: background)
        text(number(label), x: x, y: y, font: side * 0.072, width: side * 0.14, weight: .semibold)
      }
    }
    let hour = Double(calendar.component(.hour, from: date) % 12)
    let minute = Double(calendar.component(.minute, from: date))
    let cy: CGFloat = original == nil ? 50 : 47.3
    let hourHand = hand(angle: (hour + minute / 60) * .pi / 6 - .pi / 2, length: 21, width: 1.85, style: design.hands, y: cy)
    let minuteHand = hand(angle: minute * .pi / 30 - .pi / 2, length: 32, width: 1.2, style: design.hands, y: cy)
    shape(hourHand, in: box, color: background.opacity(0.9), stroke: 2.05)
    shape(minuteHand, in: box, color: background.opacity(0.9), stroke: 2.05)
    shape(hourHand, in: box, color: original == nil ? secondary : Color(hex: "#DFBA87"))
    let minuteInk = original == nil ? ink : Color(hex: "#FFF4DC")
    shape(minuteHand, in: box, color: minuteInk)
    circle(box.midX, box.minY + side * cy / 100, side * 0.023, color: minuteInk)
    if wide {
      let plaque = themedBox(179, 13, 178, 144)
      shape(design.outline, in: plaque, color: ink.opacity(0.052))
      shape(design.inner, in: plaque, color: accent.opacity(0.35), stroke: 0.6)
      shape(design.detail, in: themedBox(244, 21, 47, 35), color: secondary.opacity(0.62), stroke: 2.6)
      let parts = clockParts(date)
      text(parts.time, x: 268, y: 82, font: 49, width: 153, weight: .semibold)
      if !parts.period.isEmpty { text(parts.period, x: 268, y: 112, font: 12, width: 100, color: secondary) }
      text(dateText(date, "EEE d MMM"), x: 268, y: 134, font: 14, width: 148, color: secondary)
    }
  }

  mutating func themedBattery(_ design: WidgetIdentity, percent: Int?, wide: Bool, large: Bool) {
    let f = NumberFormatter(); f.locale = locale; f.numberStyle = .percent; f.maximumFractionDigits = 0
    let value = percent.map { f.string(from: NSNumber(value: Double($0) / 100)) ?? "\($0)%" } ?? "\u{2014}"
    let label = NSLocalizedString("Battery", comment: "Battery widget")
    let column = design.gauge == "column"
    let art: CGRect
    if column {
      art = large ? themedBox(18, 54, 155, 268) : wide ? themedBox(15, 13, 124, 145) : themedBox(5, 20, 77, 125)
    } else {
      art = large ? themedBox(51, 18, 262, 235) : wide ? themedBox(8, 12, 138, 145) : themedBox(27, 5, 116, 111)
    }
    let valueX: CGFloat = wide ? 250 : column ? (large ? 258 : 120) : size.width / 2
    let valueY: CGFloat = large ? (column ? 170 : 132) : wide ? 67 : column ? 75 : 61
    let valueWidth: CGFloat = wide ? 183 : column ? (large ? 165 : 89) : size.width - 23
    shape(design.outline, in: art, color: ink.opacity(0.06))
    shape(design.detail, in: art, color: accent.opacity(0.24), stroke: 1.4)
    if column {
      clipped(to: design.inner, in: art) { gauge in
        if let level = percent, level > 0 {
          let extent = art.height * 0.9 * CGFloat(level) / 100
          let y = art.minY + art.height * 0.95 - extent
          gauge.rect(art.minX, y, art.width, extent, radius: 0, color: gauge.accent.opacity(0.7))
          gauge.line(art.minX, y, art.maxX, y, color: gauge.secondary.opacity(0.7), width: 1.3)
        }
        let illustration = gauge.themedBox(art.minX + art.width * 0.15, art.minY + art.height * 0.19, art.width * 0.7, art.height * 0.62)
        gauge.shape(design.subject, in: illustration, color: gauge.ink.opacity(0.83), stroke: 2.5)
      }
      shape(design.outline, in: art, color: secondary.opacity(0.75), stroke: 1.2)
    } else {
      shape(design.subject, in: art, color: secondary.opacity(wide ? 0.78 : 0.36), stroke: 2.2)
      let x: CGFloat = wide ? 155 : large ? 35 : 14
      let w: CGFloat = wide ? 191 : size.width - x * 2
      let y: CGFloat = large ? 253 : wide ? 101 : 111
      let h: CGFloat = large ? 50 : 21
      switch design.gauge {
      case "tiles":
        let tile = w / 10
        for i in 0..<10 {
          let amount = max(0, min(1, CGFloat(percent ?? 0) / 10 - CGFloat(i)))
          let b = themedBox(x + CGFloat(i) * tile, y, tile - 1, h)
          shape(design.outline, in: b, color: secondary.opacity(0.18))
          if amount > 0 {
            var gauge = self
            gauge.context.clip(to: Path(themedBox(b.minX, b.minY, b.width * amount, b.height)))
            gauge.shape(design.outline, in: b, color: accent)
          }
        }
      case "trail":
        let baseline = y + h * 0.55, lift = h * 0.48
        func travel(_ fraction: CGFloat) -> CGFloat { baseline - sin(fraction * .pi) * lift }
        func track(_ end: CGFloat) -> Path {
          var path = Path()
          for i in 0...24 {
            let fraction = CGFloat(i) / 24 * end
            let p = CGPoint(x: x + w * fraction, y: travel(fraction))
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
          }
          return path
        }
        let stroke = StrokeStyle(lineWidth: large ? 7 : 4, lineCap: .round, lineJoin: .round)
        context.stroke(track(1), with: .color(secondary.opacity(0.23)), style: stroke)
        if let level = percent, level > 0 {
          let progress = CGFloat(level) / 100
          context.stroke(track(progress), with: .color(accent), style: stroke)
          circle(x + w * progress, travel(progress), large ? 6 : 3.5, color: ink)
        }
      default:
        let tank = themedBox(x, y - 3, w, h + 6)
        shape(design.outline, in: tank, color: secondary.opacity(0.18))
        clipped(to: design.inner, in: tank) { gauge in
          if let level = percent, level > 0 { gauge.rect(x, tank.minY, w * CGFloat(level) / 100, tank.height, radius: 0, color: gauge.accent.opacity(0.9)) }
          gauge.shape(design.detail, in: tank, color: gauge.ink.opacity(0.38), stroke: 0.65)
        }
        shape(design.outline, in: tank, color: secondary.opacity(0.5), stroke: 0.6)
      }
    }
    if !wide && !column {
      rect(valueX - valueWidth / 2, valueY - (large ? 47 : 27), valueWidth, large ? 94 : 54, radius: large ? 30 : 15, color: Color(hex: spec.background[0]).opacity(0.72))
    }
    text(value, x: valueX, y: valueY, font: large ? 85 : wide ? 67 : column ? 41 : 52, width: valueWidth, weight: .bold)
    text(label, x: valueX, y: large ? (column ? 234 : 327) : wide ? 144 : 148, font: large ? 23 : 13, width: valueWidth, color: secondary)
  }

  func themedCalendar(_ design: WidgetIdentity, date: Date, wide: Bool, large: Bool, rtl: Bool) {
    guard let month = DesignedMonth.make(date: date, calendar: calendar) else { return }
    let w = size.width, h = size.height
    let gridX: CGFloat = wide ? 148 : large ? 25 : 12
    let gridW: CGFloat = wide ? 203 : large ? 314 : 146
    let top: CGFloat = wide ? 34 : large ? 106 : 50
    let row: CGFloat = wide ? 17.4 : large ? 34 : 15
    let col = gridW / 7
    let header = themedBox(7, 7, wide ? 129 : w - 14, wide ? h - 14 : large ? 79 : 35)
    switch design.calendar {
    case "band":
      rect(header.minX, header.minY, header.width, header.height, radius: large ? 12 : 7, color: accent.opacity(0.22))
    case "folio":
      rect(6, 6, w - 12, h - 12, radius: large ? 22 : 11, color: ink.opacity(0.047))
      line(wide ? 139 : 8, 13, wide ? 139 : 8, h - 13, color: accent.opacity(0.52), width: 1.5)
    case "ticket":
      rect(header.minX, header.minY, header.width, header.height, radius: large ? 16 : 7, color: ink.opacity(0.095))
      for i in 0..<13 {
        let x: CGFloat = wide ? 138 : 13 + (w - 26) * CGFloat(i) / 12
        let y: CGFloat = wide ? 14 + (h - 28) * CGFloat(i) / 12 : large ? 91 : 43
        line(x, y, x + (wide ? 0 : 4), y + (wide ? 4 : 0), color: secondary.opacity(0.48))
      }
    default:
      let opacity = design.calendar == "board" ? 0.24 : 0.3
      for i in 0..<7 {
        let y = top + row * (0.65 + CGFloat(i))
        line(gridX, y, gridX + gridW, y, color: secondary.opacity(opacity), width: 0.65)
      }
      if design.calendar == "board" {
        for i in 0...7 {
          let x = gridX + CGFloat(i) * col
          line(x, top - row * 0.47, x, top + row * 6.65, color: secondary.opacity(0.21), width: 0.65)
        }
      }
    }
    let subject = wide ? themedBox(26, 24, 91, 115) : large ? themedBox(226, 5, 106, 78) : themedBox(120, 5, 42, 36)
    shape(design.detail, in: themedBox(gridX + gridW * 0.11, top + row, gridW * 0.78, row * 5.4), color: accent.opacity(0.16), stroke: 1.3)
    shape(design.subject, in: subject, color: secondary.opacity(wide ? 0.39 : 0.60), stroke: wide ? 1.7 : 2.6)
    if wide {
      rect(19, 54, 108, 62, radius: 12, color: Color(hex: spec.background[0]).opacity(0.72))
      text(dateText(date, "EEE"), x: 72, y: 40, font: 15, width: 108, color: secondary)
      text(number(month.today), x: 72, y: 84, font: 54, width: 102, weight: .bold)
      text(dateText(date, "MMM y"), x: 72, y: 131, font: 14, width: 114, color: secondary)
    } else {
      text(dateText(date, "LLLL"), x: large ? 24 : 16, y: large ? 35 : 22, font: large ? 33 : 18, width: large ? 193 : 99, weight: .bold, anchor: .leading)
      text(dateText(date, "y"), x: large ? 25 : 17, y: large ? 69 : 37, font: large ? 16 : 10, width: 75, color: secondary, weight: .semibold, anchor: .leading)
    }
    let f = DateFormatter(); f.locale = locale; f.calendar = calendar; f.timeZone = timeZone
    let symbols = f.veryShortStandaloneWeekdaySymbols ?? ["S", "M", "T", "W", "T", "F", "S"]
    for i in 0..<7 {
      let weekday = (calendar.firstWeekday - 1 + i) % 7
      let x = gridX + (CGFloat(rtl ? 6 - i : i) + 0.5) * col
      text(symbols[weekday], x: x, y: top, font: large ? 15 : 10, width: col, color: secondary, weight: .semibold)
    }
    for i in 0..<42 {
      guard let day = month.day(at: i) else { continue }
      let column = i % 7
      let x = gridX + (CGFloat(rtl ? 6 - column : column) + 0.5) * col
      let y = top + row * (CGFloat(i / 7) + 1.18)
      let today = day == month.today, diameter: CGFloat = large ? 31 : 18
      if today { shape(design.outline, in: themedBox(x - diameter / 2, y - diameter / 2, diameter), color: accent) }
      text(number(day), x: x, y: y, font: large ? 19 : 12, width: col - 1, color: today ? Color(hex: spec.onAccent) : ink, weight: today ? .bold : .medium)
    }
  }
}
