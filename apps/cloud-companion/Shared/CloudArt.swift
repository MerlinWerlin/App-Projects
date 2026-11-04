import SwiftUI

enum SkyPalette {
    static let ink = Color(red: 0.20, green: 0.27, blue: 0.33)
    static let paper = Color(red: 0.98, green: 0.97, blue: 0.94)
    static let blue = Color(red: 0.78, green: 0.89, blue: 0.94)
    static let orange = Color(red: 0.97, green: 0.71, blue: 0.45)
    static func sky(_ mood: CloudMood) -> Color {
        switch mood {
        case .sleepy: return Color(red: 0.20, green: 0.28, blue: 0.43)
        case .stormy, .rainy: return Color(red: 0.72, green: 0.79, blue: 0.87)
        case .sunny: return Color(red: 0.99, green: 0.88, blue: 0.66)
        case .snowy, .misty: return Color(red: 0.85, green: 0.89, blue: 0.89)
        default: return blue
        }
    }
}

struct CloudOutline: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * r.width, y: r.minY + y * r.height) }
        p.move(to: point(0.20, 0.82))
        p.addCurve(to: point(0.16, 0.40), control1: point(-0.02, 0.80), control2: point(-0.02, 0.42))
        p.addCurve(to: point(0.49, 0.18), control1: point(0.16, 0.14), control2: point(0.36, 0.02))
        p.addCurve(to: point(0.82, 0.36), control1: point(0.65, 0.02), control2: point(0.82, 0.15))
        p.addCurve(to: point(0.81, 0.82), control1: point(1.06, 0.33), control2: point(1.08, 0.80))
        p.addQuadCurve(to: point(0.20, 0.82), control: point(0.51, 0.90))
        p.closeSubpath()
        return p
    }
}

struct CloudArt: View {
    var mood: CloudMood
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                if mood == .sunny || mood == .cloudy {
                    Circle().fill(SkyPalette.orange).frame(width: w * 0.37, height: w * 0.37)
                        .overlay(Circle().stroke(SkyPalette.ink.opacity(0.8), lineWidth: 2))
                        .position(x: w * 0.77, y: h * 0.26)
                }
                if mood == .sleepy {
                    Image(systemName: "moon.stars.fill").font(.system(size: w * 0.24))
                        .foregroundStyle(Color(red: 1, green: 0.87, blue: 0.58))
                        .position(x: w * 0.82, y: h * 0.24)
                }
                CloudOutline().fill(mood == .stormy ? Color(red: 0.69, green: 0.73, blue: 0.81) : .white)
                    .overlay(CloudOutline().stroke(SkyPalette.ink, style: StrokeStyle(lineWidth: max(1.5, w * 0.009), lineCap: .round)))
                    .frame(width: w * 0.9, height: h * 0.77).position(x: w * 0.47, y: h * 0.47)
                HStack(spacing: w * 0.12) {
                    eye(width: w)
                    eye(width: w)
                }.position(x: w * 0.47, y: h * 0.46)
                HStack(spacing: w * 0.27) {
                    Capsule().fill(Color.pink.opacity(0.30)).frame(width: w * 0.08, height: h * 0.035)
                    Capsule().fill(Color.pink.opacity(0.30)).frame(width: w * 0.08, height: h * 0.035)
                }.position(x: w * 0.47, y: h * 0.53)
                Image(systemName: mood == .stormy ? "minus" : "mouth")
                    .font(.system(size: w * 0.075, weight: .medium)).foregroundStyle(SkyPalette.ink)
                    .rotationEffect(.degrees(mood == .stormy ? -10 : 0))
                    .position(x: w * 0.47, y: h * 0.56)
                if [.rainy, .stormy, .snowy, .windy, .misty].contains(mood) {
                    HStack(spacing: w * 0.10) {
                        ForEach(0..<3) { _ in
                            Image(systemName: particle).font(.system(size: w * 0.09, weight: .medium))
                        }
                    }.foregroundStyle(mood == .stormy ? SkyPalette.orange : SkyPalette.ink.opacity(0.65))
                        .position(x: w * 0.48, y: h * 0.88)
                }
                if mood == .sleepy {
                    Text("z z").font(.system(size: w * 0.09, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8)).position(x: w * 0.81, y: h * 0.63)
                }
            }
        }.accessibilityLabel("A \(mood.rawValue) cloud companion").accessibilityAddTraits(.isImage)
    }
    @ViewBuilder private func eye(width: CGFloat) -> some View {
        if mood == .sleepy {
            Capsule().fill(SkyPalette.ink).frame(width: width * 0.045, height: width * 0.009)
        } else {
            Capsule().fill(SkyPalette.ink).frame(width: width * 0.022, height: width * 0.042)
        }
    }
    private var particle: String {
        switch mood {
        case .stormy: return "bolt.fill"
        case .snowy: return "snowflake"
        case .windy: return "wind"
        case .misty: return "line.3.horizontal"
        default: return "drop.fill"
        }
    }
}
