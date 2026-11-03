import Foundation

/// Readable habit-control text keeps its preferred hue. Backgrounds are never changed by this policy.
enum HabitColours {
  private final class ColourCache: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [String: String] = [:]
    func get(_ key: String) -> String? { lock.lock(); defer { lock.unlock() }; return values[key] }
    func set(_ key: String, _ value: String) {
      lock.lock(); defer { lock.unlock() }
      if values.count >= 512 { values.removeAll(keepingCapacity: true) }
      values[key] = value
    }
  }
  private static let cache = ColourCache()

  static func rgb(_ hex: String) -> [Double] {
    let s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    guard s.count == 6, let n = UInt32(s, radix: 16) else { return [23, 32, 29] }
    return [Double((n >> 16) & 255), Double((n >> 8) & 255), Double(n & 255)]
  }
  static func mix(_ a: String, _ b: String, _ amount: Double) -> String {
    let x=rgb(a),y=rgb(b),t=min(1,max(0,amount))
    let v=(0..<3).map { Int(min(255,max(0,(x[$0]+(y[$0]-x[$0])*t).rounded()))) }
    return String(format:"#%02X%02X%02X",v[0],v[1],v[2])
  }
  static func luminance(_ hex: String) -> Double {
    let c=rgb(hex).map { v -> Double in let s=v/255; return s <= 0.04045 ? s/12.92 : pow((s+0.055)/1.055,2.4) }
    return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722
  }
  static func contrast(_ a: String, _ b: String) -> Double {
    let x=luminance(a),y=luminance(b);return (max(x,y)+0.05)/(min(x,y)+0.05)
  }
  static func samples(_ stops: [String]) -> [String] {
    let first=stops.first ?? "#000000",last=stops.last ?? first
    return (0...20).map { mix(first,last,Double($0)/20) }
  }
  static func inkScore(_ ink: String, backgrounds: [String]) -> Double {
    backgrounds.map { bg in
      min(contrast(ink,bg),contrast(mix(bg,ink,0.85),bg),contrast(ink,mix(bg,ink,0.12)),contrast(mix(bg,ink,0.6),bg)*1.5)
    }.min() ?? 21
  }
  static func accentScore(_ accent: String, backgrounds: [String]) -> Double {
    backgrounds.map { bg in min(contrast(accent,bg),contrast(accent,mix(bg,accent,0.15))*1.5) }.min() ?? 21
  }
  static func resolve(_ preferred: String, stops: [String], secondary: Bool) -> String {
    let raw = preferred.hasPrefix("#") ? String(preferred.dropFirst()) : preferred
    let preferred = raw.count == 6 && UInt32(raw, radix: 16) != nil ? "#" + raw.uppercased() : "#17201D"
    let key = preferred + "|" + stops.joined(separator: "|") + (secondary ? "|ink" : "|accent")
    if let hit = cache.get(key) { return hit }
    let backgrounds=samples(stops)
    func score(_ colour:String)->Double { secondary ? inkScore(colour,backgrounds:backgrounds) : accentScore(colour,backgrounds:backgrounds) }
    if score(preferred)>=4.5 { cache.set(key, preferred); return preferred }
    let end=score("#000000")>=score("#FFFFFF") ? "#000000" : "#FFFFFF"
    for step in 1...100 {
      let colour=mix(preferred,end,Double(step)/100)
      if score(colour)>=4.5 { cache.set(key, colour); return colour }
    }
    // Arbitrary user gradients can make a single foreground impossible; retain the best endpoint.
    // The105 reviewed palettes are separately required to pass every sampled background.
    cache.set(key, end)
    return end
  }
}
