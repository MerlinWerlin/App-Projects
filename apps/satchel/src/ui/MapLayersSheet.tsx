// T117 Map layers + legend: the Layers button under the map and its sheet. One row per pin family the map draws
// (a switch with its count, and the colour + icon its pins use, so the list is also the legend), the other pins'
// colours, "Show all trips" / "Only this trip", and "Fit to visible pins". Choices are kept on this phone by
// src/ui/useMapLayers.ts. T13: a "Kinds of place" section with a switch per place category (the same choice as the
// chips above Nearby, kept on this phone, every kind on at first open) and the OSM / ODbL line. The sheet slides (or fades with Reduce Motion): timed, never a spring.
// T157: each kind-of-place row now leads with the same swatch as the layer rows (its pin colour and glyph, from
// src/core/poipins.ts); the Lifts row uses its own original drawing (LiftGlyph, src/ui/stepfreeIcons.tsx).
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hiddenCount, isShown, LAYER_SPECS, MAP_LAYERS, type LayerCounts, type LayerPrefs, type MapLayerId, type MapScope } from '../core/maplayers.ts';
import type { OfferedCategory } from '../core/packpois.ts';
import { poiPinStyle } from '../core/poipins.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { Body, Button, Chip, Label, PressableScale } from './kit.tsx';
import { LiftGlyph } from './stepfreeIcons.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

const layerKey = (id: MapLayerId): Key => `maplayers.layer.${id}`;
const descKey = (id: MapLayerId): Key => `maplayers.layer.${id}.desc`;

/** The Layers button under the map; says how many layers are off. */
export function MapLayersButton({ prefs, onPress }: { prefs: LayerPrefs; onPress: () => void }) {
  const { t } = useApp();
  const off = hiddenCount(prefs);
  return (
    <Button
      kind="secondary"
      icon="layers-outline"
      label={off ? t('maplayers.openHidden', { n: off }) : t('maplayers.open')}
      hint={t('maplayers.openHint')}
      onPress={onPress}
    />
  );
}

/** A disc in the pins' colour with the family's icon, as on the legend. Decorative (the row's label says it all). */
function Swatch({ colour, icon, lift }: { colour: string; icon?: IconName; lift?: boolean }) {
  const { theme } = useApp();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }}
    >
      {lift ? <LiftGlyph size={18} color={theme.card} /> : icon ? <Ionicons name={icon} size={16} color={theme.card} /> : null}
    </View>
  );
}

