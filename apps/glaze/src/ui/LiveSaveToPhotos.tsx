// "Save to Photos" for the loop editor (T30): what Expo Go can produce from a loop.
//  - Still frame wallpaper: the frame at the current position (videos, via expo-video's
//    VideoPlayer.generateThumbnailsAsync) or the GIF's first frame, framed with the editor's
//    crop and captured at the device's Lock Screen pixels through useOffscreenCapture.
//  - Save the clip: a copy of the source video / GIF, so it can be used with the full build.
// Expo Go safe: expo-video, expo-image, expo-media-library and view-shot only. The native
// "Save as Live Photo" button (the Live Lock Screen path, T127) stays separate.
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage, type ImageProps } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { VideoPlayer } from 'expo-video';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { checkClipForPhotos, stillFrameSeconds, type SaveOption } from '../core/liveSteps';
import { cropDisplayLayout, deviceForScreen, lockAspect, type Crop, type LoopProject } from '../core/loop';
import { ensurePhotosWriteAccess, openAppSettings, useOffscreenCapture } from '../render/saveWallpaper';
import type { Script } from '../core/i18n';
import { useT } from '../i18n';
import { onArtV2, radiusV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { Sheet } from './Sheet';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedSaveOptions } from './liveContext';

type FrameData = {
  source: ImageProps['source'];
  sourceW: number;
  sourceH: number;
  crop: Crop;
  aspect: number;
  /** Video thumbnails fill their rect like the preview's VideoView ('cover'); GIFs stretch like the preview's Image. */
  fit: 'cover' | 'fill';
};

type View_ =
  | { kind: 'menu' }
  | { kind: 'saved-still'; width: number; height: number }
  | { kind: 'saved-clip'; gif: boolean }
  | { kind: 'denied' }
  | { kind: 'unsupported' }
  | { kind: 'no-frame' }
  | { kind: 'failed' };

/** v2 system type for the roles this sheet uses, with the script's line-height fixes. */
function typeFor(script: Script): { body: TextStyle[]; label: TextStyle[]; small: TextStyle[] } {
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return { body: ts('body'), label: ts('headline'), small: ts('footnote') };
}

function asFileUri(uri: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `file://${uri}`;
}

type Props = {
  /** Latest edits at tap time. */
  getProject: () => LoopProject;
  /** The preview's player (videos), or null when it is not mounted. */
  getPlayer: () => VideoPlayer | null;
};

