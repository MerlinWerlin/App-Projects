// Tips: the catalogue (first-run cards on the Themes tab + contextual one-line tips near features)
// and pure dismiss/restore state. Stored as glaze.tips.v1 = { dismissed: TipId[] } (T09 shape, unchanged).

export const TIPS_KEY = 'glaze.tips.v1';

export type TipPlacement =
  | 'first-run'
  | 'themes'
  | 'wallpaper'
  | 'icons'
  | 'install'
  | 'live'
  | 'shapes'
  | 'override'
  | 'add-app';

export type TipId =
  | 'icons-added'
  | 'bulk-install'
  | 'live-lock'
  | 'theme-pick'
  | 'photo-background'
  | 'wallpaper-save'
  | 'icon-shapes'
  | 'icon-override'
  | 'missing-app'
  | 'install-not-verified'
  | 'live-loop';

export type Tip = {
  id: TipId;
  title: string;
  /** At most two short sentences. */
  body: string;
  placement: TipPlacement;
  order: number;
  /** Feather icon name (kept as a plain string so core stays UI-free). */
  icon: string;
};

/** The three T09 first-run cards, in their original order. */
export const FIRST_RUN_TIP_IDS: readonly ['icons-added', 'bulk-install', 'live-lock'] = Object.freeze([
  'icons-added',
  'bulk-install',
  'live-lock',
] as const);

export const TIPS: readonly Tip[] = Object.freeze([
  {
    id: 'icons-added',
    title: 'Icons are added, not replaced',
    body: 'iOS does not let any app change another app’s icon. Glaze adds a themed shortcut that opens the real app; move the originals to the App Library.',
    placement: 'first-run',
    order: 1,
    icon: 'plus-square',
  },
  {
    id: 'bulk-install',
    title: 'Install all at once',
    body: 'Add your whole set at once with one profile, through Safari and then Settings. The guided Shortcuts method is always there if you prefer one at a time.',
    placement: 'first-run',
    order: 2,
    icon: 'layers',
  },
  {
    id: 'live-lock',
    title: 'Make a Live Photo',
    body: 'Turn a video into a Live Photo in the Live Photo maker, under Wallpapers. It moves in Photos; as a wallpaper, iPhone often keeps app-made Live Photos still.',
    placement: 'first-run',
    order: 3,
    icon: 'film',
  },
  {
    id: 'theme-pick',
    title: 'Start from a theme',
    body: 'Open a theme to preview its wallpaper and icons together. You can still change the shape, colours or any single icon afterwards.',
    placement: 'themes',
    order: 10,
    icon: 'grid',
  },
  {
    id: 'photo-background',
    title: 'Use your own photo',
    body: 'Glaze can’t set wallpapers itself. Save the result to Photos, then choose it in Settings › Wallpaper.',
    placement: 'wallpaper',
    order: 20,
    icon: 'image',
  },
  {
    id: 'wallpaper-save',
    title: 'Applying a saved wallpaper',
    body: 'In Settings › Wallpaper, tap Add New Wallpaper and pick the image from Photos. It is already sized for your iPhone, so no zooming is needed.',
    placement: 'wallpaper',
    order: 21,
    icon: 'download',
  },
  {
    id: 'icon-shapes',
    title: 'How shapes look on iPhone',
    body: 'iOS shows added icons inside its own rounded square. Circle and blob shapes sit on a background colour inside that square.',
    placement: 'shapes',
    order: 30,
    icon: 'square',
  },
  {
    id: 'icon-override',
    title: 'Use your own image for one icon',
    body: 'An override changes one app’s icon in this theme, or in all themes if you choose. Restore brings back the theme icon and keeps your image.',
    placement: 'override',
    order: 40,
    icon: 'edit-3',
  },
  {
    id: 'missing-app',
    title: 'App not in the list?',
    body: 'Glaze can’t see which apps are installed, so it uses a catalogue. Add your own app and image, made here or in any image tool.',
    placement: 'add-app',
    order: 41,
    icon: 'search',
  },
  {
    id: 'install-not-verified',
    title: '“Not Verified” is expected',
    body: 'The profile is made on your phone and isn’t signed, so Settings shows Not Verified. It only adds Home Screen icons.',
    placement: 'install',
    order: 50,
    icon: 'shield',
  },
  {
    id: 'live-loop',
    title: 'How Live Photos move',
    body: 'A Live Photo moves when you press it in Photos; it isn’t a constant loop. As a wallpaper, iPhone may say Motion not available.',
    placement: 'live',
    order: 60,
    icon: 'film',
  },
] satisfies Tip[]);

