// Rasterize the production GraphicsContext text helper with Apple's New York font.
// CI extracts that helper unchanged from DesignedWidget.swift into NativeTextProbe.
import SwiftUI
import AppKit

@MainActor
@main
struct SerifNativeCheck {
  static func main() throws {
    let output = URL(fileURLWithPath: CommandLine.arguments[1])
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    var records: [[String: Any]] = []
    for value in ["0%", "73%", "100%"] {
      let bounds = try capture(value, font: 67, width: 183, x: 250, y: 67, canvas: CGSize(width: 364, height: 170), output: output).bounds
      guard bounds.maxY <= 96 else { throw Failure.message("New York \(value) reaches \(bounds.maxY), too close to gauge at 98") }
      records.append(["value": value, "bounds": [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]])
    }
    var glyphs: [String: Raster] = [:]
    var calendarBounds: [[String: Any]] = []
    let families: [(String, Font.Design)] = [("serif", .serif), ("rounded", .rounded), ("mono", .monospaced)]
    var equalityCases = 0
    for (family, design) in families { for size in ["small", "medium", "large"] { for day in 1...31 {
      let font: CGFloat = size == "large" ? 19 : 12
      let width: CGFloat = size == "large" ? 316 / 7 - 1 : 146 / 7 - 1
      let key = "\(family)/\(font)/\(day)"
      if glyphs[key] == nil {
        glyphs[key] = try capture(String(day), font: font, width: width, x: 85, y: 85, canvas: CGSize(width: 170, height: 170), output: output, label: "\(family)-\(font)-\(day)", design: design, calendarLarge: size == "large")
      }
      let raster = glyphs[key]!, bounds = raster.bounds
      // These values come from the actual extracted production calendarDate/text
      // calls, including the generic helper's final width-fitting decision.
      guard raster.todayFont == font, raster.todayEffectiveFont == font, raster.ordinaryFont == font, raster.ordinaryEffectiveFont == font else { throw Failure.message("\(family)/\(size)/\(day): today/ordinary point size changed") }
      let half: CGFloat = size == "large" ? 15.5 : 9
      guard CGRect(x: 85 - half, y: 85 - half, width: half * 2, height: half * 2).contains(bounds) else { throw Failure.message("\(family)/\(size)/\(day): date left its value area") }
      calendarBounds.append(["family": family, "size": size, "day": day, "todayPointSize": raster.todayEffectiveFont, "ordinaryPointSize": raster.ordinaryEffectiveFont, "bounds": [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]])
      equalityCases += 1
    } } }
    let narrow = try capture("31", font: 12, width: 1, x: 85, y: 85, canvas: CGSize(width: 170, height: 170), output: output, label: "date-size-policy", calendarLarge: false)
    guard narrow.todayEffectiveFont == 12, narrow.ordinaryEffectiveFont == 12 else { throw Failure.message("Calendar dates must not use generic width shrinking") }
    guard let contours = try JSONSerialization.jsonObject(with: Data(contentsOf: output.appendingPathComponent("native-font-contours.json"))) as? [[String: Any]] else { throw Failure.message("Actual serif contours missing") }
    var markerCases = 0
    var masks: [String: Raster] = [:]
    for row in contours {
      guard let id = row["id"] as? String, let values = row["points"] as? [NSNumber], values.count >= 6, values.count % 2 == 0 else { throw Failure.message("Invalid actual marker contour") }
      var outline = Path()
      for i in stride(from: 0, to: values.count, by: 2) {
        let p = CGPoint(x: values[i].doubleValue, y: values[i + 1].doubleValue)
        if i == 0 { outline.move(to: p) } else { outline.addLine(to: p) }
      }
      outline.closeSubpath()
      for size in ["small", "medium", "large"] { for day in 1...31 {
        let font: CGFloat = size == "large" ? 19 : 12, diameter: CGFloat = size == "large" ? 31 : 18
        let key = "\(id)-\(size)-\(day < 10 ? "single" : "double")"
        if masks[key] == nil {
          let badge = CalendarBadgeShape.path(outline: outline, value: String(day), font: font, diameter: diameter)
          let path = badge.applying(CGAffineTransform(a: diameter / 100, b: 0, c: 0, d: diameter / 100, tx: 85 - diameter / 2, ty: 85 - diameter / 2))
          masks[key] = try capture("mask-\(key)", font: font, width: 30, x: 85, y: 85, canvas: CGSize(width: 170, height: 170), output: output, marker: path)
        }
        let ink = glyphs["serif/\(font)/\(day)"]!
        guard masks[key]!.bounds.insetBy(dx: -0.25, dy: -0.25).contains(ink.bounds) else { throw Failure.message("\(id)/\(size)/\(day): calendar badge bounds are too narrow") }
        markerCases += 1
      } }
    }
    let result: [String: Any] = ["font": "Apple system serif / New York, rounded and monospaced", "productionTextHelper": true, "productionCalendarDateHelper": true, "requestedAndEffectiveFontObserver": true, "productionCalendarFontFitting": false, "todaySamePointSizeAsOrdinaryDates": true, "calendarFontSizes": [12, 19], "batteryCases": 3, "calendarCases": equalityCases, "calendarWidthPolicyCases": 1, "calendarMarkerCases": markerCases, "calendarBounds": calendarBounds, "perPixelContourContainmentEnforced": false, "allChecksPassed": true, "physicalDeviceTest": false, "records": records]
    try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("native-serif-validation.json"))
    print("Apple production text: 3 Battery,\(equalityCases) fixed-size Calendar and\(markerCases) independent marker cases passed")
  }
  enum Failure: Error { case message(String) }
  struct Raster { let bounds: CGRect; let todayFont: CGFloat; let todayEffectiveFont: CGFloat; let ordinaryFont: CGFloat; let ordinaryEffectiveFont: CGFloat }
  static func capture(_ value: String, font: CGFloat, width: CGFloat, x: CGFloat, y: CGFloat, canvas: CGSize, output: URL?, marker: Path? = nil, label: String? = nil, design: Font.Design = .serif, calendarLarge: Bool? = nil) throws -> Raster {
    var todayFont: CGFloat = 0, todayEffectiveFont: CGFloat = 0, ordinaryFont: CGFloat = 0, ordinaryEffectiveFont: CGFloat = 0
    let view = Canvas { context, _ in
      if let marker = marker { context.fill(marker, with: .color(.white)) }
      else {
        let probe = NativeTextProbe(context: context, spec: .init(fontDesign: design), fontObserver: { requested, effective in todayFont = requested; todayEffectiveFont = effective })
        if let large = calendarLarge {
          probe.calendarDate(value, x: x, y: y, large: large, width: width, color: .white, today: true)
          var invisible = context; invisible.opacity = 0
          NativeTextProbe(context: invisible, spec: .init(fontDesign: design), fontObserver: { requested, effective in ordinaryFont = requested; ordinaryEffectiveFont = effective }).calendarDate(value, x: x, y: y, large: large, width: width, color: .white, today: false)
        } else { probe.text(value, x: x, y: y, font: font, width: width, weight: .bold) }
      }
    }.frame(width: canvas.width, height: canvas.height)
    let renderer = ImageRenderer(content: view); renderer.scale = 4
    guard let image = renderer.cgImage else { throw Failure.message("New York raster missing") }
    if let output = output {
      let bitmap = NSBitmapImageRep(cgImage: image)
      guard let data = bitmap.representation(using: .png, properties: [:]) else { throw Failure.message("PNG missing") }
      try data.write(to: output.appendingPathComponent("native-\((label ?? value).replacingOccurrences(of: "%", with: "pct")).png"))
    }
    let w = image.width, h = image.height, stride = w * 4
    var pixels = [UInt8](repeating: 0, count: stride * h)
    var x0 = w, y0 = h, x1 = -1, y1 = -1
    try pixels.withUnsafeMutableBytes { buffer in
      guard let cg = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: stride, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw Failure.message("RGBA context missing") }
      // Raw CGImage scanlines already match the PNG's top-to-bottom pixel order.
      cg.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
      for py in 0..<h { for px in 0..<w where buffer[py * stride + px * 4 + 3] >= 16 {
        x0 = min(x0, px); y0 = min(y0, py); x1 = max(x1, px); y1 = max(y1, py)
      } }
    }
    guard x1 >= x0 && y1 >= y0 else { throw Failure.message("New York text must actually render") }
    return Raster(bounds: CGRect(x: CGFloat(x0) / 4, y: CGFloat(y0) / 4, width: CGFloat(x1 + 1 - x0) / 4, height: CGFloat(y1 + 1 - y0) / 4), todayFont: todayFont, todayEffectiveFont: todayEffectiveFont, ordinaryFont: ordinaryFont, ordinaryEffectiveFont: ordinaryEffectiveFont)
  }
}
