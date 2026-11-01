// Bridge from the app to the WidgetKit extension (targets/widget).
// The app and the extension share the App Group below (app.config.ts adds the entitlement to the
// app for ROAMLINGS_NATIVE=1 builds; targets/widget/expo-target.config.js adds it to the extension).
// Without the entitlement containerURL is nil and every call returns false: the app keeps working.
// Keep the ids in sync with src/core/widget.ts and targets/widget/RoamlingsShared.swift.
import ExpoModulesCore
import Foundation
import WidgetKit

private let appGroup = "group.com.jared797.roamlings"
private let stateKey = "roamlings.widget.state.v1"
private let tapsKey = "roamlings.widget.taps.v1"
private let allowedImages: Set<String> = ["buddy-happy.png", "buddy-joyful.png", "buddy-sleepy.png"]

public class RoamlingsWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoamlingsWidgetBridge")

    /// True when the App Group is reachable (native build with the entitlement).
    AsyncFunction("isAvailable") { () -> Bool in
      return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil
    }

    /// Stores the widget state JSON (src/core/widget.ts WidgetState) and reloads the widgets.
    AsyncFunction("setState") { (json: String) -> Bool in
      guard json.utf8.count < 64 * 1024, let defaults = UserDefaults(suiteName: appGroup) else { return false }
      defaults.set(json, forKey: stateKey)
      RoamlingsWidgetBridgeModule.reload()
      return true
    }

    /// Writes one buddy image (base64 PNG) into the App Group container.
    AsyncFunction("setImage") { (name: String, base64: String) -> Bool in
      guard allowedImages.contains(name),
            let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
            let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
            data.count < 2 * 1024 * 1024 else { return false }
      do { try data.write(to: container.appendingPathComponent(name), options: .atomic) }
      catch { return false }
      return true
    }

    /// Returns the widget's tap log (JSON array) and clears it, so each tap is applied once.
    AsyncFunction("takeTaps") { () -> String in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return "[]" }
      let raw = defaults.string(forKey: tapsKey) ?? "[]"
      defaults.removeObject(forKey: tapsKey)
      return raw
    }

    AsyncFunction("reload") { () -> Bool in
      RoamlingsWidgetBridgeModule.reload()
      return true
    }
  }

  static func reload() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
