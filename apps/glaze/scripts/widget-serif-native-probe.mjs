// Test the production text implementation without modifying the WidgetKit source.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('../targets/widget/DesignedWidget.swift', import.meta.url), 'utf8');
const begin = source.indexOf('  func text(_ value: String,');
const end = source.indexOf('  func line(', begin);
assert.ok(begin > 0 && end > begin);
const themed = readFileSync(new URL('../targets/widget/ThemedWidgetDrawing.swift', import.meta.url), 'utf8');
const badgeBegin = themed.indexOf('enum CalendarBadgeText {');
const badgeEnd = themed.indexOf('enum ThemedClockArtwork {', badgeBegin);
assert.ok(badgeBegin > 0 && badgeEnd > badgeBegin);
writeFileSync(process.argv[2], `import SwiftUI
struct NativeTextProbe {
  var context: GraphicsContext
  let spec = ProbeSpec()
  var ink: Color { .white }
  struct ProbeSpec { var fontDesign: Font.Design { .serif } }
${source.slice(begin, end)}
}
${themed.slice(badgeBegin, badgeEnd)}
`);
