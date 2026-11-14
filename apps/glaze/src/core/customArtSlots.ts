// Owner 2026-11-15 ("make your own theme, be creative"): five "Your artwork" slots on the Widgets
// tab, shown on the Home Screen by the Custom 1-5 widgets (targets/widget/CustomArtWidgets.swift).
// The pictures stay on the device: the bridge (modules/glaze-widget-bridge/ios/CustomArtSlots.swift)
// writes a square JPEG of at most CUSTOM_ART_MAX_PIXELS into the App Group's custom-art folder.
// Keep the numbers below equal to CustomArtStore / CustomArtSlots (customArtSlots.test.ts checks).

export const CUSTOM_ART_SLOT_COUNT = 5;
/** Long edge of a stored picture: sharp on a 3x small widget (~510 px), ~1.4 MB once decoded. */
export const CUSTOM_ART_MAX_PIXELS = 600;

/** One entry per slot (index 0 = Custom 1): the picture's file:// URI, or null when empty. */
export type CustomArtList = (string | null)[];

export const EMPTY_CUSTOM_ART: CustomArtList = Array.from({ length: CUSTOM_ART_SLOT_COUNT }, () => null);

/** The bridge's answer as exactly five slots; anything that is not a file:// URI is an empty slot. */
export function normaliseCustomArtList(raw: unknown): CustomArtList {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: CUSTOM_ART_SLOT_COUNT }, (_, i) => {
    const v = list[i];
    return typeof v === 'string' && v.startsWith('file://') ? v : null;
  });
}

export function isCustomArtSlot(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= CUSTOM_ART_SLOT_COUNT;
}