/** Design v2 (T56): system type, pill actions, hairline rows for the native-only options. */
export function LiveSaveToPhotos({ getProject, getPlayer }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const type = typeFor(script);
  const ctx = useMemo(() => liveContext(), []);
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<View_>({ kind: 'menu' });
  const [busy, setBusy] = useState<'still' | 'clip' | null>(null);
  const saver = useOffscreenCapture<FrameData>({ waitForReady: true, readyTimeoutMs: 8000 });
  const kind = getProject().kind;
  const options = localizedSaveOptions(t, ctx.build, kind);
  const others = options.filter((o) => o.id === 'live-photo');
  const still = options.find((o) => o.id === 'still-frame') as SaveOption;
  const clip = options.find((o) => o.id === 'clip') as SaveOption;

  const finish = (next: View_) => {
    haptic(next.kind === 'saved-still' || next.kind === 'saved-clip' ? 'success' : 'warning');
    setView(next);
  };

  const onStill = async () => {
    if (busy) return;
    haptic('select');
    setBusy('still');
    try {
      const p = getProject();
      const s = Dimensions.get('screen');
      const device = deviceForScreen(s.width, s.height);
      let source: ImageProps['source'];
      if (p.kind === 'gif') {
        source = { uri: asFileUri(p.sourceUri) };
      } else {
        const player = getPlayer();
        if (!player || typeof player.generateThumbnailsAsync !== 'function') {
          finish({ kind: 'no-frame' });
          return;
        }
        let at = 0;
        try {
          at = stillFrameSeconds(player.currentTime, p.trim, p.sourceDurationMs);
        } catch {
          at = stillFrameSeconds(NaN, p.trim, p.sourceDurationMs);
        }
        let thumbs: unknown[] = [];
        try {
          thumbs = await player.generateThumbnailsAsync([at]);
        } catch {
          thumbs = [];
        }
        if (!thumbs || thumbs.length === 0 || !thumbs[0]) {
          finish({ kind: 'no-frame' });
          return;
        }
        // A VideoThumbnail is a SharedRef<'image'>, which expo-image accepts as a source.
        source = thumbs[0] as ImageProps['source'];
      }
      const res = await saver.save(
        {
          source,
          sourceW: p.sourceWidth,
          sourceH: p.sourceHeight,
          crop: p.crop,
          aspect: lockAspect(device),
          fit: p.kind === 'gif' ? 'fill' : 'cover',
        },
        device.pixels,
      );
      if (res.ok) finish({ kind: 'saved-still', width: res.width, height: res.height });
      else if (res.reason === 'denied') finish({ kind: 'denied' });
      else if (res.reason === 'unreadable') finish(p.kind === 'gif' ? { kind: 'unsupported' } : { kind: 'no-frame' });
      else finish({ kind: 'failed' });
    } catch {
      finish({ kind: 'failed' });
    } finally {
      setBusy(null);
    }
  };

  const onClip = async () => {
    if (busy) return;
    haptic('select');
    setBusy('clip');
    try {
      const p = getProject();
      const check = checkClipForPhotos(p.sourceUri, p.kind);
      if (!check.ok) {
        finish({ kind: 'unsupported' });
        return;
      }
      if (!(await ensurePhotosWriteAccess())) {
        finish({ kind: 'denied' });
        return;
      }
      // Add-only access is enough for saveToLibraryAsync (createAssetAsync also needs read access).
      await MediaLibrary.saveToLibraryAsync(asFileUri(p.sourceUri));
      finish({ kind: 'saved-clip', gif: p.kind === 'gif' });
    } catch {
      finish({ kind: 'failed' });
    } finally {
      setBusy(null);
    }
  };

  // Pause the preview while the sheet is open so the still is the moment the user saw.
  const setPlaying = (play: boolean) => {
    try {
      const pl = getPlayer();
      if (pl) {
        if (play) pl.play();
        else pl.pause();
      }
    } catch {
      // Player released.
    }
  };

  const close = () => {
    if (busy) return;
    setVisible(false);
    setPlaying(true);
  };

  const title =
    view.kind === 'saved-still' || view.kind === 'saved-clip'
      ? t('liveUi.savedToPhotos')
      : view.kind === 'denied'
        ? t('liveUi.save.titleDenied')
        : view.kind === 'menu'
          ? t('liveUi.save.button')
          : t('liveUi.save.titleFailed');

  return (
    <>
      <PillButton
        block
        label={t('liveUi.save.button')}
        icon="download"
        variant="tinted"
        accessibilityHint={t('liveUi.save.hint')}
        onPress={() => {
          haptic('select');
          setPlaying(false);
          setView({ kind: 'menu' });
          setVisible(true);
        }}
      />
      <Sheet visible={visible} onClose={close} title={title}>
        {view.kind === 'menu' ? (
          <>
            <Text style={[...type.body, { color: c.ink }]}>
              {ctx.build === 'expo-go'
                ? t('liveUi.save.introExpoGo')
                : t('liveUi.save.introFull')}
            </Text>
            <OptionRow option={still} />
            <PillButton
              block
              label={busy === 'still' ? t('liveUi.save.savingStill') : t('liveUi.save.saveStill')}
              icon="image"
              busy={busy === 'still'}
              disabled={busy !== null}
              accessibilityHint={still.detail}
              onPress={() => void onStill()}
            />
            <OptionRow option={clip} />
            <PillButton
              block
              label={busy === 'clip' ? t('liveUi.save.saving') : clip.label}
              icon="film"
              variant="tinted"
              busy={busy === 'clip'}
              disabled={busy !== null}
              accessibilityHint={clip.detail}
              onPress={() => void onClip()}
            />
            {others.map((o) => (
              <View key={o.id} style={[styles.other, { borderColor: c.separator }]} accessible accessibilityLabel={o.available ? t('liveUi.save.otherOkA11y', { label: o.label }) : t('liveUi.save.otherNoA11y', { label: o.label, reason: o.unavailableReason ?? '' })}>
                <Feather name={o.available ? 'check-circle' : 'lock'} size={16} color={o.available ? c.ok : c.inkSecondary} />
                <Text style={[...type.small, styles.flex1, { color: c.inkSecondary }]}>
                  {o.available ? t('liveUi.save.otherOk', { label: o.label }) : t('liveUi.save.otherNo', { label: o.label, reason: o.unavailableReason ?? '' })}
                </Text>
              </View>
            ))}
          </> // i18n-ignore (generic/comparison, not text)
        ) : view.kind === 'saved-still' ? (
          <>
            <Text style={[...type.body, { color: c.ink }]}>
              {t('liveUi.save.savedStill', { size: `\u2066${view.width} × ${view.height}\u2069` })}
            </Text>
            <Text style={[...type.body, { color: c.ink }]}>{t('liveUi.save.useIt', { path: t('liveUi.wallpaperPath') })}</Text>
            <Text style={[...type.small, { color: c.inkSecondary }]}>
              {t('liveUi.save.stillNote')}
            </Text>
            <PillButton block label={t('common.done')} onPress={close} />
          </> // i18n-ignore (generic/comparison, not text)
        ) : view.kind === 'saved-clip' ? (
          <>
            <Text style={[...type.body, { color: c.ink }]}>
              {view.gif
                ? t('liveUi.save.clipGif')
                : t('liveUi.save.clipVideo')}
            </Text>
            <Text style={[...type.small, { color: c.inkSecondary }]}>
              {t('liveUi.save.clipNote')}
            </Text>
            <PillButton block label={t('common.done')} onPress={close} />
          </> // i18n-ignore (generic/comparison, not text)
        ) : view.kind === 'denied' ? (
          <>
            <Text style={[...type.body, { color: c.ink }]}>
              {t('liveUi.save.deniedBody')}
            </Text>
            <Text style={[...type.body, { color: c.inkSecondary }]}>{t('liveUi.save.deniedSteps')}</Text>
            <PillButton
              block
              label={t('liveUi.openSettings')}
              icon="settings"
              onPress={() => {
                setVisible(false);
                setPlaying(true);
                openAppSettings();
              }}
            />
            <PillButton block label={t('liveUi.notNow')} variant="plain" onPress={close} />
          </>
        ) : (
          <>
            <Text style={[...type.body, { color: c.ink }]}>
              {view.kind === 'unsupported'
                ? t('liveUi.save.unsupported')
                : view.kind === 'no-frame'
                  ? t('liveUi.save.noFrame')
                  : t('liveUi.save.failed')}
            </Text>
            <PillButton block label={t('common.back')} variant="tinted" onPress={() => setView({ kind: 'menu' })} />
            <PillButton block label={t('common.close')} variant="plain" onPress={close} />
          </>
        )}
      </Sheet>
      <OffscreenFrame ref={saver.ref} job={saver.job} onReady={saver.markReady} />
    </>
  );
}

