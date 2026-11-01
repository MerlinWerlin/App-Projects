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
    /// T251 (owner-1101h #2): the hero goes through GlazeArtBlend first, so an opaque piece on a plain
    /// background is keyed out and a painted one has its edges feathered: it floats on the wallpaper
    /// crop with no box, frame or halo. The blended hero is also written as seamless-<family>-art.png
    /// (the widget's Fit layout); with no hero that file is removed.
    AsyncFunction("setSeamless") { (wallpaperUri: String, x: Double, y: Double, w: Double, h: Double, heroUri: String, family: String) -> Bool in
      guard ["small", "medium", "large"].contains(family) else { return false }
      // T252: the composition is shared with composeSeamlessPiece (library pieces) below.
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
        let made = GlazeWidgetBridgeModule.composeSeamlessImage(wallpaperUri: wallpaperUri, x: x, y: y, w: w, h: h, heroUri: heroUri)
      else { return false }
      let composed = made.image
      // T251: the keyed / feathered hero (nil without one), for the Fit layout file below.
      let hero = made.hero
      guard let data = composed.pngData() else { return false }
      do {
        try data.write(to: container.appendingPathComponent("seamless-\(family).png"), options: .atomic)
      } catch {
        return false
      }
      // T251: the blended hero is the raw art for the widget's Fit layout. Without a hero, drop a stale
      // file so Fit falls back to this composed image instead of an older piece.
      let heroURL = container.appendingPathComponent("seamless-\(family)-art.png")
      if let hero = hero, let raw = GlazeWidgetBridgeModule.downscale(hero, maxEdge: 1200).pngData() {
        try? raw.write(to: heroURL, options: .atomic)
      } else {
        try? FileManager.default.removeItem(at: heroURL)
      }
      // T201 (owner-1101d #4): reload every timeline (WidgetCenter.reloadAllTimelines), so the
      // GlazeSeamless widget and anything else showing the theme pick the new image up at once.
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T187 theme widget art, T236 (owner-1101g #1: art fills the widget, subject never cut), T251
    /// (owner-1101h #2: art BLENDS, no frame / box / halo). The fallback for a theme with no wallpaper
    /// file (the app tries setSeamless first: the wallpaper crop under the widget). Draws a w x h px
    /// image: the wallpaper-sampled theme colour (`colour`) as the opaque base, then the art through
    /// GlazeArtBlend (plain background keyed out, painted edges feathered), whole, NO inset, edge to
    /// edge when the aspects match within 2 % (src/core/widgetPreview.ts NATIVE_FILL_MIN_ASPECT_MATCH),
    /// else fitted. No blurred copy of the art anywhere (T251: the blurred strips read as a light-grey
    /// frame round a black square). `background` / `fit` are kept for the JS signature. Caps the long
    /// edge at 1200 px, writes seamless-<family>.png plus the blended art as seamless-<family>-art.png
    /// (for Edit Widget > Layout > Fit), and reloads the timelines.
    AsyncFunction("setWidgetArt") { (artUri: String, w: Double, h: Double, background: String, colour: String, fit: String, family: String) -> Bool in
      guard ["small", "medium", "large"].contains(family), w >= 1, h >= 1 else { return false }
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
        let loaded = GlazeWidgetBridgeModule.loadImage(artUri),
        loaded.size.width > 0, loaded.size.height > 0
      else { return false }
      // T251: keyed / feathered first (unchanged when its edge is already transparent).
      let art = GlazeArtBlend.blended(loaded)
      guard art.size.width > 0, art.size.height > 0 else { return false }
      // T252: the composition is shared with composeWidgetArtPiece (library pieces) below.
      let composed = GlazeWidgetBridgeModule.composeArtImage(art: art, w: w, h: h, colour: colour)
      guard let data = composed.pngData() else { return false }
      do {
        try data.write(to: container.appendingPathComponent("seamless-\(family).png"), options: .atomic)
      } catch {
        return false
      }
      // T236/T251: the blended art (long edge <= 1200 px) for the widget's own Fit layout. Best
      // effort: the widget falls back to the composed image without it.
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
      // T252 (owner-1101h #3): only now, with the new index on disk and the files it no longer lists
      // gone, tell WidgetKit: drop any cached configuration suggestions, then reload every timeline,
      // so Edit Widget > Art and every Glaze art widget read the fresh index.
      if #available(iOS 16.0, *) {
        WidgetCenter.shared.invalidateConfigurationRecommendations()
      }
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T252 (owner-1101h #3): composes one theme art piece straight into the library as
    /// widget-art/<id>.jpg (+ the raw art as <id>-art.png for the Fit layout), the same full-bleed
    /// image setWidgetArt makes, WITHOUT touching seamless-<size>.png, the index or the timelines.
    /// The app composes every missing piece of a theme this way, then writes the index once with
    /// setWidgetArtIndex (which prunes unlisted files and only then reloads). skipIfPresent: a piece
    /// already on disk (an interrupted earlier run) is kept as it is. Atomic writes, the .jpg last,
    /// so a piece is either whole or absent; leftovers are pruned by the next index write.
    AsyncFunction("composeWidgetArtPiece") { (id: String, artUri: String, w: Double, h: Double, colour: String, skipIfPresent: Bool) -> Bool in
      guard GlazeWidgetBridgeModule.validArtId(id), w >= 1, h >= 1 else { return false }
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return false }
      let dir = container.appendingPathComponent(artDir, isDirectory: true)
      let dest = dir.appendingPathComponent("\(id).jpg")
      if skipIfPresent && FileManager.default.fileExists(atPath: dest.path) { return true }
      do {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      } catch {
        return false
      }
      // One piece at a time, its images freed before the next (the app calls this in a loop).
      let ok: Bool = autoreleasepool { () -> Bool in
        guard
          let loaded = GlazeWidgetBridgeModule.loadImage(artUri),
          loaded.size.width > 0, loaded.size.height > 0
        else { return false }
        // T251: the same blend as setWidgetArt (no box, frame or halo).
        let art = GlazeArtBlend.blended(loaded)
        guard art.size.width > 0, art.size.height > 0 else { return false }
        let composed = GlazeWidgetBridgeModule.composeArtImage(art: art, w: w, h: h, colour: colour)
        guard let data = composed.jpegData(compressionQuality: 0.88) else { return false }
        let rawDest = dir.appendingPathComponent("\(id)-art.png")
        if let raw = GlazeWidgetBridgeModule.downscale(art, maxEdge: 1200).pngData() {
          try? raw.write(to: rawDest, options: .atomic)
        } else {
          try? FileManager.default.removeItem(at: rawDest)
        }
        do {
          try data.write(to: dest, options: .atomic)
        } catch {
          return false
        }
        return true
      }
      return ok
    }

    /// T252: the wallpaper-backed twin of composeWidgetArtPiece (setSeamless's image: the crop of
    /// the wallpaper under the widget with the hero fitted on top). crop = [x, y, w, h] in wallpaper
    /// pixels. No raw art (the Fit layout fits the composed image). No index write, no reload.
    AsyncFunction("composeSeamlessPiece") { (id: String, wallpaperUri: String, crop: [Double], heroUri: String, skipIfPresent: Bool) -> Bool in
      guard GlazeWidgetBridgeModule.validArtId(id), crop.count == 4 else { return false }
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return false }
      let dir = container.appendingPathComponent(artDir, isDirectory: true)
      let dest = dir.appendingPathComponent("\(id).jpg")
      if skipIfPresent && FileManager.default.fileExists(atPath: dest.path) { return true }
      do {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      } catch {
        return false
      }
      let ok: Bool = autoreleasepool { () -> Bool in
        guard
          let made = GlazeWidgetBridgeModule.composeSeamlessImage(wallpaperUri: wallpaperUri, x: crop[0], y: crop[1], w: crop[2], h: crop[3], heroUri: heroUri),
          let data = made.image.jpegData(compressionQuality: 0.88)
        else { return false }
        // T251: the blended hero is the Fit layout's raw art (as setSeamless writes it).
        let rawDest = dir.appendingPathComponent("\(id)-art.png")
        if let hero = made.hero, let raw = GlazeWidgetBridgeModule.downscale(hero, maxEdge: 1200).pngData() {
          try? raw.write(to: rawDest, options: .atomic)
        } else {
          try? FileManager.default.removeItem(at: rawDest)
        }
        do {
          try data.write(to: dest, options: .atomic)
        } catch {
          return false
        }
        return true
      }
      return ok
    }
  }

  /// T221: same rule as WIDGET_ART_ID_RE in src/core/widgetArtLibrary.ts (^[A-Za-z0-9_-]{1,64}$).
  private static func validArtId(_ id: String) -> Bool {
    return id.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil
  }

  /// T252: setSeamless's composition (T131), shared with composeSeamlessPiece: crops (x, y, w, h)
  /// out of the upright wallpaper, draws the hero (may be "") centred-fit with the 6 % padding of
  /// heroRect, long edge capped at 1200 px. nil when the wallpaper can't be read or the crop is empty.
  private static func composeSeamlessImage(wallpaperUri: String, x: Double, y: Double, w: Double, h: Double, heroUri: String) -> (image: UIImage, hero: UIImage?)? {
    // T264 (owner-1101i #2): a NaN / infinite crop from JS is refused, never drawn.
    guard x.isFinite, y.isFinite, w.isFinite, h.isFinite, w >= 1, h >= 1 else { return nil }
    guard
      let wallpaper = GlazeWidgetBridgeModule.loadImage(wallpaperUri),
      let source = GlazeWidgetBridgeModule.uprightCGImage(wallpaper)
    else { return nil }
    let bounds = CGRect(x: 0, y: 0, width: CGFloat(source.width), height: CGFloat(source.height))
    let wanted = CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(w), height: CGFloat(h)).integral.intersection(bounds)
    guard !wanted.isNull, wanted.width >= 1, wanted.height >= 1, let cropped = source.cropping(to: wanted) else { return nil }

    let longest = max(wanted.width, wanted.height)
    let k: CGFloat = longest > 1200 ? 1200 / longest : 1
    let target = CGSize(width: max(1, floor(wanted.width * k)), height: max(1, floor(wanted.height * k)))
    // T251: keyed / feathered (returned unchanged when its edge is already transparent).
    let hero: UIImage? = heroUri.isEmpty ? nil : GlazeWidgetBridgeModule.loadImage(heroUri).map { GlazeArtBlend.blended($0) }

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
    return (image: composed, hero: hero)
  }

  /// T252: setWidgetArt's full-bleed composition (T187 / T236), shared with composeWidgetArtPiece.
  /// T251 (owner-1101h #2): `art` is already blended (GlazeArtBlend). A w x h px image (long edge
  /// <= 1200): the opaque theme colour as the base, then the art whole, edge to edge when the
  /// aspects match within 2 %, else fitted with NO inset. No blurred copy of the art anywhere (the
  /// blurred strips read as a light-grey frame round a black square).
  private static func composeArtImage(art: UIImage, w rawW: Double, h rawH: Double, colour: String) -> UIImage {
    // T264 (owner-1101i #2): never a NaN / zero canvas (UIGraphicsImageRenderer must get a real size).
    let w = rawW.isFinite && rawW >= 1 ? rawW : 1
    let h = rawH.isFinite && rawH >= 1 ? rawH : 1
    let longest = max(w, h)
    let k: CGFloat = longest > 1200 ? 1200 / CGFloat(longest) : 1
    let target = CGSize(width: max(1, floor(CGFloat(w) * k)), height: max(1, floor(CGFloat(h) * k)))
    let canvas = CGRect(origin: .zero, size: target)
    let base = GlazeWidgetBridgeModule.colour(colour)

    guard art.size.width > 0, art.size.height > 0 else {
      return UIGraphicsImageRenderer(size: target).image { ctx in
        base.setFill()
        ctx.fill(canvas)
      }
    }
    let artAspect = art.size.width / art.size.height
    let outAspect = target.width / target.height
    let aspectsMatch = min(artAspect, outAspect) / max(artAspect, outAspect) >= 0.98
    // The art whole, centred, scaled to fit with NO inset.
    let s = min(target.width / art.size.width, target.height / art.size.height)
    let aw = art.size.width * s
    let ah = art.size.height * s
    let artRect = aspectsMatch ? canvas : CGRect(x: (target.width - aw) / 2, y: (target.height - ah) / 2, width: aw, height: ah)

    // The base colour, then the blended art. Its edges are transparent (keyed / feathered), so the
    // colour flows round it: no box, no frame, no blurred copy.
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: target, format: format).image { ctx in
      base.setFill()
      ctx.fill(canvas)
      art.draw(in: artRect)
    }
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
    // T264: at least 1 x 1 px (a very thin image never asks for a zero-size canvas).
    let target = CGSize(width: max(1, floor(size.width * scale)), height: max(1, floor(size.height * scale)))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
  }
}

