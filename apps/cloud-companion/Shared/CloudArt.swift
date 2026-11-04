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

struct CloudSmile: Shape {
    var happy = true
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.midY),
                       control: CGPoint(x: rect.midX, y: happy ? rect.maxY : rect.minY))
        return p
    }
}

struct CloudArt: View {
    var mood: CloudMood
    var animated = false
    var delighted = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var phase
    private var moving: Bool { animated && !reduceMotion && phase == .active }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !moving)) { context in
            let time = moving ? context.date.timeIntervalSinceReferenceDate : 0
            GeometryReader { geo in
                character(width: geo.size.width, height: geo.size.height, time: time)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(delighted ? "Happy" : mood.rawValue.capitalized) cloud companion")
        .accessibilityAddTraits(.isImage)
    }

    private func character(width w: CGFloat, height h: CGFloat, time t: Double) -> some View {
        let bob = moving ? sin(t * 1.5) * h * 0.025 : 0
        let roll = mood == .windy && moving ? sin(t * 2) * 5 : 0
        let blink = moving && t.truncatingRemainder(dividingBy: 4.7) < 0.16
        return ZStack {
            ornament(width: w, height: h, time: t)
            Ellipse().fill(SkyPalette.ink.opacity(0.08)).blur(radius: 5)
                .frame(width: w * 0.55, height: h * 0.07).position(x: w * 0.49, y: h * 0.90)
            ZStack {
                CloudOutline().fill(cloudFill)
                    .overlay(CloudOutline().stroke(SkyPalette.ink.opacity(0.75), style: StrokeStyle(lineWidth: max(1.5, w * 0.007), lineCap: .round)))
                    .shadow(color: SkyPalette.ink.opacity(0.10), radius: 6, x: 0, y: 7)
                    .frame(width: w * 0.90, height: h * 0.76)
                    .position(x: w * 0.49, y: h * 0.47)
                HStack(spacing: w * 0.13) {
                    eye(width: w, closed: blink || mood == .sleepy)
                    eye(width: w, closed: blink || mood == .sleepy)
                }.position(x: w * 0.49, y: h * 0.46)
                HStack(spacing: w * 0.27) {
                    Capsule().fill(Color.pink.opacity(delighted ? 0.55 : 0.24)).frame(width: w * 0.09, height: h * 0.035)
                    Capsule().fill(Color.pink.opacity(delighted ? 0.55 : 0.24)).frame(width: w * 0.09, height: h * 0.035)
                }.position(x: w * 0.49, y: h * 0.53)
                CloudSmile(happy: mood != .stormy || delighted)
                    .stroke(SkyPalette.ink, style: StrokeStyle(lineWidth: max(1.8, w * 0.009), lineCap: .round))
                    .frame(width: w * (delighted ? 0.09 : 0.065), height: h * 0.05)
                    .position(x: w * 0.49, y: h * 0.55)
                if mood == .stormy && !delighted {
                    HStack(spacing: w * 0.10) {
                        Capsule().frame(width: w * 0.06, height: 2).rotationEffect(.degrees(20))
                        Capsule().frame(width: w * 0.06, height: 2).rotationEffect(.degrees(-20))
                    }.foregroundStyle(SkyPalette.ink).position(x: w * 0.49, y: h * 0.38)
                }
            }
            .offset(y: bob).rotationEffect(.degrees(roll))
            .scaleEffect(delighted ? 1.065 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.5), value: delighted)
            if delighted {
                HStack(spacing: w * 0.5) {
                    Image(systemName: "heart.fill").rotationEffect(.degrees(-15))
                    Image(systemName: "heart.fill").rotationEffect(.degrees(15))
                }.font(.system(size: w * 0.09)).foregroundStyle(Color(red: 0.89, green: 0.45, blue: 0.48))
                    .position(x: w * 0.5, y: h * 0.20)
            }
        }
    }

    private var cloudFill: LinearGradient {
        let bottom: Color = mood == .stormy ? Color(red: 0.58, green: 0.64, blue: 0.75) : Color(red: 0.92, green: 0.96, blue: 0.98)
        return LinearGradient(colors: [mood == .stormy ? Color(red: 0.79, green: 0.82, blue: 0.88) : .white, bottom], startPoint: .top, endPoint: .bottom)
    }
    @ViewBuilder private func eye(width w: CGFloat, closed: Bool) -> some View {
        if closed || delighted {
            CloudSmile(happy: false).stroke(SkyPalette.ink, style: StrokeStyle(lineWidth: max(1.6, w * 0.008), lineCap: .round))
                .frame(width: w * 0.04, height: w * 0.023)
        } else {
            Capsule().fill(SkyPalette.ink).frame(width: w * 0.025, height: w * 0.047)
                .overlay(alignment: .topLeading) { Circle().fill(.white).frame(width: w * 0.008).offset(x: w * 0.004, y: w * 0.005) }
        }
    }
    @ViewBuilder private func ornament(width w: CGFloat, height h: CGFloat, time t: Double) -> some View {
        if mood == .sunny || mood == .cloudy {
            Image(systemName: "sun.max.fill").font(.system(size: w * 0.39))
                .foregroundStyle(SkyPalette.orange)
                .rotationEffect(.degrees(moving ? t.truncatingRemainder(dividingBy: 80) * 4.5 : 0))
                .position(x: w * 0.78, y: h * 0.25)
        }
        if mood == .sleepy {
            Image(systemName: "moon.stars.fill").font(.system(size: w * 0.26))
                .foregroundStyle(Color(red: 1, green: 0.87, blue: 0.58)).position(x: w * 0.82, y: h * 0.22)
            Text("z z").font(.system(size: w * 0.08, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.8))
                .offset(y: moving ? -sin(t) * 5 : 0).position(x: w * 0.82, y: h * 0.59)
        }
        if [.rainy, .stormy, .snowy, .windy, .misty].contains(mood) {
            HStack(spacing: w * 0.10) {
                ForEach(0..<3) { n in
                    Image(systemName: particle).font(.system(size: w * 0.085, weight: .medium))
                        .offset(y: moving ? sin(t * 3 + Double(n)) * 4 : 0)
                }
            }.foregroundStyle(mood == .stormy ? SkyPalette.orange : SkyPalette.ink.opacity(0.50))
                .position(x: w * 0.49, y: h * 0.85)
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

struct WeatherScene: View {
    var mood: CloudMood
    var motionEnabled = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var phase
    private var moving: Bool { motionEnabled && !reduceMotion && phase == .active }
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24, paused: !moving)) { timeline in
            let t = moving ? timeline.date.timeIntervalSinceReferenceDate : 0
            Canvas { context, size in
                let width = Double(size.width), height = Double(size.height)
                let dark = mood == .sleepy || mood == .stormy
                let color = dark ? Color.white.opacity(0.45) : SkyPalette.ink.opacity(0.10)
                for i in 0..<28 {
                    let seed = Double(i)
                    let x = (seed * 73.3 + (mood == .windy ? t * 25 : sin(t * 0.4 + seed) * 8)).truncatingRemainder(dividingBy: width)
                    let speed = mood == .snowy ? 18.0 : 75.0
                    let y = (seed * 41.7 + t * speed).truncatingRemainder(dividingBy: height)
                    switch mood {
                    case .rainy, .stormy:
                        var path = Path(); path.move(to: CGPoint(x: x, y: y)); path.addLine(to: CGPoint(x: x - 4, y: y + 13))
                        context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 1, lineCap: .round))
                    case .snowy:
                        context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 3 + Double(i % 3), height: 3 + Double(i % 3))), with: .color(.white.opacity(0.8)))
                    case .sleepy:
                        let alpha = 0.3 + 0.4 * abs(sin(t * 0.7 + seed))
                        context.fill(Path(ellipseIn: CGRect(x: (seed * 67.3).truncatingRemainder(dividingBy: width), y: (seed * 27.7).truncatingRemainder(dividingBy: height), width: 2, height: 2)), with: .color(.white.opacity(alpha)))
                    case .windy:
                        var path = Path(); path.move(to: CGPoint(x: x, y: y)); path.addLine(to: CGPoint(x: x + 20, y: y))
                        context.stroke(path, with: .color(color), lineWidth: 1)
                    default: break
                    }
                }
            }
            .overlay {
                if mood == .stormy {
                    Color.white.opacity(moving && t.truncatingRemainder(dividingBy: 8) < 0.12 ? 0.18 : 0)
                }
            }
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
}
