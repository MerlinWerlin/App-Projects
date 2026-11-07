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
# Xcode must perform its AppIntents constant extraction and metadata build phases too.
# Replacing an extension with a plain swiftc executable does not preserve those runtime hooks.
shutil.copy2(extension / 'Info.plist', work / 'Info.plist')
ruby = work / 'project.rb'
ruby.write_text('''require 'xcodeproj'
root = ARGV.fetch(0)
project_path = File.join(root, 'ArtTrace.xcodeproj')
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:app_extension, 'GlazeWidgets', :ios, '17.0')
Dir[File.join(root, '*.swift')].each { |path| target.source_build_phase.add_file_reference(project.main_group.new_file(path)) }
target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['SWIFT_OPTIMIZATION_LEVEL'] = '-O'
  config.build_settings['SWIFT_COMPILATION_MODE'] = 'wholemodule'
  config.build_settings['INFOPLIST_FILE'] = File.join(root, 'Info.plist')
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.jared797.glaze.widget'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['OTHER_LDFLAGS[sdk=iphonesimulator*]'] = ['$(inherited)',
    "-Wl,-sectcreate,__TEXT,__entitlements,#{root}/entitlements.plist",
    "-Wl,-sectcreate,__TEXT,__ents_der,#{root}/entitlements.der"]
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.save_as(project_path, 'GlazeWidgets', true)
''')
subprocess.run(['ruby', str(ruby), str(work)], check=True)
derived = work / 'derived'
log = work / 'xcode-build.log'
with log.open('w') as output:
    result = subprocess.run(['xcodebuild', '-project', str(work / 'ArtTrace.xcodeproj'),
        '-scheme', 'GlazeWidgets', '-configuration', 'Release', '-sdk', 'iphonesimulator',
        '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', str(derived),
        'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'build'], stdout=output, stderr=subprocess.STDOUT)
if result.returncode:
    print('\n'.join(log.read_text().splitlines()[-100:]))
    raise SystemExit(result.returncode)
built = derived / 'Build/Products/Release-iphonesimulator/GlazeWidgets.appex'
shutil.copy2(built / info['CFBundleExecutable'], extension / info['CFBundleExecutable'])
assert (built / 'Metadata.appintents/extract.actionsdata').is_file()
shutil.copytree(built / 'Metadata.appintents', extension / 'Metadata.appintents', dirs_exist_ok=True)
print('GLAZE_DIAGNOSTIC_EXTENSION_ONLY_NOT_RELEASE_QUALIFIED')
