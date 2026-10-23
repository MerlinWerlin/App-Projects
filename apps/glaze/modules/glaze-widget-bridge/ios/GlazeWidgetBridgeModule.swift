// Tiny bridge from the app to the WidgetKit extension (targets/widget).
// The app and the extension share the App Group `group.com.jared797.glaze`
// (native-plugins/widgets.json adds the entitlement to the app; targets/widget/expo-target.config.js
// adds it to the extension). Keep the ids below in sync with src/core/widgetTheme.ts and
// targets/widget/ThemeStore.swift.
import ExpoModulesCore
import Foundation
import UIKit
import WidgetKit

private let appGroup = "group.com.jared797.glaze"
private let themeKey = "glaze.theme.v1"
/// T59: widget-set payload (src/core/widgetSets.ts WIDGET_SET_KEY, written by the Widget Studio).
private let widgetSetKey = "glaze.widgets.v2"
private let photoFile = "widget-photo.jpg"
/// T73: habit trackers (written by the app, src/core/habits.ts HABITS_KEY) and the tap log
/// (written by the widget extension's App Intents, src/core/habitLog.ts HABIT_LOG_KEY).
private let habitsKey = "glaze.habits.v1"
private let habitLogKey = "glaze.habitLog.v1"
private let habitWidgetKinds = ["GlazeHabitWater", "GlazeHabitMood", "GlazeHabitSleep", "GlazeHabitSteps"]

public class GlazeWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeWidgetBridge")

    /// Stores the widget theme JSON (built in JS by serializeWidgetTheme) and reloads widgets.
    AsyncFunction("setTheme") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return false }
      defaults.set(json, forKey: themeKey)
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }

    /// T59: stores the widget-set JSON (built in JS by studioPayload / serialiseWidgetSet) and
    /// reloads widgets. VERIFY: the extension does not read this key yet; it keeps rendering from
    /// glaze.theme.v1 until a v2-aware ThemeStore lands.
    AsyncFunction("setWidgetSet") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return false }
      // Payloads are a few tens of KB; refuse anything absurd so UserDefaults stays small.
      guard json.utf8.count < 512 * 1024 else { return false }
      defaults.set(json, forKey: widgetSetKey)
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

    /// Removes the widget photo (the widget falls back to its gradient placeholder).
    AsyncFunction("clearPhoto") { () -> Bool in
      guard
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
      else { return false }
      try? FileManager.default.removeItem(at: container.appendingPathComponent(photoFile))
      GlazeWidgetBridgeModule.reloadWidgets()
      return true
    }
  }

  private static func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
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
