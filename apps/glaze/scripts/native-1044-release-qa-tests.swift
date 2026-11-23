import XCTest
import Darwin

// Glaze 1.0.44 release QA on the iOS 27 simulator (workflow glaze-1044-release-qa.yml). A Release
// build with bundled JavaScript: launch to the first screen, browse the Themes tab (catalog-v2.json),
// download and apply two of the new themes, then show their Clock / Battery / Calendar designs and
// Artwork 1-5 on the Widgets tab. Every step is a screenshot attachment.
@MainActor final class GlazeRelease1044Tests: XCTestCase {
  private var step = 0

  private func shot(_ app: XCUIApplication, _ name: String) {
    step += 1
    let s = XCTAttachment(screenshot: app.screenshot())
    s.name = String(format: "%02d-%@", step, name)
    s.lifetime = .keepAlways
    add(s)
    print("GLAZE_QA_STEP \(s.name ?? name)"); fflush(stdout)
  }

  private func tree(_ app: XCUIApplication, _ name: String) {
    let t = XCTAttachment(string: app.debugDescription)
    t.name = "tree-" + name
    t.lifetime = .keepAlways
    add(t)
  }

  private func settle(_ seconds: Double) { RunLoop.current.run(until: Date().addingTimeInterval(seconds)) }

  private func swipeUp(_ app: XCUIApplication) {
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.78)).press(forDuration: 0.05,
      thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.32)), withVelocity: .slow, thenHoldForDuration: 0.2)
    settle(1.2)
  }

  private func reveal(_ element: XCUIElement, in app: XCUIApplication, tries: Int = 20) -> Bool {
    for _ in 0..<tries {
      if element.exists && element.isHittable && element.frame.minY > 120 && element.frame.maxY < app.frame.height - 100 { return true }
      let upward = element.exists && element.frame.minY < 120
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: upward ? 0.45 : 0.75)).press(forDuration: 0.05,
        thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: upward ? 0.75 : 0.45)), withVelocity: .slow, thenHoldForDuration: 0.2)
      settle(0.8)
    }
    return element.exists && element.isHittable
  }

  private func tab(_ app: XCUIApplication, _ label: String) {
    let b = app.buttons[label].firstMatch
    XCTAssertTrue(b.waitForExistence(timeout: 30), "no \(label) tab\n" + app.debugDescription)
    b.tap()
    settle(2)
  }

  private func makeApp() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.jared797.glaze")
    if app.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { app.setValue(false, forKey: "idleAnimationWaitEnabled") }
    return app
  }

  private func search(_ app: XCUIApplication, _ text: String) {
    let field = app.textFields["Search themes"].firstMatch
    if !field.waitForExistence(timeout: 10) {
      let s = app.searchFields.firstMatch
      XCTAssertTrue(s.waitForExistence(timeout: 10), "no theme search field\n" + app.debugDescription)
      s.tap()
      for letter in text { s.typeText(String(letter)); settle(0.18) }
      return
    }
    _ = reveal(field, in: app)
    field.tap()
    if let value = field.value as? String, value != "Search themes" { for _ in value { field.typeText(XCUIKeyboardKey.delete.rawValue); settle(0.1) } }
    for letter in text { field.typeText(String(letter)); settle(0.18) }
  }

  private func clearSearch(_ app: XCUIApplication) {
    let field = app.textFields["Search themes"].firstMatch
    guard field.exists, let value = field.value as? String, value != "Search themes" else { return }
    field.tap()
    for _ in value { field.typeText(XCUIKeyboardKey.delete.rawValue); settle(0.08) }
    if app.keyboards.buttons["Done"].exists { app.keyboards.buttons["Done"].tap() }
  }

  /// Search, open, download, apply, then the Widgets tab with the three designs and Artwork 1-5.
  private func downloadAndApply(_ app: XCUIApplication, query: String, name: String, slug: String) {
    tab(app, "Themes")
    search(app, query)
    settle(2)
    shot(app, "\(slug)-search")
    let result = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 30), "\(name) is not listed: catalog-v2.json not read?\n" + app.debugDescription)
    if app.keyboards.count > 0, app.keyboards.buttons["Done"].exists { app.keyboards.buttons["Done"].tap() }
    result.tap()
    settle(3)
    shot(app, "\(slug)-theme-page")
    let use = app.buttons.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@", "Use this theme", "In use")).firstMatch
    let download = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Download")).firstMatch
    let unlock = app.buttons["Unlock with Glaze Plus"].firstMatch
    if download.waitForExistence(timeout: 20) {
      XCTAssertFalse(unlock.exists, "Plus is not unlocked in the QA build\n" + app.debugDescription)
      _ = reveal(download, in: app)
      download.tap()
      settle(2)
      shot(app, "\(slug)-downloading")
    }
    XCTAssertTrue(use.waitForExistence(timeout: 150), "\(name) did not finish downloading\n" + app.debugDescription)
    shot(app, "\(slug)-downloaded")
    _ = reveal(use, in: app)
    use.tap()
    settle(1.5)
    let yes = app.buttons["Yes, use it"].firstMatch
    if yes.waitForExistence(timeout: 10) { shot(app, "\(slug)-use-prompt"); yes.tap() }
    let next = app.staticTexts["Next steps"].firstMatch
    XCTAssertTrue(next.waitForExistence(timeout: 30) || app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "In use")).firstMatch.exists, "\(name) was not applied\n" + app.debugDescription)
    settle(2)
    shot(app, "\(slug)-applied")
    tree(app, "\(slug)-applied")
    let viewWidgets = app.buttons["View widgets with this theme"].firstMatch
    if viewWidgets.exists { viewWidgets.tap() } else {
      if app.buttons["Not now"].exists { app.buttons["Not now"].tap() }
      tab(app, "Widgets")
    }
    settle(4)
    shot(app, "\(slug)-widgets-tab")
    for kind in ["clock", "battery", "calendar"] {
      let choose = app.buttons["designed-" + kind]
      XCTAssertTrue(choose.waitForExistence(timeout: 30) && reveal(choose, in: app), "no \(kind) design on the Widgets tab\n" + app.debugDescription)
      choose.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1)
      settle(1.5)
      let preview = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH[c] %@", kind == "clock" ? "Clock" : kind == "battery" ? "Battery" : "Calendar")).firstMatch
      _ = reveal(preview, in: app, tries: 6)
      shot(app, "\(slug)-\(kind)")
    }
    // Artwork 1-5 (My widget art): wait out "Preparing", then page through the list.
    let art = app.staticTexts["My widget art"].firstMatch
    _ = reveal(art, in: app)
    let deadline = Date().addingTimeInterval(90)
    while Date() < deadline && app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Preparing")).count > 0 { settle(3) }
    shot(app, "\(slug)-artwork-1")
    tree(app, "\(slug)-artwork")
    for page in 2...4 { swipeUp(app); shot(app, "\(slug)-artwork-\(page)") }
    print("GLAZE_QA_APPLIED \(slug)"); fflush(stdout)
  }

  func testRelease1044() throws {
    continueAfterFailure = false
    let app = makeApp()
    defer { tree(app, "final"); shot(app, "final") }
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30))
    XCTAssertTrue(app.buttons["Themes"].firstMatch.waitForExistence(timeout: 60), "no tabs after launch\n" + app.debugDescription)
    settle(6)
    shot(app, "first-screen")
    tab(app, "Themes")
    settle(8) // catalog-v2.json fetch + thumbnails
    shot(app, "themes-top")
    tree(app, "themes-top")
    for page in 1...6 { swipeUp(app); shot(app, "themes-browse-\(page)") }
    for category in ["Nature", "Abstract & Art"] {
      let chip = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", category)).firstMatch
      tab(app, "Themes")
      if chip.waitForExistence(timeout: 5) && reveal(chip, in: app, tries: 8) {
        chip.tap(); settle(4)
        shot(app, "category-\(category == "Nature" ? "nature" : "abstract")")
        swipeUp(app); shot(app, "category-\(category == "Nature" ? "nature" : "abstract")-2")
      }
    }
    tab(app, "Themes")
    downloadAndApply(app, query: "Ashloop", name: "Ashloop Riverbank", slug: "ashloop-riverbank")
    tab(app, "Themes")
    clearSearch(app)
    downloadAndApply(app, query: "Anaglyph", name: "Anaglyph Crossing", slug: "anaglyph-crossing")
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5), "Glaze is no longer running")
    print("GLAZE_QA_1044_DONE"); fflush(stdout)
  }
}
