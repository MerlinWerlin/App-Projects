import XCTest
import Darwin

@MainActor final class GlazeDesignedWidgetUITests: XCTestCase {
  func testThreeFunctionalDesignsReachSharedStorage() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    defer {
      print("GLAZE_DESIGNED_FINAL_TREE\n" + app.debugDescription)
      let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "designed-final-screen"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    func reveal(_ element: XCUIElement) {
      for _ in 0..<24 {
        if element.exists && element.isHittable && element.frame.minY > 145 && element.frame.maxY < app.frame.height - 100 { break }
        let downward = element.exists && element.frame.minY < 145
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: downward ? 0.55 : 0.76)).press(forDuration: 0.05,
          thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: downward ? 0.76 : 0.55)),
          withVelocity: .slow, thenHoldForDuration: 0.3)
      }
      // Animated RN screens deliberately skip XCTest animation idleness; let the scroll settle
      // before resolving the actual hit point, instead of tapping during deceleration.
      RunLoop.current.run(until: Date().addingTimeInterval(0.8))
      XCTAssertTrue(element.exists && element.isHittable, app.debugDescription)
    }
    app.launch()
    XCTAssertTrue(app.buttons["Widgets"].firstMatch.waitForExistence(timeout: 30))
    app.buttons["Widgets"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Widgets that match your theme. Tap one to make it yours."].waitForExistence(timeout: 20))
    for kind in ["clock", "battery", "calendar"] {
      let choose = app.buttons["designed-" + kind]
      reveal(choose)
      choose.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
      let save = app.buttons["save-designed-widget"]
      reveal(save)
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
}
