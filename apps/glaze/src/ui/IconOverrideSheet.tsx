// Per-icon override sheet for one app IN ONE THEME ("Clash Royale in Floral"): the user's own
// image (uploaded or chosen from "My images"), label, glyph and colours, "Use in all themes",
// and "Restore theme artwork" (the image stays in My images for re-use).
// Every change is applied straight away through `update` (the studio store persists it).
// The override model and the image library are pure functions in src/core/studio.ts.

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { allGlyphNames } from '../core/glyphnames';
import {
  MIN_GLYPH_CONTRAST,
  previewMonogram,
  specContrast,
  wantsMonogram,
  type IconApp,
  type IconBackground,
  type IconOverride,
  type IconSpec,
} from '../core/iconspec';
import { MONOGRAM_GLYPH, cleanMonogramText, monogramText } from '../core/monogram';
import { matchesMonogramQuery } from '../core/monogramSearch';
import { glyphCountLine, showMonogramLetters } from '../core/glyphPicker';
import { PHOTO_ICON_SIZE } from '../core/install';
import {
  GLYPH_PALETTE,
  MAX_LABEL_LENGTH,
  STYLE_PALETTE,
  applyToAllThemes,
  backgroundBase,
  deleteImage,
  effectiveOverride,
  isCustomised,
  keepOnlyInTheme,
  libraryImages,
  makeBackground,
  overrideTargetKey,
  restoreThemeArtwork,
  setThemeOverride,
  usesAllThemes,
  type CustomImage,
  type StudioState,
} from '../core/studio';
import type { SupportStatus } from '../core/catalogue';
import { IconCanvas } from '../render/IconCanvas';
import { useT, type MessageKey, type TFunction } from '../i18n';
import { keepIconImage, removeUnusedIconImage } from '../store/studio';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { Swatches, type Swatch } from './Swatches';
import { SwitchInsetRow } from './SwitchInsetRow';
import { haptic } from './haptics';
import { noMirror, textStyleFor } from './i18nLayout';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The app being edited (null hides the sheet content). */
  app: IconApp | null;
  /** Its resolved spec in this theme (theme style + override), for the preview. */
  spec: IconSpec | null;
  /** Studio state and its updater (useStudio): overrides and the image library live here. */
  state: StudioState;
  update: (fn: (s: StudioState) => StudioState) => void;
  /** Theme key the edits apply to (a theme id, or NO_THEME_KEY for the user's own style). */
  themeKey: string;
  /** Shown in the title: "<App> in <themeName>". */
  themeName: string;
  /** Wallpaper colour offered as a background swatch. */
  wallpaperColour: string | null;
};

const GLYPH_LIMIT = 48;
const ALL_GLYPHS = allGlyphNames();

function prettyGlyph(name: string): string {
  return name.replace(/-/g, ' ');
}

// Catalogue category names, support labels and palette names are English data in src/core; these
// map them to catalogue keys (shared with app/(tabs)/icons.tsx and app/add-app.tsx).
const CATEGORY_KEYS = {
  System: 'icons.categories.system',
  Social: 'icons.categories.social',
  Messaging: 'icons.categories.messaging',
  'Music & Audio': 'icons.categories.music',
  'Video & TV': 'icons.categories.video',
  'Photo & Design': 'icons.categories.photo',
  Productivity: 'icons.categories.productivity',
  Finance: 'icons.categories.finance',
  Shopping: 'icons.categories.shopping',
  'Food & Drink': 'icons.categories.food',
  'Travel & Transport': 'icons.categories.travel',
  'Health & Fitness': 'icons.categories.health',
  'News & Reading': 'icons.categories.news',
  Utilities: 'icons.categories.utilities',
  Education: 'icons.categories.education',
  Games: 'icons.categories.games',
  'My apps': 'icons.categories.myApps',
} as const satisfies Record<string, MessageKey>;

type CategoryKey = (typeof CATEGORY_KEYS)[keyof typeof CATEGORY_KEYS];