export function MapLayersSheet({
  open,
  onClose,
  prefs,
  counts,
  colour,
  onToggle,
  onShowAll,
  scope,
  scopeTripName,
  onScope,
  canFit,
  onFit,
  places,
}: {
  open: boolean;
  onClose: () => void;
  prefs: LayerPrefs;
  counts: LayerCounts;
  colour: (id: MapLayerId) => string;
  onToggle: (id: MapLayerId) => void;
  onShowAll: () => void;
  /** What the map shows now. */
  scope: MapScope;
  /** The trip "Only this trip" means (the scoped one, else the one on now or next); null: no trip to offer. */
  scopeTripName: string | null;
  onScope: (scope: MapScope) => void;
  canFit: boolean;
  onFit: () => void;
  /** T13: per-category place toggles (src/core/packpois.ts); the attribution shows when downloaded places are in use. */
  places?: {
    categories: readonly OfferedCategory[];
    on: Readonly<Record<OfferedCategory, boolean>>;
    counts: Readonly<Record<OfferedCategory, number>>;
    label: (id: OfferedCategory) => string;
    onToggle: (id: OfferedCategory) => void;
    onShowAll: () => void;
    attribution: string | null;
  };
}) {
  const { t, theme, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const countText = (n: number) => (n === 0 ? t('maplayers.countNone') : n === 1 ? t('maplayers.countOne') : t('maplayers.count', { n }));

  return (
    <Modal visible={open} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('maplayers.done')}
          accessibilityHint={t('maplayers.scrimHint')}
          onPress={onClose}
          style={{ flex: 1, minHeight: 48, backgroundColor: theme.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{ maxHeight: '88%', backgroundColor: theme.card, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, borderWidth: 1, borderColor: theme.line }}
        >
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: insets.bottom + space.l, gap: space.m }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
              {t('maplayers.title')}
            </Text>
            <Body muted>{t('maplayers.body')}</Body>

            <Label>{t('maplayers.scope.label')}</Label>
            {scopeTripName ? (
              <View accessibilityRole="radiogroup" accessibilityLabel={t('maplayers.scope.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                <Chip label={t('maplayers.scope.all')} hint={t('maplayers.scope.allHint')} selected={scope === 'all'} onPress={() => onScope('all')} />
                <Chip
                  label={t('maplayers.scope.trip')}
                  a11yLabel={t('maplayers.scope.tripNamed', { trip: scopeTripName })}
                  hint={t('maplayers.scope.tripHint')}
                  selected={scope === 'trip'}
                  onPress={() => onScope('trip')}
                />
              </View>
            ) : (
              <Body muted>{t('maplayers.scope.none')}</Body>
            )}
            {scope === 'trip' && scopeTripName ? <Body muted>{t('maplayers.scope.tripNamed', { trip: scopeTripName })}</Body> : null}

            <Label>{t('maplayers.layers')}</Label>
            {MAP_LAYERS.map((id) => {
              const spec = LAYER_SPECS[id];
              const on = isShown(prefs, id);
              const name = t(layerKey(id));
              const count = countText(counts[id]);
              const notes = [t(descKey(id)), spec.byDay ? t('maplayers.byDay') : null, spec.phone ? t('maplayers.phoneOnly') : null].filter(Boolean).join(' ');
              return (
                <PressableScale
                  key={id}
                  accessibilityRole="switch"
                  accessibilityLabel={t('maplayers.toggleA11y', { layer: name, count, state: t(on ? 'maplayers.shown' : 'maplayers.hidden') })}
                  accessibilityHint={`${t('maplayers.toggleHint')} ${notes}`}
                  accessibilityState={{ checked: on }}
                  onPress={() => onToggle(id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: theme.line }}
                >
                  <Swatch colour={on ? colour(id) : theme.muted} icon={spec.icon as IconName} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyStrong, { color: on ? theme.ink : theme.muted }]}>{name}</Text>
                    <Text style={[typeScale.small, { color: theme.muted }]}>{notes}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? theme.ok : theme.muted }}>{t(on ? 'common.on' : 'common.off')}</Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted, fontVariant: ['tabular-nums'] }}>{count}</Text>
                  </View>
                </PressableScale>
              );
            })}
            {hiddenCount(prefs) > 0 ? <Button kind="quiet" label={t('maplayers.showEvery')} hint={t('maplayers.showEveryHint')} onPress={onShowAll} /> : null}

            {places ? (
              <>
                <Label>{t('packpois.sheet.label')}</Label>
                <Body muted>{t('packpois.sheet.body')}</Body>
                {places.categories.map((id) => {
                  const on = places.on[id];
                  const name = places.label(id);
                  const count = countText(places.counts[id]);
                  const look = poiPinStyle(id);
                  return (
                    <PressableScale
                      key={id}
                      accessibilityRole="switch"
                      accessibilityLabel={t('packpois.sheet.toggleA11y', { label: name, count, state: t(on ? 'maplayers.shown' : 'maplayers.hidden') })}
                      accessibilityHint={t('map.toggleHint')}
                      accessibilityState={{ checked: on }}
                      onPress={() => places.onToggle(id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48, borderTopWidth: 1, borderTopColor: theme.line }}
                    >
                      <Swatch colour={on ? theme[look.tone] : theme.muted} icon={look.icon as IconName} lift={look.svg === 'lift'} />
                      <Text style={[typeScale.bodyStrong, { flex: 1, color: on ? theme.ink : theme.muted }]}>{name}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted, fontVariant: ['tabular-nums'] }}>{count}</Text>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? theme.ok : theme.muted, minWidth: 36, textAlign: 'right' }}>{t(on ? 'common.on' : 'common.off')}</Text>
                    </PressableScale>
                  );
                })}
                {places.categories.some((id) => !places.on[id]) ? (
                  <Button kind="quiet" label={t('packpois.sheet.showAll')} hint={t('packpois.sheet.showAllHint')} onPress={places.onShowAll} />
                ) : null}
                {places.attribution ? <Text style={[typeScale.small, { color: theme.muted }]}>{places.attribution}</Text> : null}
              </>
            ) : null}

            <Label>{t('maplayers.other')}</Label>
            {(
              [
                ['maplayers.other.me', theme.ok],
                ['maplayers.other.search', theme.accentStrong],
                ['maplayers.other.spot', theme.muted],
              ] as const
            ).map(([key, c]) => (
              <View key={key} accessible accessibilityLabel={t(key)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <Swatch colour={c} />
                <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t(key)}</Text>
              </View>
            ))}

            {canFit ? (
              <Button
                icon="scan-outline"
                label={t('maplayers.fit')}
                hint={t('maplayers.fitHint')}
                onPress={() => {
                  onFit();
                  onClose();
                }}
              />
            ) : (
              <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
                {t('maplayers.fitNone')}
              </Text>
            )}
            <Button kind="quiet" label={t('maplayers.done')} hint={t('maplayers.doneHint')} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