export const TIP_IDS: readonly TipId[] = Object.freeze(TIPS.map((t) => t.id));

export function isTipId(x: unknown): x is TipId {
  return typeof x === 'string' && (TIP_IDS as readonly string[]).includes(x);
}

export function getTip(id: TipId): Tip {
  const t = TIPS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tip ${id}`);
  return t;
}

/** Tips for a placement that are not dismissed, in display order. `null` dismissed = still loading: show nothing. */
export function visibleTips(placement: TipPlacement, dismissed: readonly TipId[] | null): Tip[] {
  if (dismissed === null) return [];
  return TIPS.filter((t) => t.placement === placement && !dismissed.includes(t.id)).sort((a, b) => a.order - b.order);
}

/** The first of `ids` that is still showing (one contextual tip at a time), or null. */
export function nextTip(ids: readonly TipId[], dismissed: readonly TipId[] | null): Tip | null {
  if (dismissed === null) return null;
  const id = ids.find((x) => isTipId(x) && !dismissed.includes(x));
  return id ? getTip(id) : null;
}

export function isDismissed(dismissed: readonly TipId[] | null, id: TipId): boolean {
  return dismissed !== null && dismissed.includes(id);
}

export function dismiss(dismissed: readonly TipId[], id: TipId): TipId[] {
  return dismissed.includes(id) ? [...dismissed] : [...dismissed, id];
}

/** Dismiss several at once ("Got it, hide tips" on the first-run cards), keeping everything else. */
export function dismissMany(dismissed: readonly TipId[], ids: readonly TipId[]): TipId[] {
  return ids.reduce<TipId[]>((acc, id) => dismiss(acc, id), [...dismissed]);
}

export function restoreOne(dismissed: readonly TipId[], id: TipId): TipId[] {
  return dismissed.filter((x) => x !== id);
}

export function restoreAll(_dismissed: readonly TipId[]): TipId[] {
  return [];
}

/** Reads the stored v1 JSON. Broken data → nothing dismissed; unknown ids dropped; duplicates removed. */
export function parseTips(raw: string | null | undefined): TipId[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    const list =
      v && typeof v === 'object' && Array.isArray((v as { dismissed?: unknown }).dismissed)
        ? (v as { dismissed: unknown[] }).dismissed
        : [];
    const out: TipId[] = [];
    for (const x of list) if (isTipId(x) && !out.includes(x)) out.push(x);
    return out;
  } catch {
    return [];
  }
}

export function serializeTips(dismissed: readonly TipId[]): string {
  return JSON.stringify({ dismissed: parseTips(JSON.stringify({ dismissed })) });
}

/** Where each tip appears, for the Tips library ("Shows on …"). */
export const PLACEMENT_LABELS: Readonly<Record<TipPlacement, string>> = Object.freeze({
  'first-run': 'Themes tab',
  themes: 'Theme preview',
  wallpaper: 'Wallpaper maker',
  icons: 'Icons tab',
  install: 'Install icons',
  live: 'Live Photo maker',
  shapes: 'Icon shape settings',
  override: 'Icons tab',
  'add-app': 'Icons tab',
});

export type TipGroup ={ key: string; title: string; tips: Tip[] };

const GROUPS: readonly { key: string; title: string; placements: readonly TipPlacement[] }[] = [
  { key: 'start', title: 'Getting started', placements: ['first-run'] },
  { key: 'themes', title: 'Themes', placements: ['themes'] },
  { key: 'wallpaper', title: 'Photos and wallpapers', placements: ['wallpaper'] },
  { key: 'icons', title: 'Icons, shapes and overrides', placements: ['icons', 'shapes', 'override', 'add-app'] },
  { key: 'install', title: 'Installing icons', placements: ['install'] },
  { key: 'live', title: 'Live Photos', placements: ['live'] },
];

/** Every tip, grouped by feature for the Tips library. Each tip appears exactly once. */
export function tipGroups(): TipGroup[] {
  return GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    tips: TIPS.filter((t) => g.placements.includes(t.placement)).sort((a, b) => a.order - b.order),
  })).filter((g) => g.tips.length > 0);
}

/** Library summary: how many tips are hidden. */
export function hiddenCount(dismissed: readonly TipId[] | null): number {
  return dismissed === null ? 0 : TIP_IDS.filter((id) => dismissed.includes(id)).length;
}
