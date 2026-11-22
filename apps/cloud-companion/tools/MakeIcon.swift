import AppKit
import CoreGraphics

// Original vector icon, rendered on the Mac build host. No downloaded artwork.
let size = 1024
let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                        space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let colors = [CGColor(red: 0.75, green: 0.88, blue: 0.94, alpha: 1), CGColor(red: 0.89, green: 0.95, blue: 0.96, alpha: 1)] as CFArray
let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: [0, 1])!
context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 1024), end: .zero, options: [])
context.setFillColor(CGColor(red: 0.99, green: 0.77, blue: 0.45, alpha: 1))
context.fillEllipse(in: CGRect(x: 640, y: 590, width: 245, height: 245))
context.saveGState()
context.translateBy(x: 105, y: 230); context.scaleBy(x: 810, y: 650)
let cloud = CGMutablePath()
cloud.move(to: CGPoint(x: 0.20, y: 0.18))
cloud.addCurve(to: CGPoint(x: 0.16, y: 0.60), control1: CGPoint(x: -0.02, y: 0.20), control2: CGPoint(x: -0.02, y: 0.58))
cloud.addCurve(to: CGPoint(x: 0.49, y: 0.82), control1: CGPoint(x: 0.16, y: 0.86), control2: CGPoint(x: 0.36, y: 0.98))
cloud.addCurve(to: CGPoint(x: 0.82, y: 0.64), control1: CGPoint(x: 0.65, y: 0.98), control2: CGPoint(x: 0.82, y: 0.85))
cloud.addCurve(to: CGPoint(x: 0.81, y: 0.18), control1: CGPoint(x: 1.06, y: 0.67), control2: CGPoint(x: 1.08, y: 0.20))
cloud.addQuadCurve(to: CGPoint(x: 0.20, y: 0.18), control: CGPoint(x: 0.51, y: 0.10)); cloud.closeSubpath()
context.addPath(cloud); context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fillPath()
context.restoreGState()
let ink = CGColor(red: 0.20, green: 0.27, blue: 0.33, alpha: 1)
context.setFillColor(ink)
context.fillEllipse(in: CGRect(x: 415, y: 470, width: 23, height: 39))
context.fillEllipse(in: CGRect(x: 560, y: 470, width: 23, height: 39))
context.setFillColor(CGColor(red: 0.99, green: 0.74, blue: 0.76, alpha: 1))
context.fillEllipse(in: CGRect(x: 355, y: 426, width: 69, height: 22))
context.fillEllipse(in: CGRect(x: 583, y: 426, width: 69, height: 22))
context.move(to: CGPoint(x: 474, y: 439)); context.addQuadCurve(to: CGPoint(x: 526, y: 439), control: CGPoint(x: 500, y: 410))
context.setStrokeColor(ink); context.setLineWidth(7); context.setLineCap(.round); context.strokePath()
let image = context.makeImage()!
let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
let output = URL(fileURLWithPath: "App/Assets.xcassets/AppIcon.appiconset/icon.png")
try png.write(to: output)
print("Rendered original 1024px Cloud Companion icon")
