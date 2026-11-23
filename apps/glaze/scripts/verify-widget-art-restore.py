from pathlib import Path
import difflib
import json
import subprocess

BASE = '1a12b3b2842fec5668f1b13d56d93cb256dd7edd'
ROOT = Path(__file__).resolve().parents[1]
EXACT = [
    'src/ui/BlendedArt.tsx',
    'src/native/useRemoteCatalog.ts',
    'modules/glaze-widget-bridge/ios/ClockArtRenderer.swift',
    'targets/widget/DesignedWidget.swift',
    'src/ui/DesignedThemeWidgets.tsx',

]
ALLOWED = {
    'targets/widget/ThemedWidgetDrawing.swift': 'Owner 2026-11-22 (theme artwork feels awkward in small corners): accept an optional native ornament path and aspect-fit it only in the medium Clock header and Calendar motif boxes. Identities without it retain the restored drawing branches; larger Clock and all Battery hero compositions remain intact. The actual Swift identity parser and complete WidgetKit extension are checked by glaze-widgets-check; designedWidgets.test.ts checks legacy fallback, unchanged hero SVGs, fitted compact placement and saved identity round-trips. Owned by Codex lane A.',
    'src/native/packs.ts': 'Glaze 1.0.38 (owner 2026-11-15: keep R2 and bundle a small starter set): a starter whose bundled version the catalogue lists installs through the same downloadRemoteArtPack with a bundle-reading transport (no network); first launch with no cached catalogue lists the starters; installNextStarterPack for the launch queue. Download, update, verification and catalogue logic otherwise unchanged. Owned by Claude. 1.0.39: setPackInstalledListener, told after every successful pack install so the theme in use gets its widget art.',
    'src/ui/WidgetArtMenu.tsx': 'Design review 1.0.33 (owner TestFlight screenshots: Live art cards showed an empty frame / ring): one added overlay, <LiveArtSample> (src/ui/LiveArtSample.tsx), draws a sample date / 25:00 / time inside a number-free piece liveFrame, plus a themeInk prop. Compositing, blending, placement and every other line unchanged. Owned by Claude.',
    'app/(tabs)/widgets.tsx': 'Owner 2026-11-14 (large image and large number next to each other, not separate): the separate theme art picker is no longer shown; My widget art is the one numbered Artwork list. 1.0.36 (owner 2026-11-15, make your own theme): a Your artwork section (src/ui/CustomArtSlots.tsx) is added under it on Small; nothing above it changes. Owned by Claude. 1.0.37 (owner 2026-11-15): the Medium / Large size picker and Coming soon card are removed; the tab is Small only (My widget art and Your artwork always show). 1.0.39: passes the theme palette to My widget art for its theme-design slots.',
    'src/core/widgetArtLibrary.ts': 'Owner 2026-11-13 (Artwork 1 to 5 must match in the app and on the Home Screen): the index carries an optional ordered artwork list (readMeta). Pieces, parsing and every other field unchanged. Owned by Claude.',
    'src/ui/ThemeWidgetArt.tsx': 'Owner 2026-11-13 (remove the large variations unless native): the theme pack art menu shows on the Small tab only; Medium and Large keep the native widgets. Owned by Claude.',
    'src/ui/WidgetArtLibraryList.tsx': 'Owner 2026-11-12 ("colour code them"): each piece that fills an Artwork slot shows the colour and number badge of that slot (src/core/artworkSlots.ts). Listing, removing and managing unchanged. Owned by Claude. 1.0.37 (owner TestFlight 1.0.36): re-reads on an active-theme change and after each theme art sync index write; placeholder rows (never pieces of the previous theme) while the art is being made. 1.0.39 (owner 2026-11-15): each piece once, the theme-colour design in a slot without one (never a repeat); a More menu per piece (Save to Photos, Add to Custom 1-5) via src/ui/artworkActions.ts.',
    'src/core/widgetOptions.ts': 'Inherited PR252: authored-size filtering, owned by Claude.',
    'src/core/themeArtSync.ts': 'Inherited PR252: plan only authored sizes; owner 2026-11-08: art pieces planned first in each size. Owned by Claude.',
    'app/theme/[id].tsx': 'Owner-directed four actions; restored ThemeWidgetArt section and composer remain intact. 1.0.34 (owner 2026-11-14): the SeamlessCard spot picker is removed (iOS does not let apps place widgets); honest add-a-widget steps + Watch how in its place. 1.0.39 (owner TestFlight 1.0.37): selectTheme downloads a pack theme that is not on the phone before applying it, so its widget art is made at once. 1.0.39 (owner build 88): one flow, Use this theme? then a next-steps checklist (wallpaper until saved, icons, widgets); View widgets opens the Widgets tab; the widgets step, the theme widget shelf and the Widget Studio previews are no longer shown.',
    'targets/widget/HabitStreakWidget.swift': 'Owner-directed larger completion square and 44-point tap target, with compact large-family spacing.',
    'src/ui/StepCard.tsx': 'Owner-directed completion glyph increases from20 to28 points.',
    'app/install.tsx': 'Preview/export requested theme without persisting the global selection; larger completion glyph.',
    'src/store/activeTheme.ts': 'Stage (a): order explicit selections, defer art using the current selection, and ignore late focus reads. 1.0.39: applyThemeEverywhere marks the art Preparing; a finished pack install of the theme in use and ensureActiveThemeArt at launch queue the same art sync.',
    'src/store/widgetTheme.ts': 'Stage (a): one native theme writer, immediate publication, and preview/launch writes guarded by the active selection.',
    'src/store/themeWidgetArt.ts': 'Stage (a): expose generation cancellation. Owner 2026-11-08 (art stars must match the wallpaper): art pieces compose on the wallpaper crop (existing seamless path) instead of a flat colour. Owned by Claude. 1.0.37: a read-only sync status (syncing theme id + revision bumped after each index write) for the Widgets tab; composition and commits unchanged. 1.0.39: markThemeArtPending (Preparing straight after a theme choice, cleared by the sync or a 60 s safety timer).',
    'src/core/packCatalog.ts': 'Remember a validated release in an installed pack manifest.',
    'src/core/packDownloader.ts': 'Persist the catalogue release when writing a downloaded manifest.',
    'src/core/themeArtResume.ts': 'Carry the installed manifest release through theme lookup.',
    'src/native/widgets.ts': 'Expose the recovery reset on the existing serial art queue.',
    'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift': 'Expose the separate photo-preserving recovery reset, then invalidate and reload. 1.0.36 (owner 2026-11-15): three added functions, customArtSlots / setCustomArt / clearCustomArt (CustomArtSlots.swift, the custom-art folder only); every existing function unchanged.',
    'src/store/launchWork.ts': 'Run one-time recovery before the original deferred queue loads old pending state.',
    'targets/widget/SeamlessWidget.swift': 'Owner 2026-11-09 (Add Widget gallery kept the old theme): isPreview snapshots and placeholders render from a 360 px ImageIO thumbnail (GalleryThumbnail, preview mode) so the gallery fits the widget extension memory limit. Timelines (placed widgets) unchanged. Owned by Claude.',
    'targets/widget/WidgetArtLibrary.swift': 'Owner 2026-11-09: ArtEntry.preview from context.isPreview, WidgetArtStore.preview (thumbnail), and a per-record design flag so Art slots read index.json once. Timelines unchanged. Owned by Claude.',
    'src/core/artBlend.ts': 'Owner 2026-11-08 (copper moon showed the wallpaper through its dark limb): dim coloured interior pixels are held opaque (BLEND_KEY_TINT_LO/HI), mirrored in the bridge and blend-audit.py. Owned by Claude.',
}
# 1.0.40 artwork follow-up: data loading only; the restored renderer and widget layout stay intact.
for file in ('src/ui/ThemeWidgetArt.tsx', 'src/store/themeWidgetArt.ts'):
    ALLOWED[file] += ' 1.0.40 (15 Nov distinct-artwork brief): consume the shared generated bundled artwork list, including four new WebPs per original theme; preserve WebP extensions in cached source URIs. Existing composition and UI layout remain unchanged.'
