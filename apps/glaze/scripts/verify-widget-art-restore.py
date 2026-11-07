from pathlib import Path
import difflib
import json
import subprocess

BASE = '1a12b3b2842fec5668f1b13d56d93cb256dd7edd'
ROOT = Path(__file__).resolve().parents[1]
EXACT = [
    'src/ui/ThemeWidgetArt.tsx', 'src/ui/WidgetArtMenu.tsx',
    'src/ui/WidgetArtLibraryList.tsx', 'src/ui/BlendedArt.tsx',
    'src/core/themeArtSync.ts', 'src/store/themeWidgetArt.ts',
    'src/core/widgetArtLibrary.ts', 'src/core/widgetOptions.ts', 'src/core/artBlend.ts',
    'src/native/packs.ts', 'src/native/useRemoteCatalog.ts',
    'app/theme/[id].tsx', 'app/(tabs)/widgets.tsx',
    'targets/widget/SeamlessWidget.swift', 'targets/widget/WidgetArtLibrary.swift',
    'modules/glaze-widget-bridge/ios/ClockArtRenderer.swift',
    'src/store/activeTheme.ts', 'src/store/widgetTheme.ts',
    'targets/widget/DesignedWidget.swift', 'targets/widget/ThemedWidgetDrawing.swift',
    'src/ui/DesignedThemeWidgets.tsx', 'targets/widget/HabitStreakWidget.swift',
    'src/ui/StepCard.tsx', 'app/install.tsx',
]
ALLOWED = {
    'src/core/packCatalog.ts': 'Remember a validated release in an installed pack manifest.',
    'src/core/packDownloader.ts': 'Persist the catalogue release when writing a downloaded manifest.',
    'src/core/themeArtResume.ts': 'Carry the installed manifest release through theme lookup.',
    'src/native/widgets.ts': 'Expose the recovery reset on the existing serial art queue.',
    'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift': 'Expose the separate photo-preserving recovery reset, then invalidate and reload.',
    'src/store/launchWork.ts': 'Run one-time recovery before the original deferred queue loads old pending state.',
}
rows = []
for file in EXACT:
    old = subprocess.check_output(['git', 'show', BASE + ':apps/glaze/' + file], cwd=ROOT).decode().splitlines()
    current = (ROOT / file).read_text(encoding='utf-8').splitlines()
    assert old == current, file
    rows.append({'file': file, 'matches106': True})
for file, reason in ALLOWED.items():
    old = subprocess.check_output(['git', 'show', BASE + ':apps/glaze/' + file], cwd=ROOT).decode().splitlines()
    current = (ROOT / file).read_text(encoding='utf-8').splitlines()
    patch = list(difflib.unified_diff(old, current, fromfile=BASE + '/' + file, tofile=file))
    rows.append({'file': file, 'justification': reason, 'patch': patch})
print(json.dumps({'base': BASE, 'files': rows}, indent=2))

