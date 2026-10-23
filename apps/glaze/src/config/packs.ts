// Where downloadable theme packs live (T46, docs/THEME_PACKS.md).
// OWNER DECISION NEEDED: hosting is not chosen yet. While PACK_BASE_URL is empty, packs are
// disabled and the app makes no network call at all; Settings › Storage shows PACKS_DISABLED_MESSAGE.
// When a host is chosen, set this to the folder that contains one sub-folder per pack, e.g.
// 'https://example.invalid/glaze-packs' (no trailing slash needed). HTTPS only.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.
export const PACK_BASE_URL = '';

export const PACKS_DISABLED_MESSAGE = 'Theme packs arrive with the store release';
