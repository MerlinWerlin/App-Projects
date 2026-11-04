import XCTest
import Darwin

@MainActor final class GlazeAlbumPickerTests: XCTestCase {
  func testSelectedPhotosReachNativeAlbum() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    func revealStudioControl(_ element: XCUIElement) -> Bool {
      for _ in 0..<24 {
        if element.exists {
          if element.isHittable { return true }
          let f = element.frame, screen = app.frame
          // Radio controls can omit an AX hit point. Only permit the observed frame inside
          // the exposed controls area, below the pinned preview and above the screen edge.
          if f.minY > screen.height * 0.58 && f.maxY < screen.height * 0.94 && f.minX >= 0 && f.maxX <= screen.width { return true }
          if f.minY < screen.height * 0.58 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70)).press(forDuration: 0.05,
              thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)))
            continue
          }
        }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)).press(forDuration: 0.05,
          thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70)))
      }
      return false
    }
    func tapStudioControl(_ element: XCUIElement) {
      if element.isHittable { element.tap() }
      else { element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    }
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
    XCTAssertTrue(app.staticTexts["Widget Studio"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    RunLoop.current.run(until: Date().addingTimeInterval(0.6)) // Native push transition, not app animation idleness.
    // Studio size chips expose the radio role as XCUI Other, rather than Button.
    let medium = app.otherElements["Medium"].firstMatch
    XCTAssertTrue(revealStudioControl(medium), app.debugDescription); tapStudioControl(medium)
    XCTAssertTrue(app.images["Preview: Photo album widget, Medium"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    let choose = app.buttons["Choose photos"].firstMatch
    XCTAssertTrue(revealStudioControl(choose), app.debugDescription); tapStudioControl(choose)
    // iOS26's Photos grid exposes image items, not UICollectionView cells.
    let gridImages = app.images.matching(identifier: "PXGGridLayout-Info")
    let imageGrid = gridImages.firstMatch.waitForExistence(timeout: 20)
    if !imageGrid { XCTAssertTrue(app.collectionViews.cells.firstMatch.exists, app.debugDescription) }
    print("GLAZE_PHOTO_PICKER_TREE\n" + app.debugDescription); fflush(stdout)
    let cells = (imageGrid ? gridImages.allElementsBoundByIndex : app.collectionViews.cells.allElementsBoundByIndex)
      .filter {
        // Remote Photos images have real visible frames but can omit AX hit points.
        let f = $0.frame, screen = app.frame
        return $0.exists && f.height > 30 && f.width > 30 && f.minX >= 0 && f.maxX <= screen.width
          && f.minY > 180 && f.maxY < screen.height - 90
      }
    XCTAssertGreaterThanOrEqual(cells.count, 2, app.debugDescription)
    for item in cells.prefix(2) { item.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    let selected = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); selected.name = "system-picker-two-selected"; selected.lifetime = .keepAlways; add(selected)
    let exactAdd = app.buttons["Add"].firstMatch
    let countedAdd = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Add (")).firstMatch
    let done = app.buttons["Done"].firstMatch
    if done.waitForExistence(timeout: 3) && done.isEnabled { done.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    else if exactAdd.exists && exactAdd.isHittable { exactAdd.tap() }
    else { XCTAssertTrue(countedAdd.exists && countedAdd.isHittable, app.debugDescription); countedAdd.tap() }
    XCTAssertTrue(app.staticTexts["2 / 12 photos"].waitForExistence(timeout: 20), app.debugDescription)
    let save = app.buttons["Add widget"].firstMatch
    XCTAssertTrue(revealStudioControl(save), app.debugDescription); tapStudioControl(save)
    XCTAssertTrue(app.staticTexts["Saved for your widgets"].waitForExistence(timeout: 25), app.debugDescription)
    print("GLAZE_ALBUM_PICKER_DELIVERED\n" + app.debugDescription); fflush(stdout)
  }
}
