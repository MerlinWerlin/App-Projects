// Tiny bridge from the app to the WidgetKit extension (targets/widget).
// The app and the extension share the App Group `group.com.jared797.glaze`
// (native-plugins/widgets.json adds the entitlement to the app; targets/widget/expo-target.config.js
// adds it to the extension). Keep the ids below in sync with src/core/widgetTheme.ts and
// targets/widget/ThemeStore.swift.
import CoreImage
import ExpoModulesCore
import Foundation
import UIKit
import WidgetKit

private let appGroup = "group.com.jared797.glaze"
private let themeKey = "glaze.theme.v1"
/// T59: widget-set payload (src/core/widgetSets.ts WIDGET_SET_KEY, written by the Widget Studio).
private let widgetSetKey = "glaze.widgets.v2"
private let photoFile = "widget-photo.jpg"
/// T125: backup copy of the theme JSON in the App Group container (ThemeStore.swift reads it when
/// the UserDefaults key is missing). Keep in sync with WIDGET_THEME_FILE in src/core/widgetTheme.ts.
private let themeFile = "theme.json"
/// T73: habit trackers (written by the app, src/core/habits.ts HABITS_KEY) and the tap log
/// (written by the widget extension's App Intents, src/core/habitLog.ts HABIT_LOG_KEY).
private let habitsKey = "glaze.habits.v1"
private let habitLogKey = "glaze.habitLog.v1"
private let habitWidgetKinds = ["GlazeHabitWater", "GlazeHabitMood", "GlazeHabitSleep", "GlazeHabitSteps"]
/// T146: written by the widget extension on every theme load (targets/widget/ThemeStore.swift,
/// src/core/widgetLink.ts WIDGET_LAST_READ_KEY); the app only reads it.
private let lastReadKey = "glaze.widget.lastRead.v1"
/// T221 "My widget art" library (src/core/widgetArtLibrary.ts WIDGET_ART_DIR / WIDGET_ART_INDEX_FILE /
/// WIDGET_ART_SOURCES; read by targets/widget/WidgetArtLibrary.swift).
private let artDir = "widget-art"
private let artIndexFile = "index.json"
private let artSourceFiles: Set<String> = ["seamless-small.png", "seamless-medium.png", "seamless-large.png", "widget-photo.jpg"]