// MARK: - T251 art blend

/// T251 (owner-1101h #2): widget art blends with the wallpaper. Mirror of src/core/artBlend.ts
/// (measureArtEdges + decideArtBlend + applyArtBlend) and scripts/packs/blend-audit.py; the
/// constants are pinned by src/core/artBlend.test.ts. An image whose edge ring is already
/// transparent comes back unchanged. A plain (flat / near-black) background is keyed out with a
/// soft threshold and the colour un-mixed from the key (no dark fringe), plus a thin edge feather; a
/// busy painted background has its edges feathered to transparent. Pixels: RGBA8 premultiplied.
enum GlazeArtBlend {
  static let ringShare: Double = 0.03
  static let ringMinPx: Int = 2
  static let transparentShare: Double = 0.5
  static let keyNear: Double = 20
  static let keyMinUniform: Double = 0.95
  static let keyMaxSpread: Double = 10
  static let keyLoBase: Double = 16
  static let keySoft: Double = 48
  static let minSubject: Double = 0.03
  static let featherShare: Double = 0.14
  static let keyEdgeFeatherShare: Double = 0.04
  static let keyBgAlpha: Double = 0.5
  static let keyRimShare: Double = 0.02
  static let keyHoldLo: Double = 0.05
  static let keyHoldHi: Double = 0.3
  static let maxEdge: CGFloat = 1200

