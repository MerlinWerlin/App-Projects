// Jared, 4 Nov 2026: readable functional widgets, styled like each theme's icons. All vector
// ornament below is original and subordinate to the information; no reused decorative raster.
import SwiftUI
import UIKit
import WidgetKit

struct DesignedWidgetSpec {
  let kind: String
  let background: [String]
  let ink: String
  let secondary: String
  let accent: String
  let onAccent: String
  let line: String
  let motif: String
  let font: String
  let clock: String
  let battery: String

  static func parse(_ raw: Any?) -> DesignedWidgetSpec? {
    guard let r = raw as? [String: Any], r["v"] as? Int == 1,
      let kind = r["kind"] as? String, ["clock", "battery", "calendar"].contains(kind),
      let bg = r["background"] as? [String], bg.count == 2, bg.allSatisfy(Color.isHex),
      let ink = r["ink"] as? String, Color.isHex(ink),
      let secondary = r["secondary"] as? String, Color.isHex(secondary),
      let accent = r["accent"] as? String, Color.isHex(accent),
      let onAccent = r["onAccent"] as? String, Color.isHex(onAccent),
      let line = r["line"] as? String, Color.isHex(line),
      let motif = r["motif"] as? String, ["stars", "orbit", "leaf", "wave", "grid", "diamond", "flower", "stitch", "none"].contains(motif),
      let font = r["font"] as? String, ["rounded", "serif", "mono"].contains(font),
      let clock = r["clock"] as? String, ["dial", "digital", "split"].contains(clock),
      let battery = r["battery"] as? String, ["ring", "cells", "meter"].contains(battery)
    else { return nil }
    return DesignedWidgetSpec(kind: kind, background: bg, ink: ink, secondary: secondary,
      accent: accent, onAccent: onAccent, line: line, motif: motif, font: font, clock: clock, battery: battery)
  }

  var fontDesign: Font.Design { font == "serif" ? .serif : font == "mono" ? .monospaced : .rounded }
}

struct DesignedMonth {
  let days: Int
  let today: Int
  let offset: Int
  let first: Date
  static func make(date: Date, calendar: Calendar) -> DesignedMonth? {
    guard let first = calendar.dateInterval(of: .month, for: date)?.start,
      let range = calendar.range(of: .day, in: .month, for: date) else { return nil }
    return DesignedMonth(days: range.count, today: calendar.component(.day, from: date),
      offset: (calendar.component(.weekday, from: first) - calendar.firstWeekday + 7) % 7, first: first)
  }
  func day(at cell: Int) -> Int? {
    let d = cell - offset + 1
    return (1...days).contains(d) ? d : nil
  }
}

/// The actual production renderer, also used by the simulator visual review host. Layout adapts
/// to the widget's real dimensions, independent of its stored image, Fit/Fill setting or device.
struct DesignedWidgetContent: View {
  let spec: DesignedWidgetSpec
  let date: Date
  var readings: LiveArtReadings = .device
  @Environment(\.locale) private var locale
  @Environment(\.calendar) private var calendar
  @Environment(\.timeZone) private var timeZone
  @Environment(\.layoutDirection) private var direction

