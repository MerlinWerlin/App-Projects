// T28 crop editor (moved out of app/crop/[id].tsx in T155 so tickets and vault documents share it): frame the QR
// code or barcode in an image so the ticket / document view shows just the code, big and bright. Drag a corner to
// resize, drag inside the frame to move it; Smaller / Larger / Start again do the same with buttons (VoiceOver and
// anyone who can't drag). No animation: the frame follows the finger. The caller saves the rectangle on the
// attachment (src/core/qrcrop.ts); the image file is never changed.
import { useRef, useState } from 'react';
import { AccessibilityInfo, Image, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Attachment } from '../core/model.ts';
import { cleanCrop, dragCorner, initialCrop, moveCrop, scaleCrop, toFraction, type Corner, type CropRect } from '../core/qrcrop.ts';
import { attachmentKind } from '../core/tickets.ts';
import { haptic } from '../native/device.ts';
import { appPath } from '../native/files.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { CroppedImage, useImageSize } from './CroppedImage.tsx';
import { Body, Button, EmptyState, Label, Warning } from './kit.tsx';

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
const HANDLE = TOUCH;

export type CropEditorProps = {
  /** The image copy being cropped; null when its booking or document is gone. */
  a: Attachment | null;
  /** Body of the not-found state (the booking's or the document's wording). */
  notFound: string;
  /** Saves the crop (null removes it); false when it could not be saved. */
  onSave: (next: CropRect | null) => Promise<boolean>;
  onClose: () => void;
  /** T155: wording for a document copy (defaults to the ticket wording). */
  body?: string;
  imageLabel?: string;
};

