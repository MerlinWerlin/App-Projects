import XCTest
import Darwin

@MainActor final class GlazeAlbumPickerTests: XCTestCase {
  func testSelectedPhotosReachNativeAlbum() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    for target in [app, spring] where target.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) {
      target.setValue(false, forKey: "idleAnimationWaitEnabled") // Test runner only; see widget-tap fixture.
    }
    defer {
      let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); image.name = "album-picker-final"; image.lifetime = .keepAlways; add(image)
      print("GLAZE_ALBUM_FINAL_TREE\n" + app.debugDescription); fflush(stdout)
    }
    app.launch()
    XCTAssertTrue(app.staticTexts["Whole looks: wallpaper, icons, widgets and a loop."].waitForExistence(timeout: 30))
    app.buttons["Widgets"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Widgets that match your theme. Tap one to make it yours."].waitForExistence(timeout: 20))
    let album = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Photo album")).firstMatch
    for _ in 0..<14 { if album.exists && album.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(album.exists && album.isHittable, app.debugDescription); album.tap()
    // Studio size chips expose the radio role as XCUI Other, rather than Button.
    let medium = app.otherElements["Medium"].firstMatch
    for _ in 0..<8 { if medium.exists && medium.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(medium.exists && medium.isHittable, app.debugDescription); medium.tap()
    let choose = app.buttons["Choose photos"].firstMatch
    for _ in 0..<12 {
      if choose.exists && choose.isHittable { break }; app.swipeUp()
    }
    XCTAssertTrue(choose.exists && choose.isHittable, app.debugDescription)
    choose.tap()
    XCTAssertTrue(app.collectionViews.cells.firstMatch.waitForExistence(timeout: 20), app.debugDescription)
    print("GLAZE_PHOTO_PICKER_TREE\n" + app.debugDescription); fflush(stdout)
    let cells = app.collectionViews.cells.allElementsBoundByIndex.filter { $0.isHittable && $0.frame.height > 30 && $0.frame.width > 30 }
    XCTAssertGreaterThanOrEqual(cells.count, 2, app.debugDescription)
    cells[0].tap(); cells[1].tap()
    let selected = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); selected.name = "system-picker-two-selected"; selected.lifetime = .keepAlways; add(selected)
    let exactAdd = app.buttons["Add"].firstMatch
    let countedAdd = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Add (")).firstMatch
    if exactAdd.exists && exactAdd.isHittable { exactAdd.tap() }
    else { XCTAssertTrue(countedAdd.exists && countedAdd.isHittable, app.debugDescription); countedAdd.tap() }
    XCTAssertTrue(app.staticTexts["2 / 12 photos"].waitForExistence(timeout: 20), app.debugDescription)
    let save = app.buttons["Add widget"].firstMatch
    for _ in 0..<8 { if save.exists && save.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(save.exists && save.isHittable, app.debugDescription); save.tap()
    XCTAssertTrue(app.staticTexts["Saved for your widgets"].waitForExistence(timeout: 25), app.debugDescription)
    print("GLAZE_ALBUM_PICKER_DELIVERED\n" + app.debugDescription); fflush(stdout)
  }
}
