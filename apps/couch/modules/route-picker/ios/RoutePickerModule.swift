import AVKit
import ExpoModulesCore
import UIKit

/**
 * route-picker: opens the system AirPlay route picker from JS (T92, cast-1024 phase B).
 *
 * There is no public API that opens the picker directly, so `show` adds an AVRoutePickerView
 * (AVKit, iOS 11+) to the key window, nearly invisible, and taps its internal button with
 * `sendActions(for: .touchUpInside)`. The system sheet then lists AirPlay receivers (video devices
 * first). The picker view is removed shortly after on iPhone; on iPad the sheet is a popover
 * anchored to the view, so it stays until the next `show` (or until the module is destroyed).
 *
 * All UIKit work runs on the main queue (DispatchQueue.main.async) inside a @MainActor type, and
 * the promise is resolved from there. Delayed removal captures only an Int generation (a `let`),
 * never a captured `var` or a view (see modules/lan-wss/ios/LanFetch.swift).
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested on a device or a TV.
 */
public class RoutePickerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoutePicker")

    // AVRoutePickerView exists on every supported iOS version (iOS 11+), so a build that includes
    // this module can always try.
    Function("isAvailable") { () -> Bool in
      return true
    }

    // Resolves true when the picker's button was found and tapped, false otherwise. Never rejects.
    AsyncFunction("show") { (promise: Promise) in
      DispatchQueue.main.async {
        let shown = RoutePickerPresenter.present()
        promise.resolve(shown)
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        RoutePickerPresenter.removeCurrent()
      }
    }
  }
}

@MainActor
enum RoutePickerPresenter {
  /// The picker view currently in the window, kept so it can be removed later.
  private static var current: AVRoutePickerView?
  /// Increases on every show, so a delayed removal only removes its own picker.
  private static var generation: Int = 0
  /// How long the picker view stays in the window on iPhone after the tap (seconds).
  private static let removeDelay: Double = 1.0

  static func present() -> Bool {
    removeCurrent()
    guard let window = keyWindow() else { return false }

    let bounds = window.bounds
    let frame = CGRect(x: bounds.midX - 0.5, y: bounds.maxY - 1.0, width: 1.0, height: 1.0)
    let picker = AVRoutePickerView(frame: frame)
    picker.prioritizesVideoDevices = true
    // Not isHidden: a hidden source view can stop the system sheet from presenting.
    picker.alpha = 0.01
    picker.isUserInteractionEnabled = false
    picker.accessibilityElementsHidden = true
    window.addSubview(picker)
    picker.layoutIfNeeded()

    guard let button = firstButton(in: picker) else {
      picker.removeFromSuperview()
      return false
    }

    current = picker
    generation += 1
    let mine = generation
    button.sendActions(for: .touchUpInside)

    if UIDevice.current.userInterfaceIdiom != .pad {
      DispatchQueue.main.asyncAfter(deadline: .now() + removeDelay) {
        RoutePickerPresenter.removeIfCurrent(mine)
      }
    }
    return true
  }

  static func removeCurrent() {
    current?.removeFromSuperview()
    current = nil
  }

  static func removeIfCurrent(_ token: Int) {
    if token == generation {
      removeCurrent()
    }
  }

  /// Key window of the foreground UIWindowScene (UIApplication.keyWindow is deprecated).
  private static func keyWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    guard let windows = scene?.windows else { return nil }
    return windows.first(where: { $0.isKeyWindow }) ?? windows.first
  }

  /// First UIButton anywhere under `view` (AVRoutePickerView draws its icon in one).
  private static func firstButton(in view: UIView) -> UIButton? {
    for sub in view.subviews {
      if let button = sub as? UIButton {
        return button
      }
      if let nested = firstButton(in: sub) {
        return nested
      }
    }
    return nil
  }
}