public class GlazeWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeWidgetBridge")

    // Version handshake: old installed binaries must not claim that v2 designs were applied.
    AsyncFunction("widgetDesignVersion") { () -> Int in 2 }

    AsyncFunction("setTheme") { (json: String) -> Bool in
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
            let data = json.data(using: .utf8), data.count < 512 * 1024,
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            payload["v"] as? Int == 1 else { return false }
      do { try data.write(to: container.appendingPathComponent(themeFile), options: .atomic) }
      catch { return false }
      if let defaults = UserDefaults(suiteName: appGroup) { defaults.set(json, forKey: themeKey) }
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    AsyncFunction("setWidgetSet") { (json: String) -> Bool in
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
            let data = json.data(using: .utf8), data.count < 512 * 1024,
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            payload["v"] as? Int == 2, payload["specs"] is [[String: Any]] else { return false }
      do { try data.write(to: container.appendingPathComponent("widgets.json"), options: .atomic) }
      catch { return false }
      UserDefaults(suiteName: appGroup)?.set(json, forKey: widgetSetKey)
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T73: both habit keys as stored (JSON strings; a missing key is left out). The app merges them
    /// in JS (syncHabitStore) and writes the trackers back with setHabits. This never writes the log.
    AsyncFunction("getHabits") { () -> [String: String] in
      var out: [String: String] = [:]
      guard let defaults = UserDefaults(suiteName: appGroup) else { return out }
      if let habits = defaults.string(forKey: habitsKey) { out["habits"] = habits }
      if let log = defaults.string(forKey: habitLogKey) { out["log"] = log }
      return out
    }

    /// T73: stores the app's trackers (with the `applied` mark) and reloads the habit widgets.
    AsyncFunction("setHabits") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return false }
      guard json.utf8.count < 256 * 1024 else { return false }
      defaults.set(json, forKey: habitsKey)
      if #available(iOS 14.0, *) {
        for kind in habitWidgetKinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
      }
      return true
    }

    /// Copies a local image (file:// URI or plain path) into the App Group as widget-photo.jpg.
    /// Re-encodes as JPEG and caps the long edge so the widget stays within its memory budget.
    AsyncFunction("setPhoto") { (uri: String) -> Bool in
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
      else { return false }
      let source: URL = uri.hasPrefix("file://")
        ? (URL(string: uri) ?? URL(fileURLWithPath: uri))
        : URL(fileURLWithPath: uri)
      guard let image = UIImage(contentsOfFile: source.path) else { return false }
      // VERIFY: widget extensions have a tight memory limit for decoded images; 1200 px long edge
      // is a guess with headroom for systemMedium at 3x.
      let scaled = GlazeWidgetBridgeModule.downscale(image, maxEdge: 1200)
      guard let data = scaled.jpegData(compressionQuality: 0.85) else { return false }
      do {
        try data.write(to: container.appendingPathComponent(photoFile), options: .atomic)
      } catch {
        return false
      }
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T131 Seamless widget: crops (x, y, w, h) out of the wallpaper (wallpaper pixels of the
    /// upright image, computed in JS by src/core/seamlessWidget.ts seamlessCrop), draws the hero
    /// (transparent PNG, may be "") centred-fit on top with the same 6 % padding as heroRect, caps
    /// the long edge at 1200 px and writes seamless-<family>.png into the App Group container.
    /// Then reloads only the "GlazeSeamless" widget (targets/widget/SeamlessWidget.swift).
    AsyncFunction("setSeamless") { (wallpaperUri: String, x: Double, y: Double, w: Double, h: Double, heroUri: String, family: String) -> Bool in
      guard ["small", "medium", "large"].contains(family) else { return false }
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
        let wallpaper = GlazeWidgetBridgeModule.loadImage(wallpaperUri),
        let source = GlazeWidgetBridgeModule.uprightCGImage(wallpaper)
      else { return false }
      let bounds = CGRect(x: 0, y: 0, width: CGFloat(source.width), height: CGFloat(source.height))
      let wanted = CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(w), height: CGFloat(h)).integral.intersection(bounds)
      guard !wanted.isNull, wanted.width >= 1, wanted.height >= 1, let cropped = source.cropping(to: wanted) else { return false }

      let longest = max(wanted.width, wanted.height)
      let k: CGFloat = longest > 1200 ? 1200 / longest : 1
      let target = CGSize(width: max(1, floor(wanted.width * k)), height: max(1, floor(wanted.height * k)))
      let hero: UIImage? = heroUri.isEmpty ? nil : GlazeWidgetBridgeModule.loadImage(heroUri)

      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      format.opaque = true
      let composed = UIGraphicsImageRenderer(size: target, format: format).image { _ in
        UIImage(cgImage: cropped).draw(in: CGRect(origin: .zero, size: target))
        if let hero = hero, hero.size.width > 0, hero.size.height > 0 {
          let pad = min(target.width, target.height) * 0.06
          let box = CGRect(origin: .zero, size: target).insetBy(dx: pad, dy: pad)
          let s = min(box.width / hero.size.width, box.height / hero.size.height)
          let hw = hero.size.width * s
          let hh = hero.size.height * s
          hero.draw(in: CGRect(x: (target.width - hw) / 2, y: (target.height - hh) / 2, width: hw, height: hh))
        }
      }
      guard let data = composed.pngData() else { return false }
      do {
        try data.write(to: container.appendingPathComponent("seamless-\(family).png"), options: .atomic)
      } catch {
        return false
      }
      // T236: no raw art for a wallpaper-backed image; drop a stale one so the widget's Fit layout
      // falls back to this composed image instead of an older piece.
      try? FileManager.default.removeItem(at: container.appendingPathComponent("seamless-\(family)-art.png"))
      // T201 (owner-1101d #4): reload every timeline (WidgetCenter.reloadAllTimelines), so the
      // GlazeSeamless widget and anything else showing the theme pick the new image up at once.
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T187 theme widget art, T236 (owner-1101g #1: art FILLS the widget, no frame ever, subject
    /// never cut). Draws a w x h px image, full bleed:
    ///   - art aspect within 2 % of the output (src/core/widgetPreview.ts NATIVE_FILL_MIN_ASPECT_MATCH):
    ///     the art edge to edge;
    ///   - otherwise the art drawn WHOLE at its fitted rect (scale to fit, no inset), and the strips
    ///     around it filled with the art's own edges extended (CIImage clampedToExtent of the fitted
    ///     art, Gaussian-blurred), so it reads as one seamless image (widgetPreview.ts fullBleedArt).
    /// No veil. The theme colour is only the opaque base under transparent pixels (dark themes stay
    /// dark), so it never shows as a frame around opaque art. Same output for background "theme"
    /// and "blur"; `fit` is kept for the JS signature (the widget's own Fit / Fill choice uses the
    /// raw art below). Caps the long edge at 1200 px, writes seamless-<family>.png plus the raw art
    /// as seamless-<family>-art.png (for Edit Widget > Layout > Fit), and reloads the timelines.
    AsyncFunction("setWidgetArt") { (artUri: String, w: Double, h: Double, background: String, colour: String, fit: String, family: String) -> Bool in
      guard ["small", "medium", "large"].contains(family), w >= 1, h >= 1 else { return false }
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
        let art = GlazeWidgetBridgeModule.loadImage(artUri),
        art.size.width > 0, art.size.height > 0
      else { return false }
      let longest = max(w, h)
      let k: CGFloat = longest > 1200 ? 1200 / CGFloat(longest) : 1
      let target = CGSize(width: max(1, floor(CGFloat(w) * k)), height: max(1, floor(CGFloat(h) * k)))
      let canvas = CGRect(origin: .zero, size: target)
      let base = GlazeWidgetBridgeModule.colour(colour)

      let artAspect = art.size.width / art.size.height
      let outAspect = target.width / target.height
      let aspectsMatch = min(artAspect, outAspect) / max(artAspect, outAspect) >= 0.98
      // The art whole, centred, scaled to fit with NO inset.
      let s = min(target.width / art.size.width, target.height / art.size.height)
      let aw = art.size.width * s
      let ah = art.size.height * s
      let artRect = CGRect(x: (target.width - aw) / 2, y: (target.height - ah) / 2, width: aw, height: ah)

      // The art's own edges extended over the whole canvas (background only, under the strips).
      var extended: UIImage? = nil
      if !aspectsMatch, let cg = GlazeWidgetBridgeModule.uprightCGImage(art), cg.width > 0, cg.height > 0 {
        let ks = aw / CGFloat(cg.width)
        // CI's origin is bottom-left; the fitted rect is centred, so the same offsets apply.
        let placed = CIImage(cgImage: cg)
          .transformed(by: CGAffineTransform(scaleX: ks, y: ks))
          .transformed(by: CGAffineTransform(translationX: artRect.minX, y: artRect.minY))
        let filter = CIFilter(name: "CIGaussianBlur")
        filter?.setValue(placed.clampedToExtent(), forKey: kCIInputImageKey)
        filter?.setValue(max(12, min(target.width, target.height) * 0.08), forKey: kCIInputRadiusKey)
        if let out = filter?.outputImage?.cropped(to: canvas), let made = CIContext().createCGImage(out, from: canvas) {
          extended = UIImage(cgImage: made)
        }
      }

      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      format.opaque = true
      let composed = UIGraphicsImageRenderer(size: target, format: format).image { ctx in
        base.setFill()
        ctx.fill(canvas)
        if aspectsMatch {
          art.draw(in: canvas)
        } else {
          if let extended = extended {
            // Only OUTSIDE the art (even-odd clip), so transparent art gets no blurred ghost under it.
            ctx.cgContext.saveGState()
            let strips = UIBezierPath(rect: canvas)
            strips.append(UIBezierPath(rect: artRect))
            strips.usesEvenOddFillRule = true
            strips.addClip()
            extended.draw(in: canvas)
            ctx.cgContext.restoreGState()
          }
          art.draw(in: artRect)
        }
      }
      guard let data = composed.pngData() else { return false }
      do {
        try data.write(to: container.appendingPathComponent("seamless-\(family).png"), options: .atomic)
      } catch {
        return false
      }
      // T236: the raw art (long edge <= 1200 px) for the widget's own Fit layout. Best effort: the
      // widget falls back to the composed image without it.
      let rawURL = container.appendingPathComponent("seamless-\(family)-art.png")
      if let raw = GlazeWidgetBridgeModule.downscale(art, maxEdge: 1200).pngData() {
        try? raw.write(to: rawURL, options: .atomic)
      } else {
        try? FileManager.default.removeItem(at: rawURL)
      }
      // T201 (owner-1101d #4): reload every timeline (WidgetCenter.reloadAllTimelines), so the
      // GlazeSeamless widget and anything else showing the theme pick the new image up at once.
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T146 widget link check (fb-1025 A). Read-only: never writes or reloads anything.
    /// - containerOk: the app can open the App Group container (entitlement present on the app).
    /// - themeStored: the App Group UserDefaults holds glaze.theme.v1.
    /// - lastRead: what the extension last rendered (JSON string) or "" when the app can't see it.
    /// - storedTheme: the stored theme JSON or "" (JS compares its updatedAt with lastRead.at).
    AsyncFunction("linkStatus") { () -> [String: Any] in
      let containerOk = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil
      let defaults = UserDefaults(suiteName: appGroup)
      let stored = defaults?.string(forKey: themeKey) ?? ""
      let lastRead = defaults?.string(forKey: lastReadKey) ?? ""
      return [
        "containerOk": containerOk,
        "themeStored": !stored.isEmpty,
        "lastRead": lastRead,
        "storedTheme": stored,
      ]
    }

    /// Removes the widget photo (the widget falls back to its gradient placeholder).
    AsyncFunction("clearPhoto") { () -> Bool in
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
      else { return false }
      try? FileManager.default.removeItem(at: container.appendingPathComponent(photoFile))
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T221 "My widget art": copies one App Group file the bridge just wrote (seamless-<size>.png
    /// from setWidgetArt / setSeamless, or widget-photo.jpg from setPhoto) into widget-art/<id>.jpg,
    /// so applying a new piece ADDS to the library instead of only overwriting the per-size image.
    /// The app then writes the index (setWidgetArtIndex), which reloads the timelines.
    AsyncFunction("saveWidgetArtPiece") { (id: String, from: String) -> Bool in
      guard GlazeWidgetBridgeModule.validArtId(id), artSourceFiles.contains(from) else { return false }
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
        let image = UIImage(contentsOfFile: container.appendingPathComponent(from).path)
      else { return false }
      let dir = container.appendingPathComponent(artDir, isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      } catch {
        return false
      }
      let scaled = GlazeWidgetBridgeModule.downscale(image, maxEdge: 1200)
      guard let data = scaled.jpegData(compressionQuality: 0.88) else { return false }
      do {
        try data.write(to: dir.appendingPathComponent("\(id).jpg"), options: .atomic)
      } catch {
        return false
      }
      // T236: copy the raw art alongside as <id>-art.png when the source has one
      // (seamless-<size>-art.png from setWidgetArt) for the widget's Fit layout. Optional: pieces
      // without it still work (Fit then uses <id>.jpg).
      let rawDest = dir.appendingPathComponent("\(id)-art.png")
      try? FileManager.default.removeItem(at: rawDest)
      if from.hasPrefix("seamless-"), from.hasSuffix(".png") {
        let rawName = String(from.dropLast(4)) + "-art.png"
        let rawSource = container.appendingPathComponent(rawName)
        if FileManager.default.fileExists(atPath: rawSource.path) {
          try? FileManager.default.copyItem(at: rawSource, to: rawDest)
        }
      }
      return true
    }

    /// T221: { index: widget-art/index.json as stored ("" when missing), dir: file URL of widget-art/
    /// ("" when the container is missing) }. Read-only.
    AsyncFunction("getWidgetArtLibrary") { () -> [String: String] in
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
        return ["index": "", "dir": ""]
      }
      let dir = container.appendingPathComponent(artDir, isDirectory: true)
      let raw = (try? String(contentsOf: dir.appendingPathComponent(artIndexFile), encoding: .utf8)) ?? ""
      return ["index": raw, "dir": dir.absoluteString]
    }

    /// T221: writes widget-art/index.json (built in JS by src/core/widgetArtLibrary.ts), deletes every
    /// file in widget-art/ the index no longer lists (removed or over the cap), then reloads all
    /// timelines so widgets showing a removed piece fall back to the last applied image.
    AsyncFunction("setWidgetArtIndex") { (json: String) -> Bool in
      guard
        let data = json.data(using: .utf8), data.count < 256 * 1024,
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        payload["v"] as? Int == 1,
        let pieces = payload["pieces"] as? [[String: Any]],
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
      else { return false }
      let dir = container.appendingPathComponent(artDir, isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try data.write(to: dir.appendingPathComponent(artIndexFile), options: .atomic)
      } catch {
        return false
      }
      var keep = Set<String>([artIndexFile])
      for p in pieces {
        if let id = p["id"] as? String, GlazeWidgetBridgeModule.validArtId(id) {
          keep.insert("\(id).jpg")
          keep.insert("\(id)-art.png") // T236 raw art for the widget's Fit layout (optional)
        }
      }
      let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
      for name in names where !keep.contains(name) {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))
      }
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }
  }

  /// T221: same rule as WIDGET_ART_ID_RE in src/core/widgetArtLibrary.ts (^[A-Za-z0-9_-]{1,64}$).
  private static func validArtId(_ id: String) -> Bool {
    return id.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil
  }

  private static func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  /// T187: #RRGGBB to a colour (anything else is a neutral dark grey).
  private static func colour(_ hex: String) -> UIColor {
    let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    guard digits.count == 6, let v = UInt32(digits, radix: 16) else { return UIColor(white: 0.12, alpha: 1) }
    return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
  }

  /// T131: a local image from a file:// URI or a plain path.
  private static func loadImage(_ uri: String) -> UIImage? {
    let url: URL = uri.hasPrefix("file://")
      ? (URL(string: uri) ?? URL(fileURLWithPath: uri))
      : URL(fileURLWithPath: uri)
    return UIImage(contentsOfFile: url.path)
  }

  /// T131: the image's pixels the right way up (EXIF orientation applied), at its pixel size, so
  /// crop rectangles computed in JS from the displayed width/height line up.
  private static func uprightCGImage(_ image: UIImage) -> CGImage? {
    if image.imageOrientation == .up, let cg = image.cgImage { return cg }
    let pixelSize = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    guard pixelSize.width >= 1, pixelSize.height >= 1 else { return nil }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let redrawn = UIGraphicsImageRenderer(size: pixelSize, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: pixelSize))
    }
    return redrawn.cgImage
  }

  private static func downscale(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
    let size = image.size
    let longest = max(size.width, size.height)
    guard longest > maxEdge, longest > 0 else { return image }
    let scale = maxEdge / longest
    let target = CGSize(width: floor(size.width * scale), height: floor(size.height * scale))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
  }
}
