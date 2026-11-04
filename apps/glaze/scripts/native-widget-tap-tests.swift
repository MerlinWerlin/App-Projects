import XCTest

@MainActor final class GlazeWidgetTapTests: XCTestCase {
  func testWidgetTapRoundTripsThroughSharedStorage() throws {
    continueAfterFailure = false
    let glaze = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    defer {
      let picture = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
      picture.name = "widget-tap-final-screen"; picture.lifetime = .keepAlways; add(picture)
      print("GLAZE_FINAL_APP_TREE\n" + glaze.debugDescription)
      print("GLAZE_FINAL_SPRINGBOARD_TREE\n" + spring.debugDescription)
    }
    glaze.launch()
    XCTAssertTrue(glaze.staticTexts["Whole looks: wallpaper, icons, widgets and a loop."].waitForExistence(timeout: 30))
    glaze.buttons["Widgets"].firstMatch.tap()
    XCTAssertTrue(glaze.staticTexts["Widgets that match your theme. Tap one to make it yours."].waitForExistence(timeout: 20))
    let water = glaze.buttons["habit-log-water"].firstMatch
    for _ in 0..<14 {
      if water.exists && water.isHittable { break }
      glaze.swipeUp()
    }
    XCTAssertTrue(water.exists && water.isHittable, glaze.debugDescription)
    XCTAssertTrue(water.label.contains("0 ml"), water.label)
    water.tap()
    let appWritten = NSPredicate { _, _ in water.label.contains("150 ml") }
    expectation(for: appWritten, evaluatedWith: glaze)
    waitForExpectations(timeout: 15)
    XCTAssertFalse(glaze.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "App Group missing")).firstMatch.exists)
    let first = XCTAttachment(screenshot: glaze.screenshot()); first.name = "app-wrote-150"; first.lifetime = .keepAlways; add(first)

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
    search.tap(); search.typeText("Glaze")
    let result = spring.buttons["Glaze"].firstMatch
    if result.waitForExistence(timeout: 5) { result.tap() }
    else {
      let title = spring.staticTexts["Glaze"].firstMatch
      XCTAssertTrue(title.waitForExistence(timeout: 5), spring.debugDescription); title.tap()
    }
    for _ in 0..<45 {
      if spring.staticTexts["Water"].firstMatch.exists { break }
      spring.swipeLeft()
    }
    XCTAssertTrue(spring.staticTexts["Water"].firstMatch.exists, spring.debugDescription)
    let add = spring.buttons["Add Widget"].firstMatch
    XCTAssertTrue(add.exists); add.tap()
    for _ in 0..<2 {
      let done = spring.buttons["Done"].firstMatch
      if done.waitForExistence(timeout: 3) { done.tap() }
    }
    let plus = spring.buttons["Add 150 ml"].firstMatch
    XCTAssertTrue(plus.waitForExistence(timeout: 20), spring.debugDescription)
    XCTAssertTrue(spring.staticTexts["150"].firstMatch.exists, spring.debugDescription)
    let before = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); before.name = "installed-water-before-150"; before.lifetime = .keepAlways; add(before)
    plus.tap()
    XCTAssertNotEqual(glaze.state, .runningForeground, "Widget intent should log without opening Glaze")
    XCTAssertTrue(spring.staticTexts["300"].firstMatch.waitForExistence(timeout: 20), spring.debugDescription)
    let after = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); after.name = "installed-water-after-300"; after.lifetime = .keepAlways; add(after)
    glaze.activate()
    for _ in 0..<12 {
      if water.exists && water.isHittable { break }
      glaze.swipeUp()
    }
    let reconciled = NSPredicate { _, _ in water.label.contains("300 ml") }
    expectation(for: reconciled, evaluatedWith: glaze); waitForExpectations(timeout: 20)
    print("GLAZE_WIDGET_TAP_BRIDGE_VERIFIED\n" + glaze.debugDescription)
  }
}
