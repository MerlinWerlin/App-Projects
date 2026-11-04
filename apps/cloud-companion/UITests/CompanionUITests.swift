import XCTest

final class CompanionUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }
    func testPlaygroundChangesWeatherAndRespondsToTouch() {
        let app = XCUIApplication()
        app.launchArguments = ["--demo", "--playground"]
        app.launch()
        XCTAssertTrue(app.buttons["mood-rainy"].waitForExistence(timeout: 12))
        app.buttons["mood-rainy"].tap()
        XCTAssertTrue(app.staticTexts["A good day for an umbrella."].waitForExistence(timeout: 4))
        app.buttons["Say hello to the cloud"].tap()
        XCTAssertTrue(app.staticTexts["Happy to see you, little human."].waitForExistence(timeout: 3))
        app.buttons["mood-sleepy"].tap()
        XCTAssertTrue(app.staticTexts["Your sky is winding down."].waitForExistence(timeout: 4))
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = "Night cloud playground"; attachment.lifetime = .keepAlways; add(attachment)
    }
    func testAllEightWeatherChoicesAreReachable() {
        let app = XCUIApplication(); app.launchArguments = ["--demo", "--playground"]; app.launch()
        XCTAssertTrue(app.buttons["mood-sunny"].waitForExistence(timeout: 12))
        for mood in ["sunny", "cloudy", "rainy", "stormy", "snowy", "misty", "windy", "sleepy"] {
            let button = app.buttons["mood-\(mood)"]
            XCTAssertTrue(button.isHittable, "\(mood) is reachable without scrolling")
            button.tap()
        }
    }
    func testWidgetGuideHasBothSizes() {
        let app = XCUIApplication(); app.launchArguments = ["--demo", "--widget-preview"]; app.launch()
        XCTAssertTrue(app.staticTexts["Small"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["Medium"].exists)
        XCTAssertTrue(app.staticTexts["Your sky, without opening the app."].exists)
    }
    func testCloudSettingsAreUsable() {
        let app = XCUIApplication(); app.launchArguments = ["--demo"]; app.launch()
        XCTAssertTrue(app.buttons["Cloud settings"].waitForExistence(timeout: 12))
        app.buttons["Cloud settings"].tap()
        let motion = app.switches["motion-toggle"]
        XCTAssertTrue(motion.waitForExistence(timeout: 4))
        motion.tap()
        XCTAssertEqual(motion.value as? String, "0")
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Cloud settings"].waitForExistence(timeout: 4))
    }
}
