import XCTest
import Darwin

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
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
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

  private func openAlpine() throws -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    app.launch()
    let search = app.textFields["Search themes"]
    XCTAssertTrue(search.waitForExistence(timeout: 30), app.debugDescription)
    search.tap()
    // Give React Native's controlled field time to echo each simulator key event.
    for letter in "Alpine" {
      search.typeText(String(letter))
      RunLoop.current.run(until: Date().addingTimeInterval(0.18))
    }
    XCTAssertEqual(search.value as? String, "Alpine")
    let result = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Alpine Starlight")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 25), app.debugDescription)
    result.tap()

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
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 30))
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
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
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
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
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    defer {
      capture("alpine-art-final")
      print("GLAZE_ART_APP_TREE\n" + app.debugDescription)
      print("GLAZE_ART_SPRINGBOARD_TREE\n" + spring.debugDescription)
    }

    let use = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Use this theme", "In use")).firstMatch
    reveal(use, in: app)
    use.tap()
    let action = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Use everything", "Use theme + add icons")).firstMatch
    XCTAssertTrue(action.waitForExistence(timeout: 8), app.debugDescription)
    action.tap()
    // The explicit Use everything action can request add-only Photos access on a clean install.
    let alert = spring.alerts.firstMatch
    if alert.waitForExistence(timeout: 4) {
      let allow = alert.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ AND NOT label CONTAINS[c] %@", "Allow", "Don’t")).firstMatch
      if allow.exists { allow.tap() }
    }
    capture("alpine-after-theme-apply")
    XCUIDevice.shared.press(.home)
    try openGallery(spring, fromHomeScreen: true)
    try installWidget("Seamless", in: spring, maxSwipes: 20)
    let widgets = spring.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Seamless"))
    let homeWidget = try XCTUnwrap(widgets.allElementsBoundByIndex.first {
      $0.isHittable && (110...205).contains($0.frame.width) && (110...205).contains($0.frame.height)
    }, spring.debugDescription)
    homeWidget.press(forDuration: 1.4)
    let edit = spring.buttons["Edit Widget"].firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 8), spring.debugDescription)
    edit.tap()
    let art = spring.descendants(matching: .any).matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@", "Art", "Art,")).firstMatch
    XCTAssertTrue(art.waitForExistence(timeout: 8), spring.debugDescription)
    art.tap()
    capture("alpine-small-art-options")
    var seen = Set<String>()
    let names = ["Jupiter polar", "Silver moon", "Spiral galaxy", "Saturn rings", "Copper eclipse"]
    for _ in 0..<14 {
      for name in names {
        let item = spring.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        if item.exists { seen.insert(name) }
      }
      if seen.count == names.count { break }
      spring.swipeUp()
    }
    print("GLAZE_ALPINE_SMALL_ART_SEEN " + seen.sorted().joined(separator: ", ")); fflush(stdout)
    XCTAssertEqual(seen, Set(names), spring.debugDescription)
    print("GLAZE_ALPINE_SMALL_ART_OPTIONS_VERIFIED"); fflush(stdout)
  }

  private func capture(_ name: String) {
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
  }

  private func openGallery(_ spring: XCUIApplication, fromHomeScreen: Bool = false) throws {
    if spring.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { spring.setValue(false, forKey: "idleAnimationWaitEnabled") }
    if !fromHomeScreen { XCUIDevice.shared.press(.home) }
    RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    // SpringBoard also exposes icons from off-screen pages with zero-sized frames.
    let visible = spring.icons.allElementsBoundByIndex.filter { $0.frame.width > 35 && $0.isHittable }
    let icon = try XCTUnwrap(visible.first { $0.label == "Glaze" } ?? visible.first, spring.debugDescription)
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
    search.tap()
    if !spring.keyboards.firstMatch.waitForExistence(timeout: 5) {
      search.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    let result = spring.buttons["Glaze"].firstMatch
    let title = spring.staticTexts["Glaze"].firstMatch
    for _ in 0..<3 {
      search.typeText("Glaze")
      let searchKey = spring.keyboards.buttons["Search"].firstMatch
      if searchKey.exists && searchKey.isHittable { searchKey.tap() }
      if result.waitForExistence(timeout: 4) { result.tap(); return }
      if title.waitForExistence(timeout: 6) && title.frame.width > 1 {
        title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        return
      }
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
