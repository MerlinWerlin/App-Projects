import XCTest
import Darwin
import UIKit
import Vision

/// Real SpringBoard interaction only. No direct call into the production intent or Group writes.
@MainActor func verifyInstalledAlbumNext(app: XCUIApplication, spring: XCUIApplication, test: XCTestCase) throws {
  func stage(_ value: String) { print("GLAZE_ALBUM_WIDGET_STAGE " + value); fflush(stdout) }
  func capture(_ name: String) {
    let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    image.name = name; image.lifetime = .keepAlways; test.add(image)
  }
  func observedText(_ match: (String) -> Bool) throws -> CGRect? {
    guard let image = UIImage(data: XCUIScreen.main.screenshot().pngRepresentation)?.cgImage else { return nil }
    let request = VNRecognizeTextRequest(); request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]; request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let items = request.results ?? []
    print("GLAZE_ALBUM_SCREEN_OCR " + items.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " | ")); fflush(stdout)
    guard let item = items.first(where: { match($0.topCandidates(1).first?.string ?? "") }) else { return nil }
    let b = item.boundingBox, screen = spring.frame
    return CGRect(x: b.minX * screen.width, y: (1 - b.maxY) * screen.height,
                  width: b.width * screen.width, height: b.height * screen.height)
  }
  func dominantPhoto() -> String? {
    guard let image = UIImage(data: XCUIScreen.main.screenshot().pngRepresentation)?.cgImage else { return nil }
    let width = 201, height = 437
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    pixels.withUnsafeMutableBytes { bytes in
      guard let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return }
      context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    }
    var teal = 0, orange = 0
    for i in stride(from: 0, to: pixels.count, by: 4) {
      let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
      if r < 20 && abs(g - 160) < 20 && abs(b - 170) < 20 { teal += 1 }
      if abs(r - 240) < 20 && abs(g - 120) < 20 && abs(b - 20) < 20 { orange += 1 }
    }
    print("GLAZE_ALBUM_IMAGE_COUNTS teal=\(teal) orange=\(orange)"); fflush(stdout)
    if teal > 1500 && teal > orange * 3 { return "teal" }
    if orange > 1500 && orange > teal * 3 { return "orange" }
    return nil
  }

  XCUIDevice.shared.press(.home)
  let icon = spring.icons["Glaze"].firstMatch
  XCTAssertTrue(icon.waitForExistence(timeout: 15), spring.debugDescription); icon.press(forDuration: 1.5)
  let editHome = spring.buttons["Edit Home Screen"].firstMatch
  XCTAssertTrue(editHome.waitForExistence(timeout: 10), spring.debugDescription); editHome.tap()
  let edit = spring.buttons["Edit"].firstMatch
  if edit.waitForExistence(timeout: 5) { edit.tap() }
  let addWidget = spring.buttons["Add Widget"].firstMatch
  XCTAssertTrue(addWidget.waitForExistence(timeout: 10), spring.debugDescription); addWidget.tap()
  let search = spring.searchFields.firstMatch
  XCTAssertTrue(search.waitForExistence(timeout: 10), spring.debugDescription); search.tap()
  if !spring.keyboards.firstMatch.waitForExistence(timeout: 10) {
    search.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
  }
  XCTAssertTrue(spring.keyboards.firstMatch.waitForExistence(timeout: 10), spring.debugDescription)
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
  let title = spring.staticTexts["Photo album"].firstMatch
  let next = spring.buttons["Next photo"].firstMatch
  var selected = false, albumPages = 0
  for _ in 0..<65 {
    if title.exists {
      albumPages += 1
      // The title arrives before WidgetKit replaces its redacted placeholder with the snapshot.
      // Wait for the actual saved image/control before advancing to the next size.
      for _ in 0..<30 {
        let f = next.exists ? next.frame : .zero
        let visibleNext = next.exists && f.width > 1 && f.minX >= 0 && f.maxX <= spring.frame.width
          && f.minY > 0 && f.maxY < spring.frame.height
        if visibleNext || dominantPhoto() != nil { selected = true; break }
        RunLoop.current.run(until: Date().addingTimeInterval(0.4))
      }
      if selected || albumPages >= 3 { break }
    }
    spring.swipeLeft()
    RunLoop.current.run(until: Date().addingTimeInterval(0.7)) // Gallery page transition, separate from animation idleness.
  }
  XCTAssertTrue(title.exists, spring.debugDescription)
  print("GLAZE_ALBUM_SELECTED_GALLERY_TREE\n" + spring.debugDescription); fflush(stdout)
  capture("native-album-selected-gallery")
  XCTAssertTrue(selected, "Wait for the saved medium album to finish rendering, not its redacted placeholder")
  stage("medium-album-gallery-selected"); capture("native-album-gallery")
  let addControl = spring.buttons["Add Widget"].firstMatch
  if addControl.exists && addControl.isHittable { addControl.tap() }
  else {
    let frame = try XCTUnwrap(observedText { $0.lowercased().contains("add widget") }, "Visible Add Widget control required")
    spring.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
  }
  var leftEditing = false
  for _ in 0..<2 {
    let done = spring.buttons["Done"].firstMatch
    if done.waitForExistence(timeout: 3) { done.tap(); leftEditing = true }
  }
  if !leftEditing { XCUIDevice.shared.press(.home) }
  XCTAssertTrue(next.waitForExistence(timeout: 15), spring.debugDescription)
  XCTAssertGreaterThanOrEqual(next.frame.width, 40, "Actual native control width")
  XCTAssertGreaterThanOrEqual(next.frame.height, 40, "Actual native control height")
  let first = try XCTUnwrap(dominantPhoto(), "Installed widget must display a selected Photos image")
  stage("installed-album-photo-" + first); capture("installed-album-before-next")
  next.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
  XCTAssertNotEqual(app.state, .runningForeground, "Next should execute without opening Glaze")
  var changed = false
  for _ in 0..<20 {
    if let colour = dominantPhoto(), colour != first { changed = true; break }
    RunLoop.current.run(until: Date().addingTimeInterval(1))
  }
  XCTAssertTrue(changed, spring.debugDescription)
  XCTAssertNotEqual(app.state, .runningForeground)
  capture("installed-album-after-next")
  print("GLAZE_ALBUM_INSTALLED_NEXT_VERIFIED\n" + spring.debugDescription); fflush(stdout)
}
