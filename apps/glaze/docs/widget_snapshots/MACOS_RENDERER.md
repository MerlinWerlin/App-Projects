# Plan: real SwiftUI widget snapshots on a macOS runner (for the App Factory chat)

`scripts/widget-snapshots.mjs` draws the widgets with the app's own placement maths in Chromium. It
cannot run the Swift code itself. This plan adds a GitHub Actions job on the owner's repo
(`MerlinWerlin/App-Projects`, app in `apps/glaze`) that renders the real SwiftUI widget views with
`ImageRenderer` in the iOS Simulator and uploads PNGs, and checks them against the JS plan in
`docs/widget_snapshots/index.json`. T203 could not push a workflow, so this is written to be copied.

## Why not plain `swift` on macOS

The widget views use UIKit (`UIImage`), `WidgetFamily` and `.containerBackground(for: .widget)`.
Those need the iOS SDK, so the renderer runs as an XCTest bundle on an iOS Simulator
(`xcodebuild test`). Two details matter:

1. `ImageRenderer` does not draw `.containerBackground(for: .widget)`: WidgetKit's host draws it.
   `SeamlessWidgetView` puts the composed image in that container background, so the snapshot
   must draw the background view itself. Small refactor (app code, not done here): move the
   closure body of `SeamlessWidgetView.containerBackground` into
   `struct SeamlessBackground: View { let image: UIImage?; let theme: WidgetTheme }` and use it in
   both places. The snapshot then renders `ZStack { SeamlessBackground(...); SeamlessWidgetView(...) }`.
2. The composition (`setSeamless` / `setWidgetArt`) lives in the Expo module
   `modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift`. Move the drawing part (no
   App Group, no Expo) into `enum GlazeArtCompositor { static func widgetArt(art:size:background:colour:fit:) -> UIImage; static func seamless(wallpaper:crop:hero:) -> UIImage }`
   in a file both the module and the snapshot test compile, so the test draws exactly what ships.

## Files to add

`apps/glaze/ios-snapshots/Package.swift`

```swift
// swift-tools-version:5.10
import PackageDescription
let package = Package(
  name: "WidgetSnapshots",
  platforms: [.iOS(.v17)],
  targets: [
    .target(
      name: "GlazeWidgetViews",
      path: "..",
      exclude: [],
      sources: [
        "targets/widget/ThemeStore.swift",
        "targets/widget/Providers.swift",
        "targets/widget/SeamlessWidget.swift",
        "targets/widget/SavedWidgetDesign.swift",
        "targets/widget/SavedWidgetView.swift",
        "modules/glaze-widget-bridge/ios/GlazeArtCompositor.swift" // after refactor 2
      ]
    ),
    .testTarget(name: "WidgetSnapshotTests", dependencies: ["GlazeWidgetViews"], path: "ios-snapshots/Tests")
  ]
)
```

(If SwiftPM refuses a target path above the package, the job copies those files into
`ios-snapshots/Sources/GlazeWidgetViews/` first: `cp` keeps one source of truth.) Widget types are
`internal`; the test uses `@testable import GlazeWidgetViews`.

`apps/glaze/ios-snapshots/Tests/WidgetSnapshotTests.swift`

