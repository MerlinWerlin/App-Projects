// T48: shared "pick a photo" helpers for Home and Prepare. Every failure is thrown as an ImageCheckError whose
// `kind` the UI turns into a friendly message (src/ui/ImageErrorBoundary.tsx), never a red error screen.
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ImageCheckError, classifyImageError, isHeic, precheckImage, type ImageMeta } from '../core/imageErrors';
import type { RecentItem } from '../core/recent';
import { importImage, rememberImage } from './storage';

export type PickedPhoto = { uri: string; width?: number; height?: number; recent: RecentItem[] };

function metaOf(asset: ImagePicker.ImagePickerAsset): ImageMeta {
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize ?? null,
  };
}

/** Re-throw anything as an ImageCheckError with a kind (keeps the original message for logs). */
function asCheckError(e: unknown, meta?: ImageMeta): ImageCheckError {
  if (e instanceof ImageCheckError) return e;
  const message = e instanceof Error && e.message ? e.message : String(e);
  return new ImageCheckError(classifyImageError(e, meta), message);
}

/** HEIC / HEIF → JPEG with expo-image-manipulator, so every later step (and older Android) gets a plain JPEG. */
async function heicToJpeg(uri: string): Promise<{ uri: string; width: number; height: number }> {
  try {
    const out = await manipulateAsync(uri, [], { compress: 0.92, format: SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height };
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : 'HEIC conversion failed';
    throw new ImageCheckError(classifyImageError(e) === 'memory' ? 'memory' : 'heic', message);
  }
}

/**
 * Check a picked asset, convert HEIC to JPEG, copy it into the app's folder and add it to Recent.
 * Ordinary JPEG / PNG photos go straight through. Throws ImageCheckError.
 */
export async function acceptPickedAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedPhoto> {
  const meta = metaOf(asset);
  const early = precheckImage(meta);
  if (early) throw new ImageCheckError(early);
  try {
    let src = { uri: asset.uri, width: asset.width, height: asset.height };
    if (isHeic(meta)) src = await heicToJpeg(asset.uri);
    const uri = await importImage(src.uri);
    const recent = await rememberImage(uri, src.width || undefined, src.height || undefined);
    return { uri, width: src.width || undefined, height: src.height || undefined, recent };
  } catch (e) {
    throw asCheckError(e, meta);
  }
}

/** The first asset of a picker result, accepted; null when the person cancelled. Throws ImageCheckError. */
export async function acceptPickerResult(result: ImagePicker.ImagePickerResult): Promise<PickedPhoto | null> {
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return acceptPickedAsset(result.assets[0]);
}

/** Open the photo library and accept the chosen photo; null when cancelled. Throws ImageCheckError. */
export async function pickPhotoFromLibrary(): Promise<PickedPhoto | null> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  } catch (e) {
    throw asCheckError(e);
  }
  return acceptPickerResult(result);
}

/** Take a photo with the camera and accept it; null when cancelled. Permission is the caller's job. Throws ImageCheckError. */
export async function takePhotoWithCamera(): Promise<PickedPhoto | null> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } catch (e) {
    throw asCheckError(e);
  }
  return acceptPickerResult(result);
}