/** Translated name of a catalogue category id (or MY_APPS_CATEGORY); unknown ids pass through. */
export function categoryName(t: TFunction, category: string): string {
  const key = (CATEGORY_KEYS as Record<string, CategoryKey | undefined>)[category];
  return key ? t(key) : category;
}

const SUPPORT_KEYS = {
  verified: 'icons.support.verified',
  unverified: 'icons.support.unverified',
  shortcuts: 'icons.support.shortcuts',
} as const satisfies Record<SupportStatus, MessageKey>;

/** Translated install-support label (replaces SUPPORT_LABELS in the UI). */
export function supportLabel(t: TFunction, status: SupportStatus): string {
  return t(SUPPORT_KEYS[status]);
}

const COLOUR_KEYS = {
  Plum: 'icons.colours.plum',
  Terracotta: 'icons.colours.terracotta',
  Clay: 'icons.colours.clay',
  Honey: 'icons.colours.honey',
  Sage: 'icons.colours.sage',
  Forest: 'icons.colours.forest',
  Teal: 'icons.colours.teal',
  Ocean: 'icons.colours.ocean',
  Lilac: 'icons.colours.lilac',
  Blush: 'icons.colours.blush',
  Porcelain: 'icons.colours.porcelain',
  Ink: 'icons.colours.ink',
  White: 'icons.colours.white',
} as const satisfies Record<string, MessageKey>;

type ColourKey = (typeof COLOUR_KEYS)[keyof typeof COLOUR_KEYS];

/** Translated spoken name of a STYLE_PALETTE / GLYPH_PALETTE colour. */
export function colourName(t: TFunction, name: string): string {
  const key = (COLOUR_KEYS as Record<string, ColourKey | undefined>)[name];
  return key ? t(key) : name;
}

/** Translated reason addCustomApp rejected the form (no name, or a malformed URL scheme). */
export function customAppError(t: TFunction, name: string): string {
  if (!name.trim()) return t('icons.errors.noName');
  return t('icons.errors.badScheme', { example: 'appname://' }); // i18n-ignore
}

