// T28: draws only the saved crop (src/core/qrcrop.ts) of a ticket image, as large as fits, with no new native
// module: an overflow-hidden frame the size of the region and the whole image inside it, scaled and offset.
// The original file is never changed. While the image size is unknown nothing is drawn; if it can't be read,
// onError lets the ticket view fall back to the whole image.
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { cropLayout, type CropRect } from '../core/qrcrop.ts';

/** The image's pixel size, null while loading or when it can't be read (then `onError`). */
export function useImageSize(uri: string | null, onError?: () => void): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let alive = true;
    setSize(null);
    if (!uri) return;
    try {
      Image.getSize(
        uri,
        (w, h) => {
          if (alive && w > 0 && h > 0) setSize({ w, h });
          else if (alive) onError?.();
        },
        () => alive && onError?.(),
      )?.catch?.(() => {});
    } catch {
      onError?.();
    }
    return () => {
      alive = false;
    };
    // onError is a callback from the parent; re-reading the size only when the file changes is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  return size;
}

export function CroppedImage({
  uri,
  crop,
  boxW,
  boxH,
  label,
  onError,
}: {
  uri: string;
  crop: CropRect;
  boxW: number;
  boxH: number;
  label: string;
  onError: () => void;
}) {
  const size = useImageSize(uri, onError);
  const lay = size ? cropLayout(crop, size.w, size.h, boxW, boxH) : null;
  if (!lay) return <View style={{ width: boxW, height: Math.min(boxW, boxH) }} />;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: lay.frameW, height: lay.frameH, overflow: 'hidden' }}>
      <Image
        source={{ uri }}
        resizeMode="stretch"
        onError={onError}
        style={{ position: 'absolute', left: lay.left, top: lay.top, width: lay.imageW, height: lay.imageH }}
      />
    </View>
  );
}