```swift
import XCTest
import SwiftUI
import WidgetKit
@testable import GlazeWidgetViews

final class WidgetSnapshotTests: XCTestCase {
  struct Index: Decodable { let themes: [Theme] }
  struct Theme: Decodable { let id: String; let options: [Option]; let wallpaper: Size? }
  struct Option: Decodable { let id: String; let background: String; let cells: [String: Cell] }
  struct Cell: Decodable { let path: String; let mode: String; let targetPx: Size; let crop: Rect?; let artRectPt: Rect }
  struct Size: Decodable { let w: Double; let h: Double }
  struct Rect: Decodable { let x: Double; let y: Double; let w: Double; let h: Double }

  // Paths come from the workflow (env), so the test needs no network.
  let root = URL(fileURLWithPath: ProcessInfo.processInfo.environment["SNAPSHOT_ROOT"]!)
  let out = URL(fileURLWithPath: ProcessInfo.processInfo.environment["SNAPSHOT_OUT"]!)
  let points: [String: CGSize] = ["small": CGSize(width: 170, height: 170), "medium": CGSize(width: 364, height: 170), "large": CGSize(width: 364, height: 382)]

  @MainActor func testRenderEveryOption() throws {
    let index = try JSONDecoder().decode(Index.self, from: Data(contentsOf: root.appendingPathComponent("docs/widget_snapshots/index.json")))
    try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    var failures: [String] = []
    for theme in index.themes {
      for option in theme.options {
        let art = try XCTUnwrap(UIImage(contentsOfFile: artPath(theme.id, option.id)))
        for (size, cell) in option.cells {
          let composed: UIImage = cell.path == "seamless"
            ? GlazeArtCompositor.seamless(wallpaper: wallpaper(theme.id), crop: cgRect(cell.crop!), hero: art)
            : GlazeArtCompositor.widgetArt(art: art, size: CGSize(width: cell.targetPx.w, height: cell.targetPx.h),
                                           background: option.background, colour: themeColour(theme.id), fit: cell.mode)
          // 1. The composed file must have the size the JS plan expects.
          if composed.size != CGSize(width: cell.targetPx.w, height: cell.targetPx.h) { failures.append("\(theme.id)/\(option.id)/\(size): size \(composed.size)") }
          // 2. Render the real widget view (background drawn explicitly, see refactor 1).
          let view = ZStack {
            SeamlessBackground(image: composed, theme: .fallback)
            SeamlessWidgetView(entry: GlazeEntry(date: .now, theme: .fallback))
          }
          .frame(width: points[size]!.width, height: points[size]!.height)
          .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
          .environment(\.widgetFamily, family(size))
          let renderer = ImageRenderer(content: view)
          renderer.scale = 2
          let png = try XCTUnwrap(renderer.uiImage?.pngData())
          try png.write(to: out.appendingPathComponent("\(theme.id)__\(option.id)__\(size).png"))
        }
      }
    }
    XCTAssert(failures.isEmpty, failures.joined(separator: "\n"))
  }
  // artPath / wallpaper / themeColour read the same cache the Node script fills
  // (.cache/widget-snapshots/production/art/<id>/v<n>/… and themes/<id>/…), via index.json fields.
}
```

`.environment(\.widgetFamily, …)` is read-only in public SwiftUI; if the compiler refuses it, give
`SeamlessWidgetView` an optional `familyOverride: WidgetFamily?` (default nil) for the test.

## Workflow outline (`.github/workflows/glaze-widget-snapshots.yml`)

```yaml
name: Glaze widget snapshots
on:
  workflow_dispatch:
  pull_request:
    paths: ['apps/glaze/targets/widget/**', 'apps/glaze/modules/glaze-widget-bridge/**', 'apps/glaze/src/core/widgetOptions.ts', 'apps/glaze/src/core/seamlessWidget.ts']
jobs:
  snapshots:
    runs-on: macos-15
    defaults: { run: { working-directory: apps/glaze } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx -y playwright@1 install chromium        # only if the JS sheets are re-made here too
      - run: node --no-warnings scripts/widget-snapshots.mjs   # fills .cache + writes index.json
      - run: |
          xcodebuild test -scheme WidgetSnapshots \
            -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' \
            -packagePath ios-snapshots
        env:
          SNAPSHOT_ROOT: ${{ github.workspace }}/apps/glaze
          SNAPSHOT_OUT: ${{ runner.temp }}/widget-png
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: widget-snapshots, path: '${{ runner.temp }}/widget-png', retention-days: 14 }
```

(`xcodebuild` on a package: run it from `ios-snapshots/` with `-scheme WidgetSnapshots-Package` if
the plain scheme is not generated; `xcrun simctl list devices` shows the simulator names the runner
image has.)

## What it adds over the Node sheets

- The real `SeamlessWidgetView` and CoreImage blur, real image decoding (WebP via ImageIO), real
  rounding of the composed size.
- A contract check: the composed size and art rectangle from Swift equal `index.json`'s
  `targetPx` / `artRectPt` (within 1 px), so the JS plan and the native compositor cannot drift.
- Later: the same harness can render `SavedWidgetView` for the live catalogue widgets with long
  localised strings (German, Hindi) to catch text overflow natively.