  private var civilCalendar: Calendar { var c = calendar; c.timeZone = timeZone; return c }
  var body: some View {
    ZStack {
      LinearGradient(colors: spec.background.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing)
      Canvas { ctx, actual in
        let wide = actual.width / actual.height > 1.5
        let large = !wide && actual.width > 240
        let size = CGSize(width: wide || large ? 364 : 170, height: wide ? 170 : large ? 382 : 170)
        var context = ctx
        context.scaleBy(x: actual.width / size.width, y: actual.height / size.height)
        var draw = DesignedDrawing(context: context, spec: spec, size: size, locale: locale, calendar: civilCalendar, timeZone: timeZone)
        draw.ornament()
        switch spec.kind {
        case "clock": draw.clock(date: date, wide: wide, large: large)
        case "battery": draw.battery(percent: readings.battery, wide: wide, large: large)
        default: draw.month(date: date, wide: wide, large: large, rtl: direction == .rightToLeft)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilityText)
  }

  private var accessibilityText: String {
    let fullDate = LiveDateText.format(date, template: "EEEE d MMMM yyyy", locale: locale, calendar: civilCalendar, timeZone: timeZone)
    if spec.kind == "calendar" { return fullDate }
    if spec.kind == "clock" {
      return LiveDateText.format(date, template: "jmm", locale: locale, calendar: civilCalendar, timeZone: timeZone) + ", " + fullDate
    }
    let label = NSLocalizedString("Battery", comment: "Battery widget")
    guard let level = readings.battery else { return label + ", " + NSLocalizedString("Unavailable", comment: "Unavailable reading") }
    let f = NumberFormatter(); f.locale = locale; f.numberStyle = .percent; f.maximumFractionDigits = 0
    return label + ", " + (f.string(from: NSNumber(value: Double(level) / 100)) ?? "\(level)%")
  }
}

// Design-space coordinates keep the small widget's minimum day text at 12pt and live values at
// 42pt or larger. Text measures before drawing so locale strings cannot spill over their bounds.
struct DesignedDrawing {
  var context: GraphicsContext
  let spec: DesignedWidgetSpec
  let size: CGSize
  let locale: Locale
  let calendar: Calendar
  let timeZone: TimeZone
  var ink: Color { Color(hex: spec.ink) }
  var secondary: Color { Color(hex: spec.secondary) }
  var accent: Color { Color(hex: spec.accent) }
  var lineColor: Color { Color(hex: spec.line) }

  func text(_ value: String, x: CGFloat, y: CGFloat, font: CGFloat, width: CGFloat, color: Color? = nil, weight: Font.Weight = .medium, anchor: UnitPoint = .center) {
    var pointSize = font
    let minimum = font * 0.64
    var resolved = context.resolve(Text(value).font(.system(size: pointSize, weight: weight, design: spec.fontDesign)).monospacedDigit().foregroundColor(color ?? ink))
    while resolved.measure(in: CGSize(width: 10000, height: 1000)).width > width && pointSize > minimum {
      pointSize -= 0.5
      resolved = context.resolve(Text(value).font(.system(size: pointSize, weight: weight, design: spec.fontDesign)).monospacedDigit().foregroundColor(color ?? ink))
    }
    context.draw(resolved, at: CGPoint(x: x, y: y), anchor: anchor)
  }
  func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, color: Color, width: CGFloat = 1) {
    var p = Path(); p.move(to: CGPoint(x: x1, y: y1)); p.addLine(to: CGPoint(x: x2, y: y2))
    context.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round))
  }
  func circle(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, color: Color, width: CGFloat? = nil) {
    let p = Path(ellipseIn: CGRect(x: x-r, y: y-r, width: r*2, height: r*2))
    if let width = width { context.stroke(p, with: .color(color), lineWidth: width) } else { context.fill(p, with: .color(color)) }
  }
  func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, radius: CGFloat, color: Color) {
    context.fill(Path(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: radius), with: .color(color))
  }
  func number(_ n: Int, digits: Int = 1) -> String {
    let f = NumberFormatter(); f.locale = locale; f.numberStyle = .decimal; f.usesGroupingSeparator = false; f.minimumIntegerDigits = digits
    return f.string(from: NSNumber(value: n)) ?? String(n)
  }
  func dateText(_ d: Date, _ template: String) -> String {
    LiveDateText.format(d, template: template, locale: locale, calendar: calendar, timeZone: timeZone)
  }
  func clockParts(_ date: Date) -> (time: String, period: String) {
    let uses12 = (DateFormatter.dateFormat(fromTemplate:"j",options:0,locale:locale) ?? "H").contains("a")
    let hour = calendar.component(.hour, from:date), minute = calendar.component(.minute, from:date)
    let value = uses12 ? (hour % 12 == 0 ? 12 : hour % 12) : hour
    return (number(value) + ":" + number(minute,digits:2), uses12 ? dateText(date,"a") : "")
  }

  // Original small corner studies: orbital arcs, cut leaves, wave ribbons, petals and stitch marks.
  // They are low-contrast, remain outside all data bounds, and match the theme's icon colours.
  mutating func ornament() {
    let w = size.width, h = size.height, c = accent.opacity(0.24)
    switch spec.motif {
    case "orbit":
      var p = Path(); p.addArc(center: CGPoint(x: w-8, y: 8), radius: 29, startAngle: .degrees(75), endAngle: .degrees(195), clockwise: false)
      context.stroke(p, with: .color(c), lineWidth: 1); circle(w-28, 30, 2.5, color: accent.opacity(0.6))
    case "stars":
      for (x,y,r) in [(w-18,CGFloat(18),CGFloat(5)),(w-32,CGFloat(8),CGFloat(2))] {
        line(x-r,y,x+r,y,color:c);line(x,y-r,x,y+r,color:c)
      }
    case "leaf":
      var p = Path(); p.move(to: CGPoint(x: w-34,y: h-8));p.addQuadCurve(to: CGPoint(x:w-8,y:h-34),control:CGPoint(x:w-33,y:h-33));p.addQuadCurve(to:CGPoint(x:w-34,y:h-8),control:CGPoint(x:w-9,y:h-9));context.stroke(p,with:.color(c),lineWidth:1)
      line(w-33,h-9,w-11,h-31,color:c)
    case "wave":
      for dy in [CGFloat(0),CGFloat(5)] { var p=Path();p.move(to:CGPoint(x:8,y:h-8-dy));p.addCurve(to:CGPoint(x:49,y:h-8-dy),control1:CGPoint(x:23,y:h-21-dy),control2:CGPoint(x:32,y:h+5-dy));context.stroke(p,with:.color(c),lineWidth:1) }
    case "grid":
      for i in 0..<3 { let a=CGFloat(i)*5;line(w-24+a,8,w-24+a,22,color:c);line(w-24,8+a,w-10,8+a,color:c) }
    case "diamond":
      var p=Path();p.move(to:CGPoint(x:w-18,y:8));p.addLine(to:CGPoint(x:w-10,y:16));p.addLine(to:CGPoint(x:w-18,y:24));p.addLine(to:CGPoint(x:w-26,y:16));p.closeSubpath();context.stroke(p,with:.color(c),lineWidth:1)
    case "flower":
      for i in 0..<5 {let a=Double(i)*2*Double.pi/5;circle(w-18+CGFloat(cos(a))*5,17+CGFloat(sin(a))*5,3,color:c,width:1)}
    case "stitch":
      for i in 0..<4 { let x=CGFloat(10+i*6);line(x,h-8,x+3,h-11,color:c) }
    default: break
    }
  }

  mutating func clock(date: Date, wide: Bool, large: Bool) {
    let w=size.width
    if spec.clock == "dial" {
      let cx:CGFloat = wide ? 84 : w/2, cy:CGFloat = large ? 159 : 79
      let r:CGFloat = large ? 126 : 61
      circle(cx,cy,r,color:lineColor.opacity(0.26),width:1)
      for tick in 0..<60 {
        let a=Double(tick)*Double.pi/30-Double.pi/2, major=tick%5==0
        let inside=r-(major ? 10 : 4)
        line(cx+CGFloat(cos(a))*inside,cy+CGFloat(sin(a))*inside,cx+CGFloat(cos(a))*(r-2),cy+CGFloat(sin(a))*(r-2),color:major ? accent : lineColor.opacity(0.5),width:major ? 1.8 : 0.7)
      }
      for (n,a) in [(12,-Double.pi/2),(3,0),(6,Double.pi/2),(9,Double.pi)] {
        text(number(n),x:cx+CGFloat(cos(a))*(r-23),y:cy+CGFloat(sin(a))*(r-23),font:large ? 19 : 12,width:35,color:secondary)
      }
      let hour=Double(calendar.component(.hour,from:date)%12), minute=Double(calendar.component(.minute,from:date))
      let ha=(hour+minute/60)*Double.pi/6-Double.pi/2, ma=minute*Double.pi/30-Double.pi/2
      line(cx,cy,cx+CGFloat(cos(ha))*r*0.46,cy+CGFloat(sin(ha))*r*0.46,color:ink,width:large ? 7 : 4)
      line(cx,cy,cx+CGFloat(cos(ma))*r*0.72,cy+CGFloat(sin(ma))*r*0.72,color:accent,width:large ? 4 : 2.8)
      circle(cx,cy,large ? 6 : 4,color:accent)
      if wide {
        let parts = clockParts(date)
        text(parts.time,x:264,y:61,font:48,width:164,weight:.semibold)
        if !parts.period.isEmpty {text(parts.period,x:264,y:93,font:11,width:164,color:secondary)}
        text(dateText(date,"EEE d MMM"),x:264,y:121,font:15,width:164,color:secondary)
        line(172,37,172,133,color:lineColor.opacity(0.18))
      } else if large {
        text(dateText(date,"jmm"),x:w/2,y:313,font:34,width:w-40,weight:.semibold)
        text(dateText(date,"EEEE d MMMM"),x:w/2,y:352,font:17,width:w-40,color:secondary)
      } else {
        text(dateText(date,"EEE d MMM"),x:w/2,y:150,font:13,width:w-28,color:secondary)
      }
      return
    }
    if spec.clock == "split" {
      let centerX:CGFloat=wide ? 131 : w/2, centerY:CGFloat=large ? 164 : 78
      let bw:CGFloat=large ? 128 : wide ? 104 : 65, bh:CGFloat=large ? 170 : 84, gap:CGFloat=large ? 12 : 7
      let left=centerX-gap/2-bw, right=centerX+gap/2
      for x in [left,right] {rect(x,centerY-bh/2,bw,bh,radius:large ? 15 : 8,color:ink.opacity(0.055));line(x+4,centerY,x+bw-4,centerY,color:lineColor.opacity(0.17))}
      let f=DateFormatter();f.locale=locale;f.calendar=calendar;f.timeZone=timeZone
      let uses12=(DateFormatter.dateFormat(fromTemplate:"j",options:0,locale:locale) ?? "H").contains("a")
      let hour=calendar.component(.hour,from:date), displayHour=uses12 ? (hour%12==0 ? 12 : hour%12) : hour
      text(number(displayHour,digits:2),x:left+bw/2,y:centerY,font:large ? 92 : wide ? 64 : 42,width:bw-6,weight:.semibold)
      text(number(calendar.component(.minute,from:date),digits:2),x:right+bw/2,y:centerY,font:large ? 92 : wide ? 64 : 42,width:bw-6,weight:.semibold)
      if wide {text(dateText(date,"EEE"),x:310,y:66,font:16,width:83,color:accent);text(dateText(date,"d MMM"),x:310,y:98,font:15,width:83,color:secondary)}
      else {text(dateText(date,"EEEE d MMM"),x:w/2,y:large ? 307 : 145,font:large ? 20 : 13,width:w-26,color:secondary)}
      // Include AM/PM where the system uses a 12-hour clock.
      if uses12 {text(dateText(date,"a"),x:wide ? 310 : w/2,y:large ? 266 : wide ? 127 : 122,font:large ? 14 : 11,width:wide ? 83 : w-28,color:secondary)}
    } else {
      let parts = clockParts(date)
      text(parts.time,x:w/2,y:large ? 166 : 73,font:large ? 96 : wide ? 78 : 54,width:w-28,weight:.semibold)
      if !parts.period.isEmpty {text(parts.period,x:w/2,y:large ? 228 : 106,font:large ? 17 : 11,width:w-28,color:secondary)}
      text(dateText(date,large || wide ? "EEEE d MMMM" : "EEE d MMM"),x:w/2,y:large ? 274 : 132,font:large ? 23 : 13,width:w-28,color:secondary)
      line(w*0.3,large ? 302 : 151,w*0.7,large ? 302 : 151,color:accent.opacity(0.45),width:2)
    }
  }

  mutating func battery(percent: Int?, wide: Bool, large: Bool) {
    let w=size.width,h=size.height
    let value=percent.map { number($0) } ?? "â€”"
    let label=NSLocalizedString("Battery",comment:"Battery widget")
    if spec.battery == "ring" {
      let cx:CGFloat=wide ? 88 : w/2,cy:CGFloat=large ? 161 : 78,r:CGFloat=large ? 118 : 57
      circle(cx,cy,r,color:lineColor.opacity(0.14),width:large ? 13 : 7)
      if let level=percent,level>0 {
        var p=Path();p.addArc(center:CGPoint(x:cx,y:cy),radius:r,startAngle:.degrees(-90),endAngle:.degrees(-90+Double(level)*3.6),clockwise:false)
        context.stroke(p,with:.color(accent),style:StrokeStyle(lineWidth:large ? 13 : 7,lineCap:.round))
      }
      text(value,x:cx,y:cy-4,font:large ? 84 : 44,width:r*1.65,weight:.semibold)
      if percent != nil {text("%",x:cx,y:cy+(large ? 48 : 27),font:large ? 24 : 14,width:40,color:secondary)}
      if wide {text(label,x:267,y:64,font:23,width:154,color:secondary);text(percent == nil ? NSLocalizedString("Unavailable",comment:"") : percent == 100 ? NSLocalizedString("Full",comment:"") : NSLocalizedString("Remaining",comment:""),x:267,y:102,font:15,width:154,color:secondary)}
      else {text(label,x:w/2,y:large ? 327 : 150,font:large ? 23 : 13,width:w-26,color:secondary)}
    } else {
      let y:CGFloat=large ? 133 : 64
      text(value+(percent == nil ? "" : "%"),x:w/2,y:y,font:large ? 92 : wide ? 65 : 51,width:w-24,weight:.semibold)
      let barX:CGFloat=wide || large ? 35 : 22,barW=w-barX*2,barY:CGFloat=large ? 225 : 109,barH:CGFloat=large ? 40 : 19
      if spec.battery == "cells" {
        let gap:CGFloat=large ? 6 : 3,cellW=(barW-9*gap)/10
        for i in 0..<10 {
          let x=barX+CGFloat(i)*(cellW+gap)
          rect(x,barY,cellW,barH,radius:large ? 5 : 2,color:lineColor.opacity(0.14))
          if let p=percent { let fill=max(0,min(1,CGFloat(p)/10-CGFloat(i)));if fill>0 {rect(x,barY,cellW*fill,barH,radius:large ? 5 : 2,color:accent)} }
        }
      } else {
        rect(barX,barY,barW,barH,radius:barH/2,color:lineColor.opacity(0.14))
        if let p=percent,p>0 {rect(barX,barY,barW*CGFloat(p)/100,barH,radius:barH/2,color:accent)}
        for i in 1..<4 {let x=barX+barW*CGFloat(i)/4;line(x,barY+4,x,barY+barH-4,color:Color(hex:spec.background[0]).opacity(0.8))}
      }
      text(label,x:w/2,y:large ? 319 : 150,font:large ? 23 : 13,width:w-26,color:secondary)
    }
    if large && percent == nil {text(NSLocalizedString("Unavailable",comment:""),x:w/2,y:h-27,font:15,width:w-30,color:secondary)}
  }

  mutating func month(date: Date, wide: Bool, large: Bool, rtl: Bool) {
    guard let month=DesignedMonth.make(date:date,calendar:calendar) else {return}
    let w=size.width
    let gridX:CGFloat=wide ? 148 : large ? 26 : 12
    let gridW:CGFloat=wide ? 201 : large ? 312 : 146
    let top:CGFloat=wide ? 37 : large ? 104 : 52
    let rowH:CGFloat=wide ? 17 : large ? 34 : 15
    let colW=gridW/7
    if wide {
      text(dateText(date,"EEE"),x:74,y:32,font:16,width:116,color:accent)
      text(number(month.today),x:74,y:82,font:62,width:116,weight:.semibold)
      text(dateText(date,"MMM y"),x:74,y:135,font:14,width:116,color:secondary)
      line(137,23,137,148,color:lineColor.opacity(0.18))
    } else {
      if large {
        text(dateText(date,"LLLL"),x:27,y:39,font:29,width:220,color:ink,weight:.semibold,anchor:.leading)
        text(dateText(date,"y"),x:w-27,y:42,font:16,width:70,color:secondary,anchor:.trailing)
      } else {
        text(dateText(date,"LLLL"),x:66,y:24,font:17,width:104,color:ink,weight:.semibold)
        text(dateText(date,"y"),x:142,y:25,font:11,width:32,color:secondary)
      }
      if large {text(dateText(date,"EEEE d"),x:27,y:75,font:16,width:280,color:secondary,anchor:.leading)}
    }
    let f=DateFormatter();f.locale=locale;f.calendar=calendar;f.timeZone=timeZone
    let symbols=f.veryShortStandaloneWeekdaySymbols ?? ["S","M","T","W","T","F","S"]
    for col in 0..<7 {
      let weekday=(calendar.firstWeekday-1+col)%7,physical=rtl ? 6-col : col
      let x=gridX+(CGFloat(physical)+0.5)*colW
      text(symbols[weekday],x:x,y:top,font:large ? 15 : 10,width:colW,color:secondary,weight:.semibold)
    }
    for cell in 0..<42 {
      guard let day=month.day(at:cell) else {continue}
      let col=cell%7,row=cell/7,physical=rtl ? 6-col : col
      let x=gridX+(CGFloat(physical)+0.5)*colW,y=top+rowH*(CGFloat(row)+1.18)
      let selected=day==month.today
      if selected {circle(x,y,large ? 14 : 9,color:accent)}
      text(number(day),x:x,y:y,font:large ? 19 : 12,width:colW,color:selected ? Color(hex:spec.onAccent) : ink,weight:selected ? .bold : .medium)
    }
    if large {line(27,350,w-27,350,color:lineColor.opacity(0.15))}
  }
}