  static func smoothstep(_ e0: Double, _ e1: Double, _ x: Double) -> Double {
    if !(e1 > e0) { return x >= e1 ? 1 : 0 }
    let t = min(1, max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }

  /// The image drawn upright into a premultiplied RGBA8 sRGB bitmap (long edge <= maxEdge).
  private static func bitmap(_ image: UIImage) -> CGContext? {
    let pw = image.size.width * image.scale
    let ph = image.size.height * image.scale
    guard pw >= 1, ph >= 1 else { return nil }
    let k = min(1, maxEdge / max(pw, ph))
    let w = max(1, Int(floor(pw * k)))
    let h = max(1, Int(floor(ph * k)))
    guard
      let space = CGColorSpace(name: CGColorSpace.sRGB),
      let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: space,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return nil }
    UIGraphicsPushContext(ctx)
    // UIKit draws top-down; flip the context so the image lands upright.
    ctx.translateBy(x: 0, y: CGFloat(h))
    ctx.scaleBy(x: 1, y: -1)
    image.draw(in: CGRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)))
    UIGraphicsPopContext()
    return ctx
  }

  /// The art ready to sit on the wallpaper (or the original when nothing needs doing / on failure).
  static func blended(_ image: UIImage) -> UIImage {
    guard let ctx = bitmap(image), let data = ctx.data else { return image }
    let w = ctx.width
    let h = ctx.height
    let row = ctx.bytesPerRow
    let px = data.bindMemory(to: UInt8.self, capacity: row * h)
    let r = max(ringMinPx, Int((Double(min(w, h)) * ringShare).rounded()))
    func inRing(_ x: Int, _ y: Int) -> Bool { x < r || y < r || x >= w - r || y >= h - r }
    /// Straight (un-premultiplied) colour and alpha of pixel (x, y).
    func pixel(_ x: Int, _ y: Int) -> (Double, Double, Double, Int) {
      let i = y * row + x * 4
      let a = Int(px[i + 3])
      if a == 0 { return (0, 0, 0, 0) }
      let k = 255.0 / Double(a)
      return (min(255, Double(px[i]) * k), min(255, Double(px[i + 1]) * k), min(255, Double(px[i + 2]) * k), a)
    }

    // 1. The edge ring: transparent share, per-channel median (histograms), spread.
    var hist = [[Int]](repeating: [Int](repeating: 0, count: 256), count: 3)
    var sum = [Double](repeating: 0, count: 3)
    var sq = [Double](repeating: 0, count: 3)
    var ringTotal = 0
    var transparent = 0
    var opaque = 0
    for y in 0..<h {
      for x in 0..<w where inRing(x, y) {
        ringTotal += 1
        let p = pixel(x, y)
        if p.3 < 128 {
          transparent += 1
          continue
        }
        opaque += 1
        let c = [p.0, p.1, p.2]
        for ch in 0..<3 {
          let v = min(255, max(0, Int(c[ch].rounded())))
          hist[ch][v] += 1
          sum[ch] += c[ch]
          sq[ch] += c[ch] * c[ch]
        }
      }
    }
    guard ringTotal > 0, Double(transparent) / Double(ringTotal) < transparentShare, opaque > 0 else { return image }
    func median(_ hgram: [Int]) -> Double {
      let half = (opaque + 1) / 2
      var cum = 0
      for v in 0..<256 {
        cum += hgram[v]
        if cum >= half { return Double(v) }
      }
      return 0
    }
    let key = (median(hist[0]), median(hist[1]), median(hist[2]))
    var spread = 0.0
    for ch in 0..<3 {
      let m = sum[ch] / Double(opaque)
      spread += sqrt(max(0, sq[ch] / Double(opaque) - m * m))
    }
    spread /= 3
    let lo = keyLoBase + max(0, spread)
    let hi = lo + keySoft
    func dist(_ p: (Double, Double, Double, Int)) -> Double {
      let dr = p.0 - key.0
      let dg = p.1 - key.1
      let db = p.2 - key.2
      return sqrt(dr * dr + dg * dg + db * db)
    }

    // 2. Uniform share of the ring and the subject share of the whole image.
    var near = 0
    var subject = 0
    for y in 0..<h {
      for x in 0..<w {
        let p = pixel(x, y)
        if p.3 < 128 { continue }
        let d = dist(p)
        if inRing(x, y) && d <= keyNear { near += 1 }
        if d > hi { subject += 1 }
      }
    }
    let uniform = Double(near) / Double(opaque)
    let subjectShare = Double(subject) / Double(w * h)
    let key_ = spread <= keyMaxSpread && uniform >= keyMinUniform && subjectShare >= minSubject
    let band = max(1, (key_ ? keyEdgeFeatherShare : featherShare) * Double(min(w, h)))
    let n = w * h

    // 3. Keyed only: key alpha per pixel, the background connected to the border (flood fill of
    //    t < keyBgAlpha), and the chamfer (3-4) distance to it, for the interior hold
    //    (artBlend.ts keyBackground / chamferDistance / heldKeyAlpha).
    var keyT = [Double]()
    var toBg = [Double]()
    if key_ {
      keyT = [Double](repeating: 0, count: n)
      for y in 0..<h {
        for x in 0..<w {
          keyT[y * w + x] = smoothstep(lo, hi, dist(pixel(x, y)))
        }
      }
      var bg = [Bool](repeating: false, count: n)
      var queue = [Int](repeating: 0, count: n)
      var head = 0
      var tail = 0
      func seed(_ i: Int) {
        if !bg[i] && keyT[i] < keyBgAlpha {
          bg[i] = true
          queue[tail] = i
          tail += 1
        }
      }
      for x in 0..<w {
        seed(x)
        seed((h - 1) * w + x)
      }
      for y in 0..<h {
        seed(y * w)
        seed(y * w + w - 1)
      }
      while head < tail {
        let i = queue[head]
        head += 1
        let x = i % w
        if x > 0 { seed(i - 1) }
        if x < w - 1 { seed(i + 1) }
        if i >= w { seed(i - w) }
        if i < (h - 1) * w { seed(i + w) }
      }
      toBg = [Double](repeating: Double.infinity, count: n)
      for i in 0..<n where bg[i] { toBg[i] = 0 }
      for y in 0..<h {
        for x in 0..<w {
          let i = y * w + x
          var v = toBg[i]
          if x > 0 { v = min(v, toBg[i - 1] + 3) }
          if y > 0 {
            v = min(v, toBg[i - w] + 3)
            if x > 0 { v = min(v, toBg[i - w - 1] + 4) }
            if x < w - 1 { v = min(v, toBg[i - w + 1] + 4) }
          }
          toBg[i] = v
        }
      }
      for y in stride(from: h - 1, through: 0, by: -1) {
        for x in stride(from: w - 1, through: 0, by: -1) {
          let i = y * w + x
          var v = toBg[i]
          if x < w - 1 { v = min(v, toBg[i + 1] + 3) }
          if y < h - 1 {
            v = min(v, toBg[i + w] + 3)
            if x < w - 1 { v = min(v, toBg[i + w + 1] + 4) }
            if x > 0 { v = min(v, toBg[i + w - 1] + 4) }
          }
          toBg[i] = v
        }
      }
    }
    let rim = keyRimShare * Double(min(w, h))

    // 4. Apply: key (soft threshold, interior hold, un-mix) and / or feather; write premultiplied.
    for y in 0..<h {
      for x in 0..<w {
        let p = pixel(x, y)
        var c = (p.0, p.1, p.2)
        var a = Double(p.3) / 255
        if key_ {
          let raw = keyT[y * w + x]
          let hold = smoothstep(rim * 0.5, rim, toBg[y * w + x] / 3) * smoothstep(keyHoldLo, keyHoldHi, raw)
          let t = max(raw, hold)
          if t > 1.0 / 255 {
            c = (min(255, max(0, key.0 + (c.0 - key.0) / t)),
                 min(255, max(0, key.1 + (c.1 - key.1) / t)),
                 min(255, max(0, key.2 + (c.2 - key.2) / t)))
          } else {
            c = (0, 0, 0)
          }
          a *= t
        }
        let e = min(Double(x) + 0.5, Double(y) + 0.5, Double(w - x) - 0.5, Double(h - y) - 0.5)
        a *= smoothstep(0, band, e)
        let i = y * row + x * 4
        px[i] = UInt8(min(255, max(0, (c.0 * a).rounded())))
        px[i + 1] = UInt8(min(255, max(0, (c.1 * a).rounded())))
        px[i + 2] = UInt8(min(255, max(0, (c.2 * a).rounded())))
        px[i + 3] = UInt8(min(255, max(0, (a * 255).rounded())))
      }
    }
    guard let out = ctx.makeImage() else { return image }
    return UIImage(cgImage: out)
  }
}