type OptionRowProps = {
  option: SaveOption;
};

function OptionRow({ option }: OptionRowProps) {
  const { c } = useColorsV2();
  const { script } = useT();
  const type = typeFor(script);
  return (
    <View style={styles.optionText}>
      <Text style={[...type.label, { color: c.ink }]}>{option.label}</Text>
      <Text style={[...type.small, { color: c.inkSecondary }]}>{option.detail}</Text>
    </View>
  );
}

/** The framed still at full Lock Screen size, parked off screen for capture. */
const OffscreenFrame = forwardRef<
  View,
  {
    job: { data: FrameData; layout: { width: number; height: number }; key: number } | null;
    onReady: (ok: boolean) => void;
  }
>(function OffscreenFrame({ job, onReady }, ref) {
  // A video thumbnail is already decoded in memory; if expo-image does not report onLoad for
  // an image ref, treat it as ready shortly after mounting (markReady only fires once).
  const key = job?.key ?? 0;
  const isRef = job ? job.data.fit === 'cover' : false;
  useEffect(() => {
    if (!key || !isRef) return;
    const t = setTimeout(() => onReady(true), 1200);
    return () => clearTimeout(t);
  }, [key, isRef, onReady]);
  if (!job) return null;
  const { data, layout } = job;
  const rect = cropDisplayLayout({ width: data.sourceW, height: data.sourceH }, data.aspect, data.crop, layout.width);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -10000, top: 0, width: layout.width, height: layout.height }}
    >
      <View ref={ref} collapsable={false} style={{ width: layout.width, height: layout.height, overflow: 'hidden', backgroundColor: onArtV2.black }}>
        <ExpoImage
          source={data.source}
          contentFit={data.fit}
          autoplay={false}
          cachePolicy="none"
          transition={null}
          onLoad={() => onReady(true)}
          onError={() => onReady(false)}
          style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  optionText: { gap: spaceV2.xxs, marginTop: spaceV2.xs },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spaceV2.sm,
    borderRadius: radiusV2.control,
  },
  flex1: { flex: 1 },
});
