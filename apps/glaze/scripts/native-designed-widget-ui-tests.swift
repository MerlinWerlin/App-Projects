import XCTest
import Darwin
import UIKit
import Vision

@MainActor final class GlazeDesignedWidgetUITests: XCTestCase {
  private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
    for _ in 0..<24 {
      if element.exists && element.isHittable && element.frame.minY > 145 && element.frame.maxY < app.frame.height - 100 { break }
      let downward = element.exists && element.frame.minY < 145
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: downward ? 0.55 : 0.76)).press(forDuration: 0.05,
        thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: downward ? 0.76 : 0.55)),
        withVelocity: .slow, thenHoldForDuration: 0.3)
    }
    // Wait for the actual hit point after a scroll instead of tapping during deceleration.
    RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    XCTAssertTrue(element.exists && element.isHittable, app.debugDescription)
  }

  func testThreeFunctionalDesignsReachSharedStorage() throws {
    continueAfterFailure = false
    let app = makeApp()
    defer {
      print("GLAZE_DESIGNED_FINAL_TREE\n" + app.debugDescription)
      let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "designed-final-screen"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 30))
    app.buttons["Widgets"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Widgets that match your theme. Tap one to make it yours."].waitForExistence(timeout: 20))
    for kind in ["clock", "battery", "calendar"] {
      let choose = app.buttons["designed-" + kind]
      reveal(choose, in: app)
      choose.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
      let save = app.buttons["save-designed-widget"]
      reveal(save, in: app)
      let before = XCTAttachment(screenshot: app.screenshot()); before.name = "designed-" + kind + "-before-save"; before.lifetime = .keepAlways; add(before)
      save.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
      let saved = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved and added to My widget art.")).firstMatch
      XCTAssertTrue(saved.waitForExistence(timeout: 15), app.debugDescription)
      let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "designed-" + kind + "-saved"; screenshot.lifetime = .keepAlways; add(screenshot)
      print("GLAZE_DESIGNED_SAVED " + kind); fflush(stdout)
    }
    app.terminate(); app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 30))
    print("GLAZE_DESIGNED_WIDGETS_BRIDGE_VERIFIED"); fflush(stdout)
  }

  func testAlpineOriginalFaceFromTheme() throws {
    continueAfterFailure = false
    let app = try openAlpine()
    defer { print("GLAZE_ALPINE_FINAL_TREE\n" + app.debugDescription) }

    let part = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Widgets, Everyday widgets")).firstMatch
    reveal(part, in: app)
    part.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)

    let save = app.buttons["save-designed-widget"]
    reveal(save, in: app)
    let face = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Clock, Alpine Starlight")).firstMatch
    XCTAssertTrue(face.exists, app.debugDescription)
    save.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
    let saved = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved and added to My widget art.")).firstMatch
    XCTAssertTrue(saved.waitForExistence(timeout: 15), app.debugDescription)
    capture("alpine-original-clock-saved")
    print("GLAZE_ALPINE_CLOCK_SAVED"); fflush(stdout)
  }

  private func openAlpine(preserveSession: Bool = false) throws -> XCUIApplication {
    try openTheme(searchText: "Alpine", name: "Alpine Starlight", preserveSession: preserveSession)
  }

  private func showMainTabs(in app: XCUIApplication) throws {
    for _ in 0..<6 {
      let settings = app.buttons["Settings"].firstMatch
      if settings.exists && settings.isHittable { return }
      let close = app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Close"))
        .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable })
      let back = app.navigationBars.buttons.firstMatch
      if let close { close.tap() }
      else if back.exists && back.isHittable { back.tap() }
      else {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)).press(forDuration: 0.05,
          thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5)))
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.6))
    }
    XCTFail("Return to the tabs through real navigation, without relaunching the app: " + app.debugDescription)
  }

  private func openTheme(searchText: String, name: String, preserveSession: Bool = false) throws -> XCUIApplication {
    let app = makeApp()
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    if preserveSession { app.activate(); try showMainTabs(in: app) }
    else { app.launch() }
    let themes = app.buttons["Themes"].firstMatch
    if themes.exists { themes.tap() }
    let search = app.textFields["Search themes"]
    XCTAssertTrue(search.waitForExistence(timeout: 30), app.debugDescription)
    search.tap()
    if let value = search.value as? String, value != "Search themes" {
      for _ in value {
        search.typeText(XCUIKeyboardKey.delete.rawValue)
        RunLoop.current.run(until: Date().addingTimeInterval(0.12))
      }
    }
    // Give React Native's controlled field time to echo each simulator key event.
    for letter in searchText {
      search.typeText(String(letter))
      RunLoop.current.run(until: Date().addingTimeInterval(0.18))
    }
    XCTAssertEqual(search.value as? String, searchText)
    let result = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 25), app.debugDescription)
    result.tap()
    if app.buttons["Use everything"].firstMatch.waitForExistence(timeout: 3) { return app }

    let part = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Widgets, Everyday widgets")).firstMatch
    if !part.waitForExistence(timeout: 4) {
      let download = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Download")).firstMatch
      XCTAssertTrue(download.waitForExistence(timeout: 20), app.debugDescription)
      download.tap()
      XCTAssertTrue(part.waitForExistence(timeout: 75), app.debugDescription)
    }
    return app
  }

  func testAlpineOnHomeScreen() throws {
    continueAfterFailure = false
    let app = makeApp()
    app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 30))
    let spring = makeSpringboard()
    try openGallery(spring)
    try installWidget("Seamless", in: spring, maxSwipes: 60)
    capture("seamless-installed-before-alpine")
    try testAlpineOriginalFaceFromTheme()
    XCUIDevice.shared.press(.home)
    RunLoop.current.run(until: Date().addingTimeInterval(10))
    capture("alpine-small-on-home-screen")
    print("GLAZE_ALPINE_INSTALLED\n" + spring.debugDescription); fflush(stdout)
  }

  func testThemeGalleryWithoutSavingIndividualWidgets() throws {
    continueAfterFailure = false
    defer { capture("gallery-final-screen") }
    let app = try openAlpine()
    let use = app.buttons["Use this theme"].firstMatch
    XCTAssertTrue(use.waitForExistence(timeout: 15), app.debugDescription)
    use.tap()
    RunLoop.current.run(until: Date().addingTimeInterval(8))
    let spring = makeSpringboard()
    XCUIDevice.shared.press(.home)
    capture("home-before-adding-new-theme-widgets")
    try openGallery(spring, fromHomeScreen: true)
    try installWidget("Clock", in: spring, maxSwipes: 8)
    capture("theme-clock-installed")
    for name in ["Battery", "Calendar"] {
      try openGallery(spring, fromHomeScreen: true)
      try installWidget(name, in: spring, maxSwipes: 8)
      capture("theme-\(name)-installed")
    }
    print("GLAZE_THEME_GALLERY_INSTALLED\n" + spring.debugDescription); fflush(stdout)
  }

  func testAlpineSmallEditWidgetArt() throws {
    continueAfterFailure = false
    let app = try openAlpine()
    let spring = makeSpringboard()
    defer {
      capture("alpine-art-final")
      print("GLAZE_ART_APP_TREE\n" + app.debugDescription)
      print("GLAZE_ART_SPRINGBOARD_TREE\n" + spring.debugDescription)
    }

    let action = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Use everything", "Use theme + add icons")).firstMatch
    if !action.waitForExistence(timeout: 3) {
      let use = app.buttons.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@", "Use this theme", "In use")).firstMatch
      reveal(use, in: app)
      use.tap()
    }
    XCTAssertTrue(action.waitForExistence(timeout: 8), app.debugDescription)
    action.tap()
    // Wait for the explicit action to finish. No extra delay for widget art before going home.
    let installed = app.navigationBars["Install icons"].firstMatch
    for _ in 0..<55 {
      if installed.exists { break }
      for alert in [app.alerts.firstMatch, spring.alerts.firstMatch] where alert.exists {
        let allow = alert.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Allow")).firstMatch
        if allow.exists { allow.tap() }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }
    XCTAssertTrue(installed.exists, app.debugDescription)
    capture("alpine-after-theme-apply")
    XCUIDevice.shared.press(.home)
    try openGallery(spring, fromHomeScreen: true)
    try installWidget("Seamless", in: spring, maxSwipes: 20)
    let widgets = spring.icons.matching(NSPredicate(format: "label == %@", "Glaze"))
    let homeWidget = try XCTUnwrap(widgets.allElementsBoundByIndex.first {
      $0.isHittable && (110...205).contains($0.frame.width) && (110...215).contains($0.frame.height)
    }, spring.debugDescription)
    homeWidget.press(forDuration: 1.4)
    let edit = spring.buttons["Edit Widget"].firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 8), spring.debugDescription)
    edit.tap()
    // SpringBoard labels both the static left-hand caption and the actionable right-hand button Art.
    let art = spring.buttons["Art"].firstMatch
    XCTAssertTrue(art.waitForExistence(timeout: 12), spring.debugDescription)
    art.tap()
    RunLoop.current.run(until: Date().addingTimeInterval(2))
    capture("alpine-small-art-options")
    var seen = Set<String>()
    let names = ["Jupiter polar", "Silver moon", "Spiral galaxy", "Saturn rings", "Copper eclipse"]
    for attempt in 0..<10 {
      let visibleText = try screenText()
      print("GLAZE_ALPINE_ART_SCREEN " + visibleText)
      for name in names {
        let item = spring.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        if item.exists || visibleText.localizedCaseInsensitiveContains(name) { seen.insert(name) }
      }
      if seen.count == names.count { break }
      // Scroll the picker list, keeping the gesture inside the middle of the sheet.
      if attempt == 0 && art.exists && art.isHittable && seen.isEmpty { art.tap() }
      else if !seen.isEmpty {
        spring.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.61))
          .press(forDuration: 0.05, thenDragTo: spring.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.42)))
      }
      RunLoop.current.run(until: Date().addingTimeInterval(1))
    }
    print("GLAZE_ALPINE_SMALL_ART_SEEN " + seen.sorted().joined(separator: ", ")); fflush(stdout)
    XCTAssertEqual(seen, Set(names), spring.debugDescription)
    print("GLAZE_ALPINE_SMALL_ART_OPTIONS_VERIFIED"); fflush(stdout)
  }

  func testApplyAlpineForUpgrade() throws {
    continueAfterFailure = false
    let app = try openAlpine()
    try applyDisplayedTheme(app)
    capture("upgrade-alpine-applied")
    print("GLAZE_UPGRADE_ALPINE_APPLIED"); fflush(stdout)
  }

  private func applyDisplayedTheme(_ app: XCUIApplication) throws {
    let spring = makeSpringboard()
    let everything = app.buttons["Use everything"].firstMatch
    if everything.exists { everything.tap() }
    else {
      let use = app.buttons.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@", "Use this theme", "In use")).firstMatch
      XCTAssertTrue(use.waitForExistence(timeout: 12), app.debugDescription)
      use.tap()
      let all = app.buttons["Use everything"].firstMatch
      if all.waitForExistence(timeout: 1) { all.tap() }
    }
    for _ in 0..<8 {
      for alert in [app.alerts.firstMatch, spring.alerts.firstMatch] where alert.exists {
        let allow = alert.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Allow")).firstMatch
        if allow.exists { allow.tap() }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }
    let close = app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Close"))
      .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable })
    close?.tap()
  }

  private func verifyThemeDiagnostics(_ id: String) throws {
    let app = makeApp()
    app.activate()
    try showMainTabs(in: app)
    let settings = app.buttons["Settings"].firstMatch
    XCTAssertTrue(settings.waitForExistence(timeout: 12), app.debugDescription); settings.tap()
    let line = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Widget diagnostics,")).firstMatch
    reveal(line, in: app)
    let deadline = Date().addingTimeInterval(100)
    repeat {
      let value = line.label
      if value.contains("Active " + id) && value.contains("Shared " + id) && value.contains("Widget read " + id)
        && value.contains("Art [" + id + "]") && value.contains("Failed 0") {
        capture("swap-diagnostics-" + id)
        print("GLAZE_SWAP_NATIVE_DIAGNOSTICS " + value); fflush(stdout)
        return
      }
      RunLoop.current.run(until: Date().addingTimeInterval(2))
    } while Date() < deadline
    XCTFail("Theme selection, WidgetKit and art did not converge on " + id + ": " + line.label)
  }

  // A fixed Home Screen layout gives each installed native widget a stable page/frame key.
  // The three static native widgets lack Edit Widget; the retained Seamless art widgets have it.
  private func nativeHomeSamples(_ name: String, remove: Bool = false) throws -> [String: [Double]] {
    XCUIDevice.shared.press(.home)
    let spring = makeSpringboard()
    for _ in 0..<8 { spring.swipeRight(); RunLoop.current.run(until: Date().addingTimeInterval(0.2)) }
    var samples: [String: [Double]] = [:]
    var removed = 0
    for page in 0..<8 {
      var inspectAgain: Bool
      repeat {
      inspectAgain = false
      let candidates = spring.icons.matching(NSPredicate(format: "label == %@", "Glaze")).allElementsBoundByIndex.filter {
        $0.exists && $0.isHittable && $0.frame.width > 110 && $0.frame.width < 220
      }
      for widget in candidates where widget.exists && widget.isHittable {
        let frame = widget.frame
        widget.press(forDuration: 1.3)
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))
        let visible = try screenText()
        let editable = spring.buttons["Edit Widget"].firstMatch.exists || visible.contains("Edit Widget")
        if !editable && remove {
          let button = spring.buttons["Remove Widget"].firstMatch
          XCTAssertTrue(button.exists, spring.debugDescription); button.tap()
          let confirm = spring.alerts.buttons["Remove"].firstMatch
          if confirm.waitForExistence(timeout: 3) { confirm.tap() }
          removed += 1
          RunLoop.current.run(until: Date().addingTimeInterval(0.6))
          // Removal reflows the icon grid. Re-query instead of using stale index-bound elements.
          inspectAgain = true
          break
        }
        spring.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.84)).tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))
        if editable { continue }
        let key = "\(page)-\(Int(frame.minX.rounded()))-\(Int(frame.minY.rounded()))"
        if let image = XCUIScreen.main.screenshot().image.cgImage {
          let scale = CGFloat(image.width) / spring.frame.width
          let inset = frame.insetBy(dx: 12, dy: 12)
          if let crop = image.cropping(to: CGRect(x: inset.minX * scale, y: inset.minY * scale, width: inset.width * scale, height: inset.height * scale)),
            let context = CGContext(data: nil, width: 20, height: 20, bitsPerComponent: 8, bytesPerRow: 80,
              space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) {
            context.draw(crop, in: CGRect(x: 0, y: 0, width: 20, height: 20))
            let bytes = context.data!.assumingMemoryBound(to: UInt8.self)
            samples[key] = (0..<400).flatMap { pixel in (0..<3).map { Double(bytes[pixel * 4 + $0]) / 255 } }
          }
        }
      }
      } while inspectAgain
      capture("swap-" + name + "-home-page-\(page)")
      spring.swipeLeft()
      RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }
    if remove { XCTAssertEqual(removed, 3, "Remove only the three native widgets installed for this test") }
    else { XCTAssertEqual(samples.count, 3, "Find all three separately installed native Clock/Battery/Calendar widgets") }
    return samples
  }

  func testThemeSwapAfterRecoveredUpgrade() throws {
    continueAfterFailure = false
    try applyDisplayedTheme(try openAlpine())
    let spring = makeSpringboard()
    XCUIDevice.shared.press(.home)
    for kind in ["Clock", "Battery", "Calendar"] {
      try openGallery(spring, fromHomeScreen: true)
      try installWidget(kind, in: spring, maxSwipes: 8)
    }
    let baseline = try nativeHomeSamples("A")
    try verifyThemeDiagnostics("alpine-starlight")
    try applyDisplayedTheme(try openTheme(searchText: "Aurora", name: "Aurora Haven", preserveSession: true))
    RunLoop.current.run(until: Date().addingTimeInterval(8))
    let changed = try nativeHomeSamples("B")
    try verifyThemeDiagnostics("aurora-haven")
    try verifyAuroraArtAfterSwap()
    XCTAssertEqual(Set(baseline.keys), Set(changed.keys))
    for (key, pixels) in baseline {
      let next = try XCTUnwrap(changed[key])
      let distance = zip(pixels, next).map { abs($0 - $1) }.reduce(0, +) / Double(pixels.count)
      print("GLAZE_SWAP_HOME_PIXEL_DISTANCE B " + key + " " + String(distance)); fflush(stdout)
      XCTAssertGreaterThan(distance, 0.02, "Each real native widget must visibly change on B")
    }
    try applyDisplayedTheme(try openAlpine(preserveSession: true))
    RunLoop.current.run(until: Date().addingTimeInterval(8))
    let restored = try nativeHomeSamples("A-return")
    try verifyThemeDiagnostics("alpine-starlight")
    XCTAssertEqual(Set(baseline.keys), Set(restored.keys))
    for (key, pixels) in baseline {
      let next = try XCTUnwrap(restored[key])
      let distance = zip(pixels, next).map { abs($0 - $1) }.reduce(0, +) / Double(pixels.count)
      print("GLAZE_SWAP_HOME_PIXEL_DISTANCE A " + key + " " + String(distance)); fflush(stdout)
      // Live clock hands can move during the test; the theme must still return to Alpine.
      XCTAssertLessThan(distance, 0.04, "Each real native widget must return to A")
    }
    _ = try nativeHomeSamples("remove-test-native", remove: true)
    print("GLAZE_THEME_SWAP_A_B_A_VERIFIED"); fflush(stdout)
  }

  private func verifyAuroraArtAfterSwap() throws {
    let app = makeApp()
    app.activate()
    try showMainTabs(in: app)
    app.buttons["Widgets"].firstMatch.tap()
    for size in ["Small", "Medium", "Large"] {
      let sizeButton = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", size)).firstMatch
      reveal(sizeButton, in: app); sizeButton.tap()
      for name in ["Aurora date", "Snow mushrooms"] {
        let item = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        reveal(item, in: app)
        capture("swapped-aurora-preview-" + size.lowercased() + "-" + name.replacingOccurrences(of: " ", with: "-"))
      }
    }
    XCUIDevice.shared.press(.home)
    let spring = makeSpringboard()
    for size in ["small", "medium", "large"] {
      let widget = try findArtWidget(size, in: spring)
      try enterWidgetEditor(widget, in: spring)
      try openArtOptions(in: spring)
      try resetArtOptionsToStart(in: spring, themeName: "Aurora Haven")
      var seen = Set<String>()
      var chosen: CGVector?
      for _ in 0..<26 {
        let lines = try groupedScreenLines()
        for name in ["Aurora date", "Snow mushrooms"] {
          if let row = lines.first(where: { $0.text.localizedCaseInsensitiveContains(name) && $0.text.localizedCaseInsensitiveContains(size) }) {
            seen.insert(name)
            if name == "Snow mushrooms" { chosen = CGVector(dx: row.box.midX, dy: 1 - row.box.midY) }
          }
        }
        if seen.count == 2 && chosen != nil { break }
        scrollArtOptions(in: spring, towardsStart: false)
      }
      capture("swapped-aurora-edit-art-" + size)
      XCTAssertEqual(seen, Set(["Aurora date", "Snow mushrooms"]))
      let choice = try XCTUnwrap(chosen)
      spring.coordinate(withNormalizedOffset: choice).tap()
      RunLoop.current.run(until: Date().addingTimeInterval(1))
      try dismissWidgetEditor(in: spring)
      capture("swapped-aurora-home-" + size)
    }
    print("GLAZE_UPGRADE_AURORA_ALL_FAMILIES_VERIFIED"); fflush(stdout)
  }

  func testInstallLegacyArtWidgetsForUpgrade() throws {
    continueAfterFailure = false
    let app = makeApp()
    app.launch()
    let widgetsTab = app.buttons["Widgets"].firstMatch
    XCTAssertTrue(widgetsTab.waitForExistence(timeout: 40), app.debugDescription)
    widgetsTab.tap()
    // Let the archived app publish its initial native theme and register its widget extension,
    // as an existing user has already done, before opening the system picker on this fresh VM.
    RunLoop.current.run(until: Date().addingTimeInterval(5))
    let spring = makeSpringboard()
    for (index, size) in ["small", "medium", "large"].enumerated() {
      try openGallery(spring)
      let title = spring.staticTexts["Seamless"].firstMatch
      for _ in 0..<60 {
        if title.exists { break }
        spring.swipeLeft()
      }
      XCTAssertTrue(title.exists, spring.debugDescription)
      for _ in 0..<index { spring.swipeLeft(); RunLoop.current.run(until: Date().addingTimeInterval(0.6)) }
      let add = spring.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Add Widget")).firstMatch
      XCTAssertTrue(add.waitForExistence(timeout: 6), spring.debugDescription); add.tap()
      for _ in 0..<2 { let done = spring.buttons["Done"].firstMatch; if done.waitForExistence(timeout: 2) { done.tap() } }
      RunLoop.current.run(until: Date().addingTimeInterval(3))
      _ = try findArtWidget(size, in: spring)
      capture("legacy-art-widget-installed-" + size)
    }
    print("GLAZE_LEGACY_ART_WIDGETS_INSTALLED"); fflush(stdout)
  }

  private func findArtWidget(_ size: String, in spring: XCUIApplication) throws -> XCUIElement {
    for direction in ["left", "right"] {
      for _ in 0..<7 {
        let matches = spring.icons.matching(NSPredicate(format: "label == %@", "Glaze"))
        if let hit = matches.allElementsBoundByIndex.first(where: { element in
          let f = element.frame
          guard element.exists && element.isHittable && f.width > 110 else { return false }
          return size == "small" ? f.width < 220 : size == "medium" ? f.width > 250 && f.height < 230 : f.height > 250
        }) { return hit }
        if direction == "left" { spring.swipeLeft() } else { spring.swipeRight() }
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
      }
    }
    XCTFail("Missing existing " + size + " art widget. " + spring.debugDescription)
    throw NSError(domain: "GlazeUpgradeUI", code: 1)
  }

  func testPrimeAlpineArtWidgetBeforeUpgrade() throws {
    continueAfterFailure = false
    let spring = makeSpringboard()
    XCUIDevice.shared.press(.home)
    let widget = try findArtWidget("small", in: spring)
    try enterWidgetEditor(widget, in: spring)
    let art = spring.buttons["Art"].firstMatch
    XCTAssertTrue(art.waitForExistence(timeout: 10), spring.debugDescription); art.tap()
    try resetArtOptionsToStart(in: spring)
    var selected = false
    for _ in 0..<26 {
      RunLoop.current.run(until: Date().addingTimeInterval(1))
      if try screenTextPoint(containing: ["Silver moon", "Small"]) != nil {
        capture("baseline-existing-art-choice")
        let point = try XCTUnwrap(try screenTextPoint(containing: ["Silver moon", "Small"]))
        spring.coordinate(withNormalizedOffset: point).tap()
        selected = true
        break
      }
      spring.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.66))
        .press(forDuration: 0.05, thenDragTo: spring.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.40)),
          withVelocity: .slow, thenHoldForDuration: 0.5)
      RunLoop.current.run(until: Date().addingTimeInterval(0.4))
    }
    XCTAssertTrue(selected, spring.debugDescription)
    RunLoop.current.run(until: Date().addingTimeInterval(1))
    capture("baseline-existing-selected-art")
    let selectedText = try screenText()
    XCTAssertTrue(selectedText.localizedCaseInsensitiveContains("Silver moon") && selectedText.contains("Small") && selectedText.contains("Layout"), selectedText)
    try dismissWidgetEditor(in: spring)
    RunLoop.current.run(until: Date().addingTimeInterval(6))
    capture("baseline-existing-silver-moon-widget")
    print("GLAZE_UPGRADE_EXISTING_ART_WIDGET_PRIMED"); fflush(stdout)
  }

  func testAlpineAllFamiliesAfterUpgrade() throws {
    continueAfterFailure = false
    let app = makeApp()
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    app.launch()
    defer {
      capture("upgrade-final")
      print("GLAZE_UPGRADE_FINAL_APP_TREE\n" + app.debugDescription)
    }
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 40), app.debugDescription)
    app.buttons["Widgets"].firstMatch.tap()
    let names = ["Copper eclipse", "Jupiter polar", "Saturn rings", "Silver moon", "Spiral galaxy"]
    for size in ["Small", "Medium", "Large"] {
      let sizeButton = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", size)).firstMatch
      reveal(sizeButton, in: app); sizeButton.tap()
      for name in names {
        let item = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        reveal(item, in: app)
        capture("upgraded-widgets-" + size.lowercased() + "-" + name.replacingOccurrences(of: " ", with: "-"))
      }
    }
    app.terminate()
    let theme = try openAlpine()
    let choice = theme.buttons["View widgets with this theme"].firstMatch
    let part = choice.exists ? choice : theme.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Widgets, Everyday widgets")).firstMatch
    reveal(part, in: theme); part.tap()
    for size in ["Small", "Medium", "Large"] {
      let sizeButton = theme.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ AND label ENDSWITH %@", "Widget size", size)).firstMatch
      reveal(sizeButton, in: theme); sizeButton.tap()
      for name in names {
        let item = theme.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        reveal(item, in: theme)
        capture("upgraded-theme-" + size.lowercased() + "-" + name.replacingOccurrences(of: " ", with: "-"))
      }
    }
    XCUIDevice.shared.press(.home)
    let spring = makeSpringboard()
    for size in ["small", "medium", "large"] {
      let widget = try findArtWidget(size, in: spring)
      capture("upgraded-home-" + size)
      try enterWidgetEditor(widget, in: spring)
      try openArtOptions(in: spring)
      try resetArtOptionsToStart(in: spring)
      var seen = Set<String>()
      for _ in 0..<26 {
        let lines = try screenText().components(separatedBy: " | ")
        for name in names where lines.contains(where: {
          $0.localizedCaseInsensitiveContains(name) && $0.localizedCaseInsensitiveContains(size)
        }) { seen.insert(name) }
        print("GLAZE_UPGRADE_PICKER_TEXT " + size + " " + lines.joined(separator: " | "))
        if seen.count == names.count { break }
        scrollArtOptions(in: spring, towardsStart: false)
      }
      capture("upgraded-edit-art-" + size)
      XCTAssertEqual(seen, Set(names), spring.debugDescription)
      print("GLAZE_UPGRADE_ART_FAMILY_VERIFIED " + size); fflush(stdout)
      var chosen = false
      for _ in 0..<10 {
        if let point = try screenTextPoint(containing: ["Copper eclipse", size]) {
          spring.coordinate(withNormalizedOffset: point).tap()
          chosen = true
          break
        }
        scrollArtOptions(in: spring, towardsStart: true)
      }
      XCTAssertTrue(chosen, spring.debugDescription)
      RunLoop.current.run(until: Date().addingTimeInterval(1))
      let selected = try screenText()
      XCTAssertTrue(selected.localizedCaseInsensitiveContains("Copper eclipse") && selected.localizedCaseInsensitiveContains(size) && selected.contains("Layout"), selected)
      capture("upgraded-selected-copper-" + size)
      try dismissWidgetEditor(in: spring)
      try waitForCopperOnHomeScreen(size, in: spring)
      capture("upgraded-copper-home-" + size)
    }
    print("GLAZE_UPGRADE_ALL_ALPINE_VERIFIED"); fflush(stdout)
  }

  private typealias ScreenLine = (text: String, box: CGRect)

  private func waitForCopperOnHomeScreen(_ size: String, in spring: XCUIApplication) throws {
    let deadline = Date().addingTimeInterval(90)
    var fraction = 0.0
    repeat {
      RunLoop.current.run(until: Date().addingTimeInterval(3))
      let widget = try findArtWidget(size, in: spring)
      guard let screen = XCUIScreen.main.screenshot().image.cgImage else { continue }
      let scale = CGFloat(screen.width) / spring.frame.width
      let box = widget.frame.insetBy(dx: 4, dy: 4)
      let pixels = CGRect(x: box.minX * scale, y: box.minY * scale,
        width: box.width * scale, height: box.height * scale)
      guard let crop = screen.cropping(to: pixels),
        let sample = CGContext(data: nil, width: 64, height: 64, bitsPerComponent: 8,
          bytesPerRow: 256, space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)
      else { continue }
      sample.draw(crop, in: CGRect(x: 0, y: 0, width: 64, height: 64))
      guard let data = sample.data?.assumingMemoryBound(to: UInt8.self) else { continue }
      var warm = 0
      for pixel in 0..<4096 {
        let r = Double(data[pixel * 4]), g = Double(data[pixel * 4 + 1]), b = Double(data[pixel * 4 + 2])
        if r > 35 && r > g * 1.6 && r > b * 1.6 { warm += 1 }
      }
      fraction = Double(warm) / 4096
      print("GLAZE_COPPER_HOME_PIXELS " + size + " " + String(fraction)); fflush(stdout)
      // The original copper moon occupies much more than this area at every size.
      // The old clock's thin gold hands cannot satisfy this visible-art check.
      if fraction > 0.06 {
        print("GLAZE_COPPER_HOME_RENDER_VERIFIED " + size); fflush(stdout)
        return
      }
    } while Date() < deadline
    capture("copper-render-failed-" + size)
    XCTFail("Copper Eclipse did not render on the actual Home Screen: " + size + " warm pixels " + String(fraction))
  }

  private func recognizedScreenLines() throws -> [ScreenLine] {
    guard let image = UIImage(data: XCUIScreen.main.screenshot().pngRepresentation)?.cgImage else { return [] }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    return (request.results ?? []).compactMap { observation -> ScreenLine? in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      return (text: text, box: observation.boundingBox)
    }
  }

  private func groupedScreenLines() throws -> [ScreenLine] {
    var groups: [[ScreenLine]] = []
    for line in try recognizedScreenLines().sorted(by: { $0.box.midY > $1.box.midY }) {
      if let last = groups.indices.last, abs(groups[last][0].box.midY - line.box.midY) < 0.007 {
        groups[last].append(line)
      } else { groups.append([line]) }
    }
    var rows: [ScreenLine] = []
    for group in groups {
      let text = group.sorted(by: { $0.box.minX < $1.box.minX }).map { $0.text }.joined(separator: " ")
      let box = group.reduce(CGRect.null) { $0.union($1.box) }
      // Vision can split the size suffix horizontally or onto its own wrapped line.
      if let last = rows.indices.last,
         text.range(of: "^[^A-Za-z0-9]*(small|medium|large)$", options: [.regularExpression, .caseInsensitive]) != nil {
        rows[last].text += " " + text
        rows[last].box = rows[last].box.union(box)
      } else { rows.append((text: text, box: box)) }
    }
    return rows
  }

  private func screenText() throws -> String {
    try groupedScreenLines().map { $0.text }.joined(separator: " | ")
  }

  private func scrollArtOptions(in spring: XCUIApplication, towardsStart: Bool) {
    let from = CGVector(dx: 0.60, dy: towardsStart ? 0.55 : 0.70)
    let to = CGVector(dx: 0.60, dy: towardsStart ? 0.79 : 0.45)
    spring.coordinate(withNormalizedOffset: from).press(forDuration: 0.05,
      thenDragTo: spring.coordinate(withNormalizedOffset: to), withVelocity: .slow, thenHoldForDuration: 0.4)
    RunLoop.current.run(until: Date().addingTimeInterval(0.6))
  }

  private func resetArtOptionsToStart(in spring: XCUIApplication, themeName: String = "Alpine Starlight") throws {
    var loaded = false
    for _ in 0..<20 {
      if try screenText().localizedCaseInsensitiveContains(themeName) { loaded = true; break }
      RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }
    XCTAssertTrue(loaded, "The real art option menu did not finish loading")
    for _ in 0..<16 {
      let lines = try groupedScreenLines()
      if lines.contains(where: { $0.text.localizedCaseInsensitiveContains("Clock") && $0.text.localizedCaseInsensitiveContains("Small") }) { return }
      scrollArtOptions(in: spring, towardsStart: true)
    }
    let visible = try screenText()
    XCTFail("Could not reach the start of the real art menu: " + visible)
  }

  private func makeApp() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) {
      app.setValue(false, forKey: "idleAnimationWaitEnabled")
    }
    return app
  }

  private func makeSpringboard() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) {
      app.setValue(false, forKey: "idleAnimationWaitEnabled")
      print("GLAZE_SPRINGBOARD_ANIMATION_WAIT_DISABLED"); fflush(stdout)
    }
    return app
  }

  private func enterWidgetEditor(_ widget: XCUIElement, in spring: XCUIApplication) throws {
    widget.press(forDuration: 1.4)
    RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    for _ in 0..<5 {
      let visible = try screenText()
      if visible.contains("Seamless") && visible.contains("Layout") { return }
      if let point = try screenTextPoint(containing: ["Edit Widget"]) {
        spring.coordinate(withNormalizedOffset: point).tap()
      } else {
        let edit = spring.buttons["Edit Widget"].firstMatch
        if edit.exists && edit.isHittable { edit.tap() }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(1))
    }
    let visible = try screenText()
    XCTFail("The actual Seamless editor did not open: " + visible)
  }

  private func dismissWidgetEditor(in spring: XCUIApplication) throws {
    // Commit edits by tapping the backdrop outside both the editor and widget preview.
    for _ in 0..<3 {
      let visible = try screenText()
      let editor = visible.contains("Seamless") && visible.contains("Layout")
      let context = visible.contains("Edit Widget") && visible.contains("Remove Widget")
      if !editor && !context { return }
      spring.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.84)).tap()
      RunLoop.current.run(until: Date().addingTimeInterval(1))
    }
    let visible = try screenText()
    XCTFail("The real widget editor did not dismiss: " + visible)
  }

  private func openArtOptions(in spring: XCUIApplication) throws {
    let art = spring.buttons["Art"].firstMatch
    if art.waitForExistence(timeout: 3) { art.tap(); return }
    // With an existing selected entity, the remote control can expose its value instead
    // of Art. Locate the visible Art caption and tap the value side of that actual row.
    let visible = try screenText()
    let caption = try XCTUnwrap(try screenTextPoint(containing: ["Art"], exact: true), visible)
    spring.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: caption.dy)).tap()
  }

  private func screenTextPoint(containing terms: [String], exact: Bool = false) throws -> CGVector? {
    let lines: [ScreenLine]
    if exact { lines = try recognizedScreenLines() } else { lines = try groupedScreenLines() }
    guard let line = lines.first(where: { line in
      return exact ? terms.contains(where: { line.text.caseInsensitiveCompare($0) == .orderedSame }) : terms.allSatisfy { line.text.localizedCaseInsensitiveContains($0) }
    }) else { return nil }
    return CGVector(dx: line.box.midX, dy: 1 - line.box.midY)
  }

  private func capture(_ name: String) {
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
  }

  func testInspectSystemArtGallery() throws {
    continueAfterFailure = false
    let app = makeApp()
    app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 40), app.debugDescription)
    try openGallery(makeSpringboard(), inspect: true)
    print("GLAZE_ART_GALLERY_DISCOVERY_COMPLETE"); fflush(stdout)
  }

  private func openGallery(_ spring: XCUIApplication, fromHomeScreen: Bool = false, legacyArt: Bool = false, inspect: Bool = false) throws {
    if spring.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { spring.setValue(false, forKey: "idleAnimationWaitEnabled") }
    if !fromHomeScreen { XCUIDevice.shared.press(.home) }
    RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    // Existing widgets share the app's Glaze label. The first global match can be on an
    // off-screen page; use any actually visible match and search both page directions.
    var visibleIcon: XCUIElement?
    for direction in ["right", "left"] {
      for _ in 0..<7 {
        visibleIcon = spring.icons.matching(NSPredicate(format: "label == %@", "Glaze"))
          .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable })
        if visibleIcon != nil { break }
        if direction == "right" { spring.swipeRight() } else { spring.swipeLeft() }
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
      }
      if visibleIcon != nil { break }
    }
    let icon = try XCTUnwrap(visibleIcon, spring.debugDescription)
    icon.press(forDuration: 1.5)
    let editHome = spring.buttons["Edit Home Screen"].firstMatch
    XCTAssertTrue(editHome.waitForExistence(timeout: 10), spring.debugDescription)
    editHome.tap()
    let edit = spring.buttons["Edit"].firstMatch
    if edit.waitForExistence(timeout: 5) { edit.tap() }
    let addWidget = spring.buttons["Add Widget"].firstMatch
    XCTAssertTrue(addWidget.waitForExistence(timeout: 10), spring.debugDescription)
    addWidget.tap()
    let search = spring.searchFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 10), spring.debugDescription)
    if inspect {
      for query in ["Glaze", "Other", "Seamless"] {
        search.tap()
        let clear = spring.buttons["Clear text"].firstMatch
        if clear.exists { clear.tap() }
        else if let text = search.value as? String, text != "Search Widgets" {
          search.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: text.count))
        }
        search.typeText(query)
        let go = spring.keyboards.buttons["Search"].firstMatch
        if go.exists && go.isHittable { go.tap() }
        RunLoop.current.run(until: Date().addingTimeInterval(4))
        capture("widget-gallery-search-" + query)
        print("GLAZE_GALLERY_SEARCH " + query + " " + (try screenText()))
        print(spring.debugDescription); fflush(stdout)
        spring.swipeUp()
        capture("widget-gallery-search-scrolled-" + query)
        print("GLAZE_GALLERY_SEARCH_SCROLLED " + query + " " + (try screenText())); fflush(stdout)
      }
      return
    }
    if legacyArt {
      let other = spring.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Other")).firstMatch
      for _ in 0..<36 {
        if other.exists && other.isHittable { break }
        spring.swipeUp()
      }
      capture("widget-gallery-other-section")
      XCTAssertTrue(other.exists && other.isHittable, spring.debugDescription)
      other.tap()
      RunLoop.current.run(until: Date().addingTimeInterval(1))
      capture("widget-gallery-other-open")
      print("GLAZE_OTHER_GALLERY_TREE\n" + spring.debugDescription); fflush(stdout)
      return
    }
    search.tap()
    if !spring.keyboards.firstMatch.waitForExistence(timeout: 5) {
      search.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    let result = spring.buttons["Glaze"].firstMatch
    let title = spring.staticTexts["Glaze"].firstMatch
    let galleryReady = spring.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Add Widget")).firstMatch
    for attempt in 0..<5 {
      search.typeText("Glaze")
      let searchKey = spring.keyboards.buttons["Search"].firstMatch
      if searchKey.exists && searchKey.isHittable { searchKey.tap() }
      // SpringBoard exposes the app result as a Cell on current iOS. Its child text can
      // be visible while reporting non-hittable; tap the actual result row instead.
      let resultCell = spring.cells.matching(NSPredicate(format: "label == %@", "Glaze")).firstMatch
      if resultCell.waitForExistence(timeout: 5) {
        resultCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        if galleryReady.waitForExistence(timeout: 10) { return }
      }
      if result.waitForExistence(timeout: 4),
        let row = spring.buttons.matching(NSPredicate(format: "label == %@", "Glaze"))
          .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable }) {
        row.tap()
        if galleryReady.waitForExistence(timeout: 10) { return }
      }
      if title.waitForExistence(timeout: 6),
        let row = spring.staticTexts.matching(NSPredicate(format: "label == %@", "Glaze"))
          .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable && $0.frame.width > 1 }) {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        if galleryReady.waitForExistence(timeout: 10) { return }
      }
      if !search.exists {
        XCTAssertTrue(galleryReady.waitForExistence(timeout: 20), spring.debugDescription)
        return
      }
      capture("widget-picker-wait-\(attempt)")
      print("GLAZE_PICKER_WAIT " + (try screenText())); fflush(stdout)
      if attempt == 4 { break }
      let clear = spring.buttons["Clear text"].firstMatch
      if clear.exists { clear.tap() }
      search.tap()
      RunLoop.current.run(until: Date().addingTimeInterval(3))
    }
    XCTFail("Glaze did not appear in the system widget picker.\n" + spring.debugDescription)
  }

  private func installWidget(_ name: String, in spring: XCUIApplication, maxSwipes: Int) throws {
    let label = spring.staticTexts[name].firstMatch
    for _ in 0..<maxSwipes {
      if label.exists { break }
      if maxSwipes == 8 {
        for legacy in ["Seamless", "Little Line", "Big Clock", "Word Clock", "Month Progress"] {
          XCTAssertFalse(spring.staticTexts[legacy].firstMatch.exists, "\(legacy) appeared before \(name)")
        }
      }
      spring.swipeLeft()
    }
    XCTAssertTrue(label.exists, spring.debugDescription)
    capture("gallery-" + name)
    // SpringBoard's remote gallery prepends whitespace to this button's accessibility label.
    let add = spring.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Add Widget")).firstMatch
    XCTAssertTrue(add.waitForExistence(timeout: 5), spring.debugDescription)
    add.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    for _ in 0..<2 {
      let done = spring.buttons["Done"].firstMatch
      if done.waitForExistence(timeout: 3) { done.tap() }
    }
    RunLoop.current.run(until: Date().addingTimeInterval(12))
  }
}
