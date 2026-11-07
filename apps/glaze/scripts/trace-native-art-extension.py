"""CI-only diagnostic: rebuild the widget extension with observation logs in a temp copy.

Never changes shipping source or creates a release-qualified binary. Existing app, metadata,
resources and identities remain; only the simulator extension executable is instrumented.
"""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

assert os.environ.get('GITHUB_ACTIONS') == 'true'
assert os.environ.get('GLAZE_ART_TRACE') == 'true'
app = Path(sys.argv[1])
work = Path(os.environ['RUNNER_TEMP']) / 'glaze-art-trace-build'
work.mkdir()
source = Path(__file__).resolve().parents[1] / 'targets/widget'
for file in source.glob('*.swift'):
    shutil.copy2(file, work / file.name)
provider = work / 'WidgetArtLibrary.swift'
text = provider.read_text()
needle = 'let piece = WidgetArtStore.resolvedID(configuration.art?.id, family: context.family)'
assert text.count(needle) == 2
text = text.replace(needle, needle + '\n    NSLog("GLAZE_ART_TRACE provider configured=%@ resolved=%@ family=%@", configuration.art?.id ?? "nil", piece ?? "nil", String(describing: context.family))')
needle = '  func entities(for identifiers: [WidgetArtEntity.ID]) async throws -> [WidgetArtEntity] {\n    let snap = WidgetArtStore.snapshot()'
assert text.count(needle) == 1
text = text.replace(needle, needle + '\n    NSLog("GLAZE_ART_TRACE query identifiers=%@ available=%@", identifiers.joined(separator: ","), snap.records.map { $0.id }.joined(separator: ","))')
provider.write_text(text)
view = work / 'SeamlessWidget.swift'
text = view.read_text()
needle = '  var body: some View {\n    if let design = LiveArtStore.spec(pieceID: pieceID, family: family)?.design {'
assert text.count(needle) == 1
text = text.replace(needle, '  var body: some View {\n    let _ = NSLog("GLAZE_ART_TRACE view piece=%@ design=%@ family=%@", pieceID ?? "nil", LiveArtStore.spec(pieceID: pieceID, family: family)?.design?.kind ?? "none", String(describing: family))\n    if let design = LiveArtStore.spec(pieceID: pieceID, family: family)?.design {')
needle = 'let image = WidgetArtStore.load(pieceID, preferSize: SeamlessStore.familyName(family)) ?? SeamlessStore.load(family)'
assert text.count(needle) == 1
text = text.replace(needle, needle + '\n    let _ = NSLog("GLAZE_ART_TRACE image piece=%@ dimensions=%@", pieceID ?? "nil", image.map { String(describing: $0.size) } ?? "nil")')
view.write_text(text)
extension = app / 'PlugIns/GlazeWidgets.appex'
info = plistlib.loads((extension / 'Info.plist').read_bytes())
entitlements = work / 'entitlements.plist'
entitlements.write_bytes(plistlib.dumps({
    'application-identifier': 'GLAZETEST0.com.jared797.glaze.widget',
    'com.apple.developer.team-identifier': 'GLAZETEST0',
    'com.apple.security.application-groups': ['group.com.jared797.glaze'],
    'get-task-allow': True,
}))
der = work / 'entitlements.der'
subprocess.run(['derq', 'query', '-f', 'xml', '-i', str(entitlements), '-o', str(der), '--raw'], check=True)
sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path']).decode().strip()
subprocess.run(['xcrun', 'swiftc', '-O', '-whole-module-optimization', '-parse-as-library', '-application-extension',
    '-module-name', 'GlazeWidgets', '-sdk', sdk, '-target', 'arm64-apple-ios17.0-simulator',
    '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__entitlements', '-Xlinker', str(entitlements),
    '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__ents_der', '-Xlinker', str(der),
    *[str(file) for file in sorted(work.glob('*.swift'))],
    '-o', str(extension / info['CFBundleExecutable'])], check=True)
print('GLAZE_DIAGNOSTIC_EXTENSION_ONLY_NOT_RELEASE_QUALIFIED')
