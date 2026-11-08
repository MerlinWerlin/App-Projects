from pathlib import Path
import difflib
import json
import subprocess

BASE = '1a12b3b2842fec5668f1b13d56d93cb256dd7edd'
ROOT = Path(__file__).resolve().parents[1]
EXACT = [
    'src/ui/ThemeWidgetArt.tsx', 'src/ui/WidgetArtMenu.tsx',
    'src/ui/WidgetArtLibraryList.tsx', 'src/ui/BlendedArt.tsx',
    'src/core/widgetArtLibrary.ts',
    'src/native/packs.ts', 'src/native/useRemoteCatalog.ts',
     'app/(tabs)/widgets.tsx',
    'targets/widget/SeamlessWidget.swift', 'targets/widget/WidgetArtLibrary.swift',
    'modules/glaze-widget-bridge/ios/ClockArtRenderer.swift',
    'targets/widget/DesignedWidget.swift', 'targets/widget/ThemedWidgetDrawing.swift',
    'src/ui/DesignedThemeWidgets.tsx',

]
ALLOWED = {
    'src/core/widgetOptions.ts': 'Inherited PR252: authored-size filtering, owned by Claude.',
    'src/core/themeArtSync.ts': 'Inherited PR252: plan only authored sizes, owned by Claude.',
    'app/theme/[id].tsx': 'Owner-directed four actions; restored ThemeWidgetArt and SeamlessCard sections and composer remain intact.',
    'targets/widget/HabitStreakWidget.swift': 'Owner-directed larger completion square and 44-point tap target, with compact large-family spacing.',
    'src/ui/StepCard.tsx': 'Owner-directed completion glyph increases from20 to28 points.',
    'app/install.tsx': 'Preview/export requested theme without persisting the global selection; larger completion glyph.',
    'src/store/activeTheme.ts': 'Stage (a): order explicit selections, defer art using the current selection, and ignore late focus reads.',
    'src/store/widgetTheme.ts': 'Stage (a): one native theme writer, immediate publication, and preview/launch writes guarded by the active selection.',
    'src/store/themeWidgetArt.ts': 'Stage (a): expose generation cancellation only; original planning, compositing and commit logic remain unchanged.',
    'src/core/packCatalog.ts': 'Remember a validated release in an installed pack manifest.',
    'src/core/packDownloader.ts': 'Persist the catalogue release when writing a downloaded manifest.',
    'src/core/themeArtResume.ts': 'Carry the installed manifest release through theme lookup.',
    'src/native/widgets.ts': 'Expose the recovery reset on the existing serial art queue.',
    'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift': 'Expose the separate photo-preserving recovery reset, then invalidate and reload.',
    'src/store/launchWork.ts': 'Run one-time recovery before the original deferred queue loads old pending state.',
    'src/core/artBlend.ts': 'Owner 2026-11-08 (copper moon showed the wallpaper through its dark limb): dim coloured interior pixels are held opaque (BLEND_KEY_TINT_LO/HI), mirrored in the bridge and blend-audit.py. Owned by Claude.',
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


# The action sheet must not delete or change the restored art compositing UI.
file = 'app/theme/[id].tsx'
old = subprocess.check_output(['git', 'show', BASE + ':apps/glaze/' + file], cwd=ROOT).decode()
current = (ROOT / file).read_text(encoding='utf-8')
start, end = 'type SeamlessStatus =', '/**\n * T179: the glass bar'
assert old[old.index(start):old.index(end)] == current[current.index(start):current.index(end)], 'Restored SeamlessCard changed'
assert 'heroUris={remoteHeroUris} remoteHeroSizes={remoteHeroSizes}' in current
assert '<ThemeWidgetsShelf theme={theme} />' in current
