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
      let bounds = try capture(value, font: 67, width: 183, x: 250, y: 67, canvas: CGSize(width: 364, height: 170), output: output)
      guard bounds.maxY <= 96 else { throw Failure.message("New York \(value) reaches \(bounds.maxY), too close to gauge at 98") }
      records.append(["value": value, "bounds": [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]])
    }
    for day in 1...31 {
      let bounds = try capture(String(day), font: 12, width: 146 / 7 - 1, x: 85, y: 85, canvas: CGSize(width: 170, height: 170), output: day == 22 ? output : nil)
      guard bounds.minX > 77, bounds.maxX < 93, bounds.minY > 77, bounds.maxY < 93 else { throw Failure.message("New York day \(day) leaves its 18pt marker: \(bounds)") }
      guard abs(bounds.midY - 85) < 2 else { throw Failure.message("New York day \(day) is not centred: \(bounds)") }
    }
    let result: [String: Any] = ["font": "Apple system serif / New York", "productionTextHelper": true, "batteryCases": 3, "calendarCases": 31, "allChecksPassed": true, "physicalDeviceTest": false, "records": records]
    try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("native-serif-validation.json"))
    print("New York production text: 3 battery and 31 calendar pixel checks passed")
  }
  enum Failure: Error { case message(String) }
  static func capture(_ value: String, font: CGFloat, width: CGFloat, x: CGFloat, y: CGFloat, canvas: CGSize, output: URL?) throws -> CGRect {
    let view = Canvas { context, _ in
      NativeTextProbe(context: context).text(value, x: x, y: y, font: font, width: width, weight: .bold)
    }.frame(width: canvas.width, height: canvas.height)
    let renderer = ImageRenderer(content: view); renderer.scale = 4
    guard let image = renderer.cgImage else { throw Failure.message("New York raster missing") }
    if let output = output {
      let bitmap = NSBitmapImageRep(cgImage: image)
      guard let data = bitmap.representation(using: .png, properties: [:]) else { throw Failure.message("PNG missing") }
      try data.write(to: output.appendingPathComponent("native-\(value.replacingOccurrences(of: "%", with: "pct")).png"))
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
    return CGRect(x: CGFloat(x0) / 4, y: CGFloat(y0) / 4, width: CGFloat(x1 + 1 - x0) / 4, height: CGFloat(y1 + 1 - y0) / 4)
  }
}