export function IconOverrideSheet({
  visible,
  onClose,
  app,
  spec,
  state,
  update,
  themeKey,
  themeName,
  wallpaperColour,
}: Props) {
  // Design v2 (T56): system type roles, v2 palette, pill buttons, fields as pills on `fill`.
  const { c } = useColorsV2();
  const { t, script, formatDate } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const tt = {
    heading: ts('headline'),
    label: ts('headline'),
    body: ts('body'),
    small: ts('footnote'),
  };
  const [label, setLabel] = useState('');
  const [letters, setLetters] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const override = app ? effectiveOverride(state, themeKey, app.id) : undefined;

  // Fresh fields each time the sheet opens for an app.
  const openId = app?.id ?? null;
  useEffect(() => {
    if (!visible) return;
    setLabel(override?.label ?? '');
    setLetters(override?.monogramText ?? '');
    setQuery('');
    setDenied(false);
    setError(null);
    setShowLibrary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, openId, themeKey]);

  const glyphs = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    return q ? ALL_GLYPHS.filter((g) => g.includes(q)) : ALL_GLYPHS;
  }, [query]);
  // T87: the Monogram cell follows the search too (English words plus this language's own).
  const monogramTerms: readonly string[] = [t('iconsUi.monogram'), t('iconsUi.monogramLetters')];
  const showMonogram = matchesMonogramQuery(query, monogramTerms);

  if (!app || !spec) {
    return <Sheet visible={visible} onClose={onClose} title={t('iconsUi.editIcon')} />;
  }

  const appId = app.id;
  const o: IconOverride = override ?? {};
  const customised = isCustomised(state, themeKey, appId);
  const allThemes = usesAllThemes(state, themeKey, appId);
  const images = libraryImages(state);
  // Edits go to the override the app shows here (this theme's own, or the "all themes" one).
  const patch = (p: Partial<IconOverride>) =>
    update((s) => {
      const cur = effectiveOverride(s, themeKey, appId) ?? {};
      return setThemeOverride(s, overrideTargetKey(s, themeKey, appId), appId, { ...cur, ...p });
    });
  const contrast = spec.overrideImage ? null : specContrast(spec);
  const lowContrast = contrast !== null && contrast < MIN_GLYPH_CONTRAST;

  const bgSwatches: Swatch[] = [
    ...(wallpaperColour ? [{ hex: wallpaperColour, name: t('icons.fromWallpaper'), icon: 'image' as const }] : []),
    ...STYLE_PALETTE.map((p) => ({ hex: p.hex, name: colourName(t, p.name) })),
  ];
  const glyphSwatches: Swatch[] = GLYPH_PALETTE.map((p) => ({ hex: p.hex, name: colourName(t, p.name) }));
  const where = { app: app.name, theme: themeName };
  const imageName = (img: CustomImage, i: number): string =>
    img.label
      ? t('iconsUi.imageNameLabelled', { number: i + 1, label: img.label })
      : t('iconsUi.imageName', { number: i + 1 });
  // Spoken name plus the date it was added, when known.
  const imageA11y = (img: CustomImage, name: string): string => {
    if (!img.addedAt) return name;
    try {
      return t('iconsUi.imageAdded', { name, date: formatDate(new Date(img.addedAt)) });
    } catch {
      return name;
    }
  };
  const miniBg: IconBackground = { kind: 'solid', colour: c.tintSoft };
  // T82: "Monogram" sits with the glyphs: letters from the name, or the user's own 1–2.
  const monogramOn = wantsMonogram(spec.glyph);
  // T90: the letters field hides while the search filters the selected Monogram cell out, and the
  // count line says "1 match" when the Monogram cell is the only result.
  const lettersShown = showMonogramLetters({ monogramOn, hasOverrideImage: !!o.overrideImage, monogramShown: showMonogram });
  const countLine = glyphCountLine({ glyphCount: glyphs.length, monogramShown: showMonogram, limit: GLYPH_LIMIT });
  const derivedLetters = monogramText(spec.label);
  const miniMonogram = previewMonogram(
    spec.label,
    MONOGRAM_GLYPH,
    { background: miniBg, glyphColour: c.tint, glyphScale: 0.6 },
    o.monogramText,
  );
  const shownLetters = miniMonogram?.text ?? '';

  // Upload: picker -> copy into the app's documents folder -> My images -> this app in this theme.
  const pickPhoto = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const perm = Platform.OS === 'android' ? null : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm && !perm.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const kept = await keepIconImage(res.assets[0].uri, appId);
      patch({ overrideImage: kept });
      haptic('success');
    } catch {
      setError(t('iconsUi.openError'));
    } finally {
      setBusy(false);
    }
  };

  // Stops using the image on this icon; it stays in My images.
  const removePhoto = () => {
    haptic('select');
    patch({ overrideImage: undefined });
  };

  const chooseImage = (img: CustomImage) => {
    haptic('select');
    patch({ overrideImage: img.uri });
  };

  // Explicit delete from My images: also clears it from every icon that uses it (all themes).
  // The store deletes the file only if nothing references it any more.
  const confirmDelete = (img: CustomImage) => {
    Alert.alert(
      t('iconsUi.deleteTitle'),
      t('iconsUi.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            haptic('warning');
            update((s) => deleteImage(s, img.id).state);
            removeUnusedIconImage(img.uri, deleteImage(state, img.id).state);
          },
        },
      ],
    );
  };

  const toggleAllThemes = (on: boolean) => {
    haptic('select');
    update((s) =>
      on ? applyToAllThemes(s, appId, effectiveOverride(s, themeKey, appId) ?? null) : keepOnlyInTheme(s, themeKey, appId),
    );
  };

  const restore = () => {
    haptic('warning');
    setLabel('');
    setLetters('');
    update((s) => restoreThemeArtwork(s, themeKey, appId));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('iconsUi.title', where)}>
      <View style={styles.previewWrap}>
        <IconCanvas
          spec={spec}
          size={112}
          backdrop={wallpaperColour ?? undefined}
          style={noMirror}
          accessibilityLabel={t(customised ? 'iconsUi.previewLabelCustomised' : 'iconsUi.previewLabel', {
            name: spec.label,
            theme: themeName,
          })}
        />
        <Text style={[...tt.label, { color: c.ink }]} numberOfLines={1}>
          {spec.label}
        </Text>
        <Text style={[...tt.small, { color: c.inkSecondary, textAlign: 'center' }]}>
          {customised
            ? allThemes
              ? t('iconsUi.statusAllThemes')
              : t('iconsUi.statusThemeOnly', { theme: themeName })
            : t('iconsUi.statusArtwork', where)}
        </Text>
        {lowContrast ? (
          <View style={styles.warnRow} accessibilityRole="alert">
            <Feather name="alert-triangle" size={16} color={c.warn} />
            <Text style={[...tt.small, { color: c.warn, flex: 1 }]}>
              {t('iconsUi.lowContrast')}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[...tt.heading, { color: c.ink }]} accessibilityRole="header">
        {t('iconsUi.yourImage')}
      </Text>
      <Text style={[...tt.small, { color: c.inkSecondary }]}>
        {t('iconsUi.yourImageBody', { size: PHOTO_ICON_SIZE })}
      </Text>
      <View style={styles.btnRow}>
        <PillButton
          label={busy ? t('iconsUi.opening') : t('iconsUi.upload')}
          icon="upload"
          variant="tinted"
          size="small"
          onPress={() => void pickPhoto()}
          busy={busy}
          accessibilityHint={t('iconsUi.uploadHint', where)}
          style={styles.flex}
        />
        <PillButton
          label={
            showLibrary
              ? t('iconsUi.hideImages')
              : images.length
                ? t('iconsUi.chooseImagesCount', { count: images.length })
                : t('iconsUi.chooseImages')
          }
          icon="grid"
          variant="tinted"
          size="small"
          onPress={() => {
            haptic('select');
            setShowLibrary((v) => !v);
          }}
          accessibilityHint={t('iconsUi.chooseImagesHint')}
          style={styles.flex}
        />
      </View>
      {showLibrary ? (
        images.length === 0 ? (
          <View style={styles.libEmpty}>
            <Feather name="image" size={24} color={c.tint} />
            <Text style={[...tt.label, { color: c.ink }]}>{t('iconsUi.noImages')}</Text>
            <Text style={[...tt.small, { color: c.inkSecondary, textAlign: 'center' }]}>
              {t('iconsUi.noImagesBody')}
            </Text>
          </View>
        ) : (
          <View style={styles.libGrid} accessibilityLabel={t('iconsUi.myImages')}>
            {images.map((img, i) => {
              const inUse = o.overrideImage === img.uri;
              const name = imageName(img, i);
              return (
                <View key={img.id} style={styles.libCellWrap}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={imageA11y(img, name)}
                    accessibilityHint={t('iconsUi.useImageHint', where)}
                    accessibilityState={{ selected: inUse, checked: inUse }}
                    onPress={() => chooseImage(img)}
                    style={({ pressed }) => [
                      styles.libCell,
                      { borderColor: inUse ? c.tint : c.separator, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Image source={{ uri: img.uri }} style={styles.libImage} resizeMode="cover" />
                  </Pressable>
                  <PressableScale
                    haptic="select"
                    pressedScale={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={t('iconsUi.deleteImageLabel', { name })}
                    onPress={() => confirmDelete(img)}
                    style={styles.iconBtn}
                  >
                    <Feather name="trash-2" size={18} color={c.inkSecondary} />
                  </PressableScale>
                </View>
              );
            })}
          </View>
        )
      ) : null}
      {o.overrideImage ? (
        <PillButton
          label={t('iconsUi.stopUsing')}
          icon="x"
          variant="plain"
          size="small"
          onPress={removePhoto}
          accessibilityHint={t('iconsUi.stopUsingHint')}
        />
      ) : null}
      {denied ? (
        <View style={[styles.notice, continuous, { backgroundColor: c.tintSoft }]}>
          <Text style={[...tt.body, { color: c.onTintSoft }]}>
            {t('iconsUi.photosDenied')}
          </Text>
          <Text style={[...tt.small, { color: c.onTintSoft }]}>{t('iconsUi.photosDeniedSteps')}</Text>
          <PillButton
            label={t('iconsUi.openSettings')}
            icon="settings"
            size="small"
            onPress={() => {
              Linking.openSettings().catch(() => {});
            }}
          />
        </View>
      ) : null}
      {error ? (
        <Text style={[...tt.small, { color: c.warn }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Text style={[...tt.heading, { color: c.ink }]} accessibilityRole="header">
        {t('iconsUi.label')}
      </Text>
      <TextInput
        value={label}
        onChangeText={(v) => {
          setLabel(v);
          patch({ label: v.trim() ? v : undefined });
        }}
        placeholder={app.name}
        placeholderTextColor={c.inkSecondary}
        maxLength={MAX_LABEL_LENGTH}
        accessibilityLabel={t('iconsUi.labelA11y')}
        accessibilityHint={t('iconsUi.labelHint', { app: app.name })}
        returnKeyType="done"
        style={[styles.input, ...tt.body, { color: c.ink, borderColor: c.separator, backgroundColor: c.fill }]}
      />

      <Text style={[...tt.heading, { color: c.ink }]} accessibilityRole="header">
        {t('iconsUi.symbol')}
      </Text>
      {o.overrideImage ? (
        <Text style={[...tt.small, { color: c.inkSecondary }]}>
          {t('iconsUi.symbolImageNote')}
        </Text>
      ) : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('iconsUi.searchSymbols')}
        placeholderTextColor={c.inkSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t('iconsUi.searchSymbolsLabel')}
        returnKeyType="search"
        style={[styles.input, ...tt.body, { color: c.ink, borderColor: c.separator, backgroundColor: c.fill }]}
      />
      <View style={styles.glyphGrid}>
        {o.glyph ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('iconsUi.defaultSymbol', { app: app.name })}
            onPress={() => {
              haptic('select');
              patch({ glyph: undefined });
            }}
            style={({ pressed }) => [styles.glyphCell, { borderColor: c.separator, opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="rotate-ccw" size={20} color={c.inkSecondary} />
          </Pressable>
        ) : null}
        {showMonogram ? (
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={shownLetters ? t('iconsUi.monogramOption', { letters: shownLetters }) : t('iconsUi.monogram')}
            accessibilityState={{ selected: monogramOn, checked: monogramOn }}
            onPress={() => {
              haptic('select');
              patch({ glyph: MONOGRAM_GLYPH });
            }}
            style={({ pressed }) => [
              styles.glyphCell,
              { borderColor: monogramOn ? c.tint : 'transparent', opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {miniMonogram ? (
              <IconCanvas
                spec={{
                  shape: 'rounded',
                  background: miniBg,
                  glyph: MONOGRAM_GLYPH,
                  glyphColour: c.tint,
                  glyphScale: 0.6,
                  monogram: miniMonogram,
                }}
                size={40}
                style={noMirror}
              />
            ) : (
              <Feather name="type" size={20} color={c.tint} />
            )}
          </Pressable>
        ) : null}
        {glyphs.slice(0, GLYPH_LIMIT).map((g) => {
          const selected = spec.glyph === g;
          return (
            <Pressable
              key={g}
              accessibilityRole="radio"
              accessibilityLabel={t('iconsUi.symbolOption', { name: prettyGlyph(g) })}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => {
                haptic('select');
                patch({ glyph: g });
              }}
              style={({ pressed }) => [
                styles.glyphCell,
                { borderColor: selected ? c.tint : 'transparent', opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <IconCanvas
                spec={{ shape: 'rounded', background: miniBg, glyph: g, glyphColour: c.tint, glyphScale: 0.6 }}
                size={40}
                style={noMirror}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[...tt.small, { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
        {countLine.kind === 'none'
          ? t('iconsUi.noSymbols')
          : countLine.kind === 'matches'
            ? t('iconsUi.matchCount', { count: countLine.count })
            : countLine.kind === 'showing'
              ? t('iconsUi.showingSymbols', { shown: countLine.shown, total: countLine.total })
              : t('iconsUi.symbolCount', { count: countLine.count })}
      </Text>
      {lettersShown ? (
        <>
          <Text style={[...tt.label, { color: c.ink }]}>{t('iconsUi.monogramLetters')}</Text>
          <TextInput
            value={letters}
            onChangeText={(v) => {
              const clean = cleanMonogramText(v);
              setLetters(clean);
              patch({ monogramText: clean || undefined });
            }}
            placeholder={derivedLetters}
            placeholderTextColor={c.inkSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            accessibilityLabel={t('iconsUi.monogramLetters')}
            accessibilityHint={
              derivedLetters
                ? t('iconsUi.monogramLettersHint', { letters: derivedLetters, app: spec.label })
                : t('iconsUi.monogramLettersHintNone')
            }
            selectTextOnFocus
            returnKeyType="done"
            style={[styles.input, ...tt.body, { color: c.ink, borderColor: c.separator, backgroundColor: c.fill }]}
          />
          <Text style={[...tt.small, { color: c.inkSecondary }]}>
            {derivedLetters
              ? t('iconsUi.monogramLettersHint', { letters: derivedLetters, app: spec.label })
              : t('iconsUi.monogramLettersHintNone')}
          </Text>
        </>
      ) : null}

      <Text style={[...tt.heading, { color: c.ink }]} accessibilityRole="header">
        {t('iconsUi.backgroundColour')}
      </Text>
      <Swatches
        label={t('iconsUi.backgroundSwatches')}
        swatches={bgSwatches}
        value={o.background ? backgroundBase(o.background) : null}
        onChange={(hex) => patch({ background: makeBackground(spec.background.kind, hex, spec.background) })}
      />

      <Text style={[...tt.heading, { color: c.ink }]} accessibilityRole="header">
        {t('iconsUi.symbolColour')}
      </Text>
      <Swatches
        label={t('iconsUi.symbolSwatches')}
        swatches={glyphSwatches}
        value={o.glyphColour ?? null}
        onChange={(hex) => patch({ glyphColour: hex })}
      />

      <View style={[styles.switchCard, continuous, { backgroundColor: c.surface }]}>
      <SwitchInsetRow
        label={t('iconsUi.allThemes')}
        value={allThemes}
        onChange={toggleAllThemes}
        disabled={!customised}
        accessibilityLabel={t('iconsUi.allThemesLabel', { app: app.name })}
        description={
          customised
            ? allThemes
              ? t('iconsUi.allThemesOn', { theme: themeName })
              : t('iconsUi.allThemesOff', where)
            : t('iconsUi.customiseFirst')
        }
      />
      </View>

      {customised ? (
        <PillButton
          label={t('iconsUi.restore')}
          icon="rotate-ccw"
          variant="tinted"
          block
          onPress={restore}
          accessibilityHint={
            allThemes
              ? t('iconsUi.restoreHintAll', { app: app.name })
              : t('iconsUi.restoreHintTheme', where)
          }
        />
      ) : null}
      <PillButton label={t('common.done')} onPress={onClose} block />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previewWrap: { alignItems: 'center', gap: spaceV2.sm, paddingVertical: spaceV2.sm },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  input: {
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm,
  },
  btnRow: { flexDirection: 'row', gap: spaceV2.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1 },
  notice: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.sm },
  libGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  libEmpty: { alignItems: 'center', gap: spaceV2.xs, paddingVertical: spaceV2.md },
  libCellWrap: { alignItems: 'center' },
  libCell: { width: 72, height: 72, borderRadius: radiusV2.control + 2, borderWidth: 2, overflow: 'hidden' },
  libImage: { width: '100%', height: '100%' },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  switchCard: { borderRadius: radiusV2.group, overflow: 'hidden' },
  glyphGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.xs },
  glyphCell: {
    width: sizeV2.touch + 4,
    height: sizeV2.touch + 4,
    borderRadius: radiusV2.control,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