# widgetArtRecovery.ts was introduced after BASE. Its 1.0.40 change advances only the one-time
# data key from v6 to v7 so an active bundled theme includes its four additions after upgrade.

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
# 1.0.34 (owner 2026-11-14: "theres an option to go like top right middle right bottom right etc and then save the
# widget to the home screen - i dont believe we can do this so remove it"): the SeamlessCard (spot picker) is removed
# on purpose; the widget art shelf (ThemeWidgetsShelf / ThemeWidgetArt) stays.
# 1.0.39 (owner TestFlight build 88: "we removed Medium/Large and the extras from the Widgets TAB, but the THEME PAGE's
# View widgets screen still has all of it"; hide every live-widget choice for now): the theme page no longer renders the
# shelf. View widgets opens the Widgets tab (Artwork 1-5 only). The restored components themselves stay in the repo,
# unchanged (checked above), ready for when live widgets come back (docs/FUTURE.md).
file = 'app/theme/[id].tsx'
current = (ROOT / file).read_text(encoding='utf-8')
assert 'function SeamlessCard(' not in current and '<SeamlessCard' not in current, 'Seamless spot picker is back'
assert '<ThemeWidgetsShelf' not in current and '<ThemeWidgetArt' not in current, 'live widget choices are back on the theme page'
assert "router.navigate('/widgets')" in current, 'View widgets must open the Widgets tab'
for kept in ['src/ui/ThemeWidgetArt.tsx', 'src/ui/WidgetArtMenu.tsx', 'src/ui/DesignedThemeWidgets.tsx']:
    assert (ROOT / kept).exists(), f'{kept} must stay in the repo'
