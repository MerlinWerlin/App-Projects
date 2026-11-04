import XCTest
import Darwin

@MainActor final class GlazeDeepLinkTests: XCTestCase {
  func testWidgetLinkReachesWidgets() throws {
    continueAfterFailure = false
    let glaze = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    glaze.launch()
    XCTAssertTrue(glaze.wait(for: .runningForeground, timeout: 20))
    XCTAssertTrue(glaze.staticTexts["Whole looks: wallpaper, icons, widgets and a loop."].waitForExistence(timeout: 30))
    let ready = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("glaze-deeplink-ready")
    try FileManager.default.createDirectory(at: ready.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("ready".utf8).write(to: ready, options: .atomic)
    print("GLAZE_DEEPLINK_READY")
    fflush(stdout)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let open = springboard.alerts.buttons["Open"]
    if open.waitForExistence(timeout: 20) { open.tap() }
    let subtitle = "Widgets that match your theme. Tap one to make it yours."
    XCTAssertTrue(glaze.staticTexts[subtitle].waitForExistence(timeout: 30), glaze.debugDescription)
    XCTAssertTrue(glaze.wait(for: .runningForeground, timeout: 10))
    XCTAssertFalse(glaze.staticTexts["Unmatched Route"].exists)
    print("GLAZE_WIDGETS_ROUTE_VERIFIED\n" + glaze.debugDescription)
    let screenshot = XCTAttachment(screenshot: glaze.screenshot())
    screenshot.name = "widgets-route-approved"
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }
}