export function CropEditor({ a, notFound, onSave, onClose: close, body: bodyText, imageLabel }: CropEditorProps) {
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const isImage = !!a && attachmentKind(a.mime, a.name) === 'image';
  const uri = a && isImage ? appPath(a.uri) : null;

  const [broken, setBroken] = useState(false);
  const size = useImageSize(uri, () => setBroken(true));
  const [rect, setRect] = useState<CropRect | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ rect: CropRect; x: number; y: number } | null>(null);

  // Starting frame: the saved crop, else a centred square.
  const current: CropRect | null = rect ?? (size ? (cleanCrop(a?.qrCrop) ?? initialCrop(size.w, size.h)) : null);

  // The image fitted into the space left between the text and the buttons (no scroll view: it would take the drag).
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onBox = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox((b) => (b && Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
  };
  const boxW = box?.w ?? 0;
  const boxH = box?.h ?? 0;
  // Room for half a handle round the image, so the corner handles stay inside their parent (iOS only delivers
  // touches inside a view's bounds).
  const scale = size && box ? Math.max(0, Math.min((boxW - HANDLE) / size.w, (boxH - HANDLE) / size.h)) : 0;
  const dispW = size ? Math.round(size.w * scale) : 0;
  const dispH = size ? Math.round(size.h * scale) : 0;

  const grab = (e: GestureResponderEvent) => {
    if (!current) return;
    start.current = { rect: current, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const drag = (corner: Corner | 'move') => (e: GestureResponderEvent) => {
    const s = start.current;
    if (!s) return;
    const { dx, dy } = toFraction(e.nativeEvent.pageX - s.x, e.nativeEvent.pageY - s.y, dispW, dispH);
    setRect(corner === 'move' ? moveCrop(s.rect, dx, dy) : dragCorner(s.rect, corner, dx, dy));
  };
  const release = () => {
    start.current = null;
  };
  const responder = (corner: Corner | 'move') => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: grab,
    onResponderMove: drag(corner),
    onResponderRelease: release,
    onResponderTerminate: release,
  });

  const save = async (next: CropRect | null) => {
    if (!a || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (!(await onSave(next))) {
        setFailed(true);
        AccessibilityInfo.announceForAccessibility(t('tpolish.crop.err.save'));
        return;
      }
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t(next ? 'tpolish.crop.saved' : 'tpolish.crop.removed'));
      close();
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!a) {
    body = <EmptyState art="magnifier" title={t('tpolish.crop.title')} body={notFound} />;
  } else if (!isImage) {
    body = <EmptyState art="ticket" title={t('tpolish.crop.title')} body={t('tpolish.crop.notImage')} />;
  } else if (broken) {
    body = <EmptyState art="ticket" title={t('tpolish.crop.title')} body={t('tpolish.crop.broken')} />;
  } else if (!size || !current || !uri || !box) {
    body = (
      <View onLayout={onBox} style={{ flex: 1 }}>
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 16, color: theme.muted }}>
          {t('tpolish.crop.loading')}
        </Text>
      </View>
    );
  } else {
    const P = HANDLE / 2;
    const fx = P + current.x * dispW;
    const fy = P + current.y * dispH;
    const fw = current.w * dispW;
    const fh = current.h * dispH;
    const shade = { position: 'absolute' as const, backgroundColor: theme.scrim };
    body = (
      <>
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, color: theme.ink }}>
            {t('tpolish.crop.title')}
          </Text>
          <Body muted>{bodyText ?? t('tpolish.crop.body')}</Body>
        </View>

        <View onLayout={onBox} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View accessible accessibilityRole="image" accessibilityLabel={imageLabel ?? t('tpolish.crop.imageLabel')} style={{ alignSelf: 'center', width: dispW + HANDLE, height: dispH + HANDLE }}>
            <Image source={{ uri }} resizeMode="stretch" onError={() => setBroken(true)} style={{ position: 'absolute', left: P, top: P, width: dispW, height: dispH }} />
            {/* Dim everything outside the frame. */}
            <View pointerEvents="none" style={[shade, { left: P, top: P, width: dispW, height: fy - P }]} />
            <View pointerEvents="none" style={[shade, { left: P, top: fy + fh, width: dispW, height: Math.max(0, P + dispH - fy - fh) }]} />
            <View pointerEvents="none" style={[shade, { left: P, top: fy, width: fx - P, height: fh }]} />
            <View pointerEvents="none" style={[shade, { left: fx + fw, top: fy, width: Math.max(0, P + dispW - fx - fw), height: fh }]} />
            {/* The frame: drag inside to move. */}
            <View
              {...responder('move')}
              accessibilityLabel={t('tpolish.crop.frame')}
              style={{ position: 'absolute', left: fx, top: fy, width: fw, height: fh, borderWidth: 2, borderColor: theme.accent }}
            />
            {CORNERS.map((c) => {
              const cx = c === 'tl' || c === 'bl' ? fx : fx + fw;
              const cy = c === 'tl' || c === 'tr' ? fy : fy + fh;
              return (
                <View
                  key={c}
                  {...responder(c)}
                  accessibilityLabel={t(`tpolish.crop.corner.${c}`)}
                  style={{ position: 'absolute', left: cx - HANDLE / 2, top: cy - HANDLE / 2, width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.accentStrong, borderWidth: 3, borderColor: theme.paper }} />
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
          <View style={{ gap: space.xs, alignItems: 'center' }}>
            <Label>{t('tpolish.crop.preview')}</Label>
            <View style={{ backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.xs }}>
              <CroppedImage uri={uri} crop={current} boxW={96} boxH={96} label={t('tpolish.crop.previewLabel')} onError={() => setBroken(true)} />
            </View>
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <View style={{ flex: 1 }}>
                <Button label={t('tpolish.crop.smaller')} hint={t('tpolish.crop.smallerHint')} kind="quiet" icon="remove" onPress={() => setRect(scaleCrop(current, 0.85))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t('tpolish.crop.larger')} hint={t('tpolish.crop.largerHint')} kind="quiet" icon="add" onPress={() => setRect(scaleCrop(current, 1 / 0.85))} />
              </View>
            </View>
            <Button label={t('tpolish.crop.reset')} hint={t('tpolish.crop.resetHint')} kind="quiet" onPress={() => setRect(initialCrop(size.w, size.h))} />
          </View>
        </View>
        {failed ? <Warning text={t('tpolish.crop.err.save')} /> : null}
      </>
    );
  }

  const canSave = !!(a && isImage && size && current && !broken);
  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <View style={{ flex: 1, paddingTop: insets.top + space.m, paddingHorizontal: space.l, paddingBottom: space.m, gap: space.m }}>{body}</View>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.paper }}>
        {canSave ? <Button label={t('tpolish.crop.save')} hint={t('tpolish.crop.saveHint')} onPress={() => current && save(current)} /> : null}
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {canSave && a?.qrCrop ? (
            <View style={{ flex: 1 }}>
              <Button label={t('tpolish.crop.remove')} hint={t('tpolish.crop.removeHint')} kind="quiet" onPress={() => save(null)} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={t('tpolish.crop.cancel')} hint={t('tpolish.crop.cancelHint')} kind="quiet" onPress={close} />
          </View>
        </View>
      </View>
    </View>
  );
}
