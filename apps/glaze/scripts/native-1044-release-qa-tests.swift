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

  // ---- Home Screen (the native Clock / Battery / Calendar and Artwork 1-5 widgets draw there)
  private let galleryNote = "Takes on your Glaze theme once added."
  private let homeWidgets = ["Clock", "Battery", "Calendar", "Artwork 1", "Artwork 2", "Artwork 3", "Artwork 4", "Artwork 5"]

  private func homeShot(_ name: String) {
    step += 1
    let s = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    s.name = String(format: "%02d-%@", step, name)
    s.lifetime = .keepAlways
    add(s)
    print("GLAZE_QA_STEP \(s.name ?? name)"); fflush(stdout)
  }

  private func springboard() -> XCUIApplication {
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    if spring.responds(to: NSSelectorFromString("setIdleAnimationWaitEnabled:")) { spring.setValue(false, forKey: "idleAnimationWaitEnabled") }
    return spring
  }

  private func openGlazeGallery(_ spring: XCUIApplication) {
    XCUIDevice.shared.press(.home)
    settle(1)
    var icon: XCUIElement?
    for direction in ["right", "left"] {
      for _ in 0..<7 {
        icon = spring.icons.matching(NSPredicate(format: "label == %@", "Glaze")).allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable })
        if icon != nil { break }
        if direction == "right" { spring.swipeRight() } else { spring.swipeLeft() }
        settle(0.5)
      }
      if icon != nil { break }
    }
    guard let glaze = icon else { XCTFail("no Glaze icon on the Home Screen\n" + spring.debugDescription); return }
    glaze.press(forDuration: 1.5)
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
    if !spring.keyboards.firstMatch.waitForExistence(timeout: 5) { search.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    let ready = spring.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Add Widget")).firstMatch
    for _ in 0..<5 {
      search.typeText("Glaze")
      let key = spring.keyboards.buttons["Search"].firstMatch
      if key.exists && key.isHittable { key.tap() }
      let cell = spring.cells.matching(NSPredicate(format: "label == %@", "Glaze")).firstMatch
      if cell.waitForExistence(timeout: 5) { cell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); if ready.waitForExistence(timeout: 10) { return } }
      if let row = spring.buttons.matching(NSPredicate(format: "label == %@", "Glaze")).allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable }) {
        row.tap(); if ready.waitForExistence(timeout: 10) { return }
      }
      if let row = spring.staticTexts.matching(NSPredicate(format: "label == %@", "Glaze")).allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable && $0.frame.width > 1 }) {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); if ready.waitForExistence(timeout: 10) { return }
      }
      if !search.exists && ready.waitForExistence(timeout: 20) { return }
      let clear = spring.buttons["Clear text"].firstMatch
      if clear.exists { clear.tap() }
      search.tap(); settle(3)
    }
    XCTFail("Glaze did not appear in the widget picker\n" + spring.debugDescription)
  }

  private func addHomeWidget(_ name: String, _ spring: XCUIApplication) {
    openGlazeGallery(spring)
    let label = spring.staticTexts[name].firstMatch
    let themed = name.hasPrefix("Artwork") ? nil : spring.staticTexts[galleryNote].firstMatch
    for _ in 0..<45 {
      if label.exists && label.isHittable && (themed?.exists ?? true) { break }
      spring.swipeLeft(); settle(0.4)
    }
    XCTAssertTrue(label.exists && (themed?.exists ?? true), "\(name) is not in the Glaze widget gallery\n" + spring.debugDescription)
    homeShot("gallery-\(name.lowercased().replacingOccurrences(of: " ", with: "-"))")
    let add = spring.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Add Widget")).firstMatch
    XCTAssertTrue(add.waitForExistence(timeout: 5), spring.debugDescription)
    add.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    for _ in 0..<2 { let done = spring.buttons["Done"].firstMatch; if done.waitForExistence(timeout: 3) { done.tap() } }
    settle(4)
  }

  private func showHomeScreens(_ slug: String) {
    let spring = springboard()
    XCUIDevice.shared.press(.home)
    settle(12) // widget timelines reload after the theme change
    for _ in 0..<6 { spring.swipeRight(); settle(0.4) }
    homeShot("\(slug)-home-1")
    for page in 2...3 { spring.swipeLeft(); settle(2); homeShot("\(slug)-home-\(page)") }
    let t = XCTAttachment(string: spring.debugDescription); t.name = "tree-\(slug)-home"; t.lifetime = .keepAlways; add(t)
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
    let next = app.staticTexts["Next steps"].firstMatch
    let yes = app.buttons["Yes, use it"].firstMatch
    // A download started from the theme bar applies the theme by itself and opens Next steps.
    // After a bar download the sheet shows "Loading…" while the theme is applied, then the bar reads "In use ✓".
    let inUse = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "In use")).firstMatch
    let useOnly = app.buttons.matching(NSPredicate(format: "label == %@", "Use this theme")).firstMatch
    let ready = Date().addingTimeInterval(150)
    while Date() < ready && !next.exists && !yes.exists && !inUse.exists && !useOnly.exists { settle(2) }
    XCTAssertTrue(next.exists || yes.exists || inUse.exists || useOnly.exists, "\(name) did not finish downloading\n" + app.debugDescription)
    shot(app, "\(slug)-downloaded")
    if !next.exists && !inUse.exists {
      if !yes.exists { _ = reveal(useOnly, in: app); useOnly.tap(); settle(1.5) }
      if yes.waitForExistence(timeout: 10) { shot(app, "\(slug)-use-prompt"); yes.tap() }
    }
    XCTAssertTrue(next.waitForExistence(timeout: 30) || inUse.waitForExistence(timeout: 30), "\(name) was not applied\n" + app.debugDescription)
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
    // Artwork 1-5 in the app (My widget art): wait out "Preparing", then page through the list.
    let art = app.staticTexts["My widget art"].firstMatch
    _ = reveal(art, in: app)
    let deadline = Date().addingTimeInterval(90)
    while Date() < deadline && app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Preparing")).count > 0 { settle(3) }
    shot(app, "\(slug)-my-widget-art")
    tree(app, "\(slug)-my-widget-art")
    swipeUp(app); shot(app, "\(slug)-my-widget-art-2")
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
    let spring = springboard()
    for name in homeWidgets { addHomeWidget(name, spring) }
    showHomeScreens("ashloop-riverbank")
    app.activate(); settle(3)
    tab(app, "Themes")
    clearSearch(app)
    downloadAndApply(app, query: "Anaglyph", name: "Anaglyph Crossing", slug: "anaglyph-crossing")
    showHomeScreens("anaglyph-crossing")
    app.activate(); settle(2)
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5), "Glaze is no longer running")
    print("GLAZE_QA_1044_DONE"); fflush(stdout)
  }
}
