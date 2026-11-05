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
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    defer { print("GLAZE_ALPINE_FINAL_TREE\n" + app.debugDescription) }
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
    reveal(part, in: app)
    part.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)

    let save = app.buttons["save-designed-widget"]
    reveal(save, in: app)
    let face = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Clock, Alpine Starlight")).firstMatch
    XCTAssertTrue(face.exists, app.debugDescription)
    save.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
    let saved = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved and added to My widget art.")).firstMatch
    XCTAssertTrue(saved.waitForExistence(timeout: 15), app.debugDescription)
    let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "alpine-original-clock-saved"; screenshot.lifetime = .keepAlways; add(screenshot)
    print("GLAZE_ALPINE_CLOCK_SAVED"); fflush(stdout)
  }

  func testAlpineOnHomeScreen() throws {
    try testAlpineOriginalFaceFromTheme()
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    try openGallery(spring)
    try installWidget("Seamless", in: spring)
    let installed = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    installed.name = "alpine-small-on-home-screen"; installed.lifetime = .keepAlways; add(installed)
    print("GLAZE_ALPINE_INSTALLED\n" + spring.debugDescription); fflush(stdout)
  }

  private func openGallery(_ spring: XCUIApplication) throws {
    if spring.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { spring.setValue(false, forKey: "idleAnimationWaitEnabled") }
    XCUIDevice.shared.press(.home)
    let icon = spring.icons["Glaze"].firstMatch
    XCTAssertTrue(icon.waitForExistence(timeout: 15), spring.debugDescription)
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
    search.typeText("Glaze")
    let searchKey = spring.keyboards.buttons["Search"].firstMatch
    if searchKey.exists && searchKey.isHittable { searchKey.tap() }
    let result = spring.buttons["Glaze"].firstMatch
    if result.waitForExistence(timeout: 5) { result.tap() }
    else {
      let title = spring.staticTexts["Glaze"].firstMatch
      XCTAssertTrue(title.waitForExistence(timeout: 10), spring.debugDescription)
      XCTAssertGreaterThan(title.frame.width, 1)
      title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
  }

  private func installWidget(_ name: String, in spring: XCUIApplication) throws {
    let label = spring.staticTexts[name].firstMatch
    for _ in 0..<60 {
      if label.exists { break }
      spring.swipeLeft()
    }
    XCTAssertTrue(label.exists, spring.debugDescription)
    let preview = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    preview.name = "gallery-" + name; preview.lifetime = .keepAlways; add(preview)
    let add = spring.buttons["Add Widget"].firstMatch
    XCTAssertTrue(add.waitForExistence(timeout: 5), spring.debugDescription)
    add.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    for _ in 0..<2 {
      let done = spring.buttons["Done"].firstMatch
      if done.waitForExistence(timeout: 3) { done.tap() }
    }
    RunLoop.current.run(until: Date().addingTimeInterval(12))
  }
}
