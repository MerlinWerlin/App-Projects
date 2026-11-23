/**
 * Groutline Full Unlock: one-time non-consumable, no subscription. The Tiles calculator is free forever; the free
 * 7-day Trial item (user-started, guideline 3.1.1) or Full Unlock opens every other tool and saved jobs.
 */
export const UNLOCK_PRODUCT_ID = 'com.jared797.groutline.unlock';

/**
 * Australia base price set in App Store Connect (store/listing.json). Shown only when the store reports the Australian
 * storefront but returns product metadata in another currency (TestFlight quirk seen in Cue, Oct 2026).
 */
export const UNLOCK_AUSTRALIA_PRICE = 'A$4.99';

export type ToolId = 'tiles' | 'setout' | 'materials' | 'falls' | 'trim' | 'stairs';
export const FREE_TOOLS: readonly ToolId[] = ['tiles'];
export const isFree = (tool: ToolId) => FREE_TOOLS.includes(tool);
