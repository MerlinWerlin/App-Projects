// Glaze 1.0.39 (owner 2026-11-15): the "…" menu on a theme artwork (My widget art). Save to Photos uses
// the existing add-only Photos access; Add to Custom n copies the image into that Custom widget slot
// (resized natively, device only), after a confirm when the slot already has a picture. Pure UI glue:
// the list calls openArtworkActions with the piece's file:// URI.
import { ActionSheetIOS, Alert } from 'react-native';
import { CUSTOM_ART_SLOT_COUNT } from '../core/customArtSlots';
import { customArt } from '../native/customArt';
import { saveFileToPhotos } from '../store/myWallpapers';
import { haptic } from './haptics';

type T = (key: string, params?: Record<string, string | number>) => string;
type Toast = { show(message: string, tone?: 'success' | 'warning'): void };

async function savePiece(uri: string, t: T, toast: Toast): Promise<void> {
  const res = await saveFileToPhotos(uri);
  haptic(res === 'saved' ? 'success' : 'warning');
  const key = res === 'saved' ? 'ui.seamless.library.saved' : res === 'denied' ? 'ui.seamless.library.photosDenied' : 'ui.seamless.library.saveFailed';
  toast.show(t(key), res === 'saved' ? 'success' : 'warning');
}

async function putInCustom(slot: number, uri: string, t: T, toast: Toast): Promise<void> {
  const ok = await customArt.set(slot, uri);
  haptic(ok ? 'success' : 'warning');
  toast.show(t(ok ? 'ui.seamless.library.addedCustom' : 'ui.seamless.library.addFailed', { n: slot }), ok ? 'success' : 'warning');
}

/** Add to Custom `slot`: replaces a picture already there only after the person confirms. */
export async function addArtworkToCustom(slot: number, uri: string, t: T, toast: Toast): Promise<void> {
  const now = await customArt.list();
  if (now?.[slot - 1]) {
    Alert.alert(t('ui.seamless.library.replaceTitle', { n: slot }), t('ui.seamless.library.replaceBody', { n: slot }), [
      { text: t('ui.seamless.library.cancel'), style: 'cancel' },
      { text: t('ui.seamless.library.replace'), style: 'destructive', onPress: () => void putInCustom(slot, uri, t, toast) },
    ]);
  } else await putInCustom(slot, uri, t, toast);
}

/** The menu for Artwork `n`: Save to Photos, Add to Custom 1-5, Cancel. */
export function openArtworkActions(n: number, uri: string, t: T, toast: Toast): void {
  haptic('select');
  const custom = Array.from({ length: CUSTOM_ART_SLOT_COUNT }, (_, i) => t('ui.seamless.library.addCustom', { n: i + 1 }));
  const options = [t('ui.seamless.library.savePhotos'), ...custom, t('ui.seamless.library.cancel')];
  ActionSheetIOS.showActionSheetWithOptions({ title: t('ui.seamless.library.artworkA11y', { n }), options, cancelButtonIndex: options.length - 1 }, (i) => {
    if (i === 0) void savePiece(uri, t, toast);
    else if (i >= 1 && i <= CUSTOM_ART_SLOT_COUNT) void addArtworkToCustom(i, uri, t, toast);
  });
}
