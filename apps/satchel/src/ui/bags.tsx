// T99 Bags on the packing screen: filter chips, the colourful bag header card, bag tips (general guidance), the
// Carry-on only switch and "Manage bags" (own bags, colours, cabin / hold, weight limits), and the bag picker and
// weight field in a row's edit card. Logic lives in src/core/bags.ts; strings in src/i18n/en/bags.ts.
import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View } from 'react-native';
import {
  addBag,
  bagHints,
  bagSummaries,
  bagsOf,
  CARRY_ID,
  editBag,
  formatWeight,
  isCabin,
  isCarryOnOnly,
  moveItems,
  NO_BAG,
  OWN_BAG_COLOUR,
  parseWeight,
  removeBag,
  setCarryOnOnly,
  sortIntoBags,
  weightInput,
  weightUnit,
  type Bag,
  type BagFilter,
  type BagHint,
  type QtyOf,
  type Tally,
  type WeightUnit,
} from '../core/bags.ts';
import { withGiftWeight, type GiftBagLoad } from '../core/gifts.ts';
import { CARD_COLOURS, type CardColour } from '../core/loyalty.ts';
import { newId } from '../core/model.ts';
import type { PackItem, PackList } from '../core/packing.ts';
import { HOME_COUNTRY_KEY } from '../core/settings.ts';
import { defaultSystem } from '../core/units.ts';
import { DEFAULT_TEMP_UNIT, TEMP_UNIT_KEY } from '../core/weather.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { cardPaint, fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView } from './hero.tsx';
import { Body, Button, Card, Chip, Label, PressableScale, TextField, ToggleRow } from './kit.tsx';

type Update = (fn: (l: PackList) => PackList) => void;

const NO_HOME: unknown = null;
const NO_TEMP: unknown = DEFAULT_TEMP_UNIT;

/** kg or lb from the home units (Settings home country, else the weather unit), as on the Units screen. */
export function useWeightUnit(): WeightUnit {
  const [rawHome] = usePersisted<unknown>(HOME_COUNTRY_KEY, NO_HOME);
  const [rawTemp] = usePersisted<unknown>(TEMP_UNIT_KEY, NO_TEMP);
  return weightUnit(defaultSystem(typeof rawHome === 'string' ? rawHome : null, typeof rawTemp === 'string' ? rawTemp : null));
}

const NAME_KEY: Record<string, Key> = { carry: 'bags.name.carry', personal: 'bags.name.personal', checked: 'bags.name.checked' };
export const bagName = (t: T, bag: Bag) => (bag.kind === 'own' ? bag.name ?? '' : t(NAME_KEY[bag.kind]));
const whereText = (t: T, bag: Bag) => t(isCabin(bag) ? 'bags.where.cabin' : 'bags.where.hold');
const unitText = (t: T, unit: WeightUnit) => t(unit === 'lb' ? 'bags.unit.lb' : 'bags.unit.kg');
const colourName = (t: T, c: CardColour) => t(`bags.colour.${c}` as Key);
const BAG_ICON = { carry: 'briefcase', personal: 'bag-handle', checked: 'cube', own: 'bag' } as const;
const thingsText = (t: T, n: number) => (n === 1 ? t('bags.header.thingsOne') : t('bags.header.things', { count: n }));

/** "Socks, Shoes and 3 more" for the hint text. */
function itemsText(t: T, list: PackList, ids: string[]): string {
  const labels = ids.map((id) => list.items.find((i) => i.id === id)?.label).filter((x): x is string => !!x);
  if (labels.length <= 3) return labels.join(', ');
  return t('bags.hint.more', { first: labels.slice(0, 2).join(', '), count: labels.length - 2 });
}

function weightLine(t: T, tally: Tally, unit: WeightUnit, lang: string): string {
  const u = unitText(t, unit);
  if (tally.limitG !== undefined) return t('bags.weight.ofLimit', { weight: formatWeight(tally.weightG, unit, lang), limit: formatWeight(tally.limitG, unit, lang), unit: u });
  if (!tally.weighed) return t('bags.weight.none');
  return t('bags.weight.total', { weight: formatWeight(tally.weightG, unit, lang), unit: u });
}

// ---------------------------------------------------------------- filter chips

export function BagFilterChips({ list, filter, onFilter, qtyOf }: { list: PackList; filter: BagFilter; onFilter: (f: BagFilter) => void; qtyOf: QtyOf }) {
  const { t, theme } = useApp();
  const s = bagSummaries(list, qtyOf);
  const chips: { id: BagFilter; label: string; count: number; colour?: CardColour }[] = [
    { id: 'all', label: t('bags.filter.all'), count: s.all.rows },
    ...s.bags.map(({ bag, tally }) => ({ id: bag.id, label: bagName(t, bag), count: tally.rows, colour: bag.colour })),
    ...(s.none ? [{ id: NO_BAG, label: t('bags.filter.none'), count: s.none.rows }] : []),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('bags.filter.group')}
      contentContainerStyle={{ gap: space.s, paddingVertical: space.xs }}
    >
      {chips.map((c) => (
        <Chip
          key={c.id}
          label={`${c.label} · ${c.count}`}
          a11yLabel={t('bags.filter.chipA11y', { name: c.label, count: c.count })}
          hint={t('bags.filter.hint')}
          selected={filter === c.id}
          onPress={() => onFilter(c.id)}
          icon={c.colour ? <View style={{ width: 12, height: 12, borderRadius: radius.pill, backgroundColor: cardPaint(theme, c.colour).fill }} /> : undefined}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- header card

/** Thin bar on a painted card (timed width; no animation needed for a static value). */
function PaintBar({ value, track, fill, label }: { value: number; track: string; fill: string; label: string }) {
  const p = Math.min(1, Math.max(0, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ height: 8, width: `${Math.round(p * 100)}%`, borderRadius: 4, backgroundColor: fill }} />
    </View>
  );
}

/** One bag, painted in its colour: name, cabin / hold, packed progress, things and the weight tally. */
const BagCard = memo(function BagCard({ bag, tally, unit, lang, gifts }: { bag: Bag; tally: Tally; unit: WeightUnit; lang: string; gifts?: GiftBagLoad }) {
  const { t, theme } = useApp();
  const paint = cardPaint(theme, bag.colour);
  const name = bagName(t, bag);
  const u = unitText(t, unit);
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: paint.fill, padding: space.l, gap: space.s, overflow: 'hidden' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: paint.wash }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: paint.wash, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={BAG_ICON[bag.kind]} size={26} color={paint.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.caption, { color: paint.muted }]}>{whereText(t, bag)}</Text>
          <Text accessibilityRole="header" numberOfLines={2} style={[typeScale.displayM, { color: paint.ink }]}>
            {name}
          </Text>
        </View>
      </View>
      {tally.rows === 0 ? (
        <Text style={[typeScale.body, { color: paint.ink }]}>{t('bags.header.empty')}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typeScale.bodyStrong, { color: paint.ink, fontVariant: ['tabular-nums'] }]}>{t('bags.header.packed', { done: tally.done, total: tally.rows })}</Text>
            <Text style={[typeScale.small, { color: paint.muted, fontVariant: ['tabular-nums'] }]}>{thingsText(t, tally.things)}</Text>
          </View>
          <PaintBar value={tally.done / Math.max(1, tally.rows)} track={paint.wash} fill={paint.ink} label={t('bags.header.progressA11y', { name, done: tally.done, total: tally.rows })} />
        </>
      )}
      <Text style={[typeScale.bodyStrong, { color: paint.ink, fontVariant: ['tabular-nums'] }]}>{weightLine(t, tally, unit, lang)}</Text>
      {tally.limitG !== undefined ? (
        <PaintBar
          value={tally.weightG / tally.limitG}
          track={paint.wash}
          fill={paint.ink}
          label={t('bags.weight.barA11y', { weight: formatWeight(tally.weightG, unit, lang), limit: formatWeight(tally.limitG, unit, lang), unit: u })}
        />
      ) : null}
      {tally.overG > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Ionicons name="alert-circle" size={18} color={paint.ink} />
          <Text style={[typeScale.bodyStrong, { color: paint.ink }]}>{t('bags.weight.over', { weight: formatWeight(tally.overG, unit, lang), unit: u })}</Text>
        </View>
      ) : tally.limitG !== undefined ? (
        <Text style={[typeScale.small, { color: paint.muted }]}>{t('bags.weight.left', { weight: formatWeight(tally.leftG, unit, lang), unit: u })}</Text>
      ) : null}
      {/* T107: packed gifts in this bag (their weight is in the tally above). */}
      {gifts && gifts.gifts > 0 ? (
        <Text style={[typeScale.small, { color: paint.muted }]}>
          {gifts.gifts === 1
            ? t('gifts.bag.includesOne', { weight: formatWeight(gifts.grams, unit, lang), unit: u })
            : t('gifts.bag.includes', { count: gifts.gifts, weight: formatWeight(gifts.grams, unit, lang), unit: u })}
        </Text>
      ) : null}
      {tally.weighed > 0 && tally.unweighed > 0 ? (
        <Text style={[typeScale.small, { color: paint.muted }]}>
          {tally.unweighed === 1 ? t('bags.weight.missingOne') : t('bags.weight.missing', { count: tally.unweighed })}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * The header card. One bag chosen: that bag painted big. Everything: a tile per bag (tap to show only that bag).
 * Rows with no bag: how many, with "Sort into bags".
 */
export function BagHeaderCard({
  list,
  filter,
  onFilter,
  update,
  qtyOf,
  gifts,
}: {
  list: PackList;
  filter: BagFilter;
  onFilter: (f: BagFilter) => void;
  update: Update;
  qtyOf: QtyOf;
  /** T107: packed gifts per bag (src/core/gifts.ts giftWeightsByBag); their weight is added to each bag's tally. */
  gifts?: Record<string, GiftBagLoad>;
}) {
  const { t, theme, lang } = useApp();
  const unit = useWeightUnit();
  const base = bagSummaries(list, qtyOf);
  const s = { ...base, bags: base.bags.map(({ bag, tally }) => ({ bag, tally: withGiftWeight(tally, gifts?.[bag.id]?.grams ?? 0) })) };
  const sort = () => {
    const { sorted } = sortIntoBags(list);
    update((l) => sortIntoBags(l).list);
    if (sorted) haptic.success();
    AccessibilityInfo.announceForAccessibility(sorted ? t('bags.sortDone', { count: sorted }) : t('bags.sortNone'));
  };
  const one = s.bags.find((b) => b.bag.id === filter);
  if (one) {
    return (
      <FadeInView>
        <BagCard bag={one.bag} tally={one.tally} unit={unit} lang={lang} gifts={gifts?.[one.bag.id]} />
      </FadeInView>
    );
  }
  if (filter === NO_BAG) {
    return (
      <Card style={{ gap: space.s }}>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('bags.header.noBagTitle')}
        </Text>
        <Body muted>{s.none ? t('bags.header.noBagBody', { count: s.none.rows }) : t('bags.header.allSorted')}</Body>
        {s.none ? <Button label={t('bags.sort')} hint={t('bags.sortHint')} icon="file-tray-stacked-outline" onPress={sort} /> : null}
      </Card>
    );
  }
  return (
    <Card style={{ gap: space.m }}>
      <View>
        <Label>{t('bags.header.eyebrow')}</Label>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('bags.header.allTitle')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {s.bags.map(({ bag, tally }) => {
          const paint = cardPaint(theme, bag.colour);
          const name = bagName(t, bag);
          return (
            <PressableScale
              key={bag.id}
              accessibilityRole="button"
              accessibilityLabel={t('bags.header.tileA11y', { name, where: whereText(t, bag), done: tally.done, total: tally.rows })}
              accessibilityHint={t('bags.header.tileHint')}
              onPress={() => onFilter(bag.id)}
              style={{ flexGrow: 1, flexBasis: '30%', minWidth: 96, minHeight: 88, borderRadius: radius.l, backgroundColor: paint.fill, padding: space.m, gap: space.xs }}
            >
              <Ionicons name={BAG_ICON[bag.kind]} size={20} color={paint.ink} />
              <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: paint.ink }]}>
                {name}
              </Text>
              <Text style={[typeScale.small, { color: paint.muted, fontVariant: ['tabular-nums'] }]}>
                {tally.rows ? t('bags.header.packed', { done: tally.done, total: tally.rows }) : t('bags.header.empty')}
              </Text>
              {tally.weighed ? (
                <Text style={[typeScale.small, { color: paint.muted, fontVariant: ['tabular-nums'] }]}>{weightLine(t, tally, unit, lang)}</Text>
              ) : null}
            </PressableScale>
          );
        })}
      </View>
      {s.none ? (
        <>
          <Body muted>{t('bags.header.noBagBody', { count: s.none.rows })}</Body>
          <Button label={t('bags.sort')} hint={t('bags.sortHint')} kind="secondary" icon="file-tray-stacked-outline" onPress={sort} />
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- tips (general guidance)

const HINT_ICON = { battery: 'battery-charging-outline', medicine: 'medkit-outline', liquids: 'water-outline', overLimit: 'barbell-outline' } as const;

export function BagHintsCard({ list, update, qtyOf }: { list: PackList; update: Update; qtyOf: QtyOf }) {
  const { t, theme, lang } = useApp();
  const unit = useWeightUnit();
  const hints = bagHints(list, qtyOf);
  if (!hints.length) return null;
  const text = (h: BagHint) => {
    if (h.kind === 'overLimit') {
      const bag = bagsOf(list).find((b) => b.id === h.bagId);
      return t('bags.hint.overLimit', { bag: bag ? bagName(t, bag) : '', weight: formatWeight(h.overG ?? 0, unit, lang), unit: unitText(t, unit) });
    }
    return t(`bags.hint.${h.kind}` as Key, { items: itemsText(t, list, h.itemIds) });
  };
  return (
    <Card style={{ gap: space.m }}>
      <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
        {t('bags.hint.title')}
      </Text>
      {hints.map((h) => (
        <View key={`${h.kind}:${h.bagId ?? ''}`} style={{ gap: space.s }}>
          <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
              <Ionicons name={HINT_ICON[h.kind]} size={22} color={theme.warn} />
            </View>
            <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{text(h)}</Text>
          </View>
          {h.kind === 'battery' || h.kind === 'medicine' ? (
            <Button
              kind="secondary"
              icon="briefcase-outline"
              label={t('bags.hint.moveToCarry')}
              hint={t('bags.hint.moveHint')}
              onPress={() => {
                update((l) => moveItems(l, h.itemIds, CARRY_ID));
                haptic.success();
                AccessibilityInfo.announceForAccessibility(t('bags.hint.moved'));
              }}
            />
          ) : null}
        </View>
      ))}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('bags.hint.verify')}</Text>
    </Card>
  );
}

// ---------------------------------------------------------------- Carry-on only + manage bags

export function BagSettingsCard({ list, update }: { list: PackList; update: Update }) {
  const { t } = useApp();
  const [managing, setManaging] = useState(false);
  const on = isCarryOnOnly(list);
  return (
    <Card style={{ gap: space.s }}>
      <ToggleRow
        label={t('bags.carryOnly')}
        hint={t('bags.carryOnlyHint')}
        value={on}
        onChange={(v) => {
          const hold = new Set(bagsOf(list).filter((b) => !isCabin(b)).map((b) => b.id));
          const moving = list.items.filter((i) => i.bag && hold.has(i.bag)).length;
          update((l) => setCarryOnOnly(l, v));
          AccessibilityInfo.announceForAccessibility(v ? t('bags.carryOnlyOnAnnounce', { count: moving }) : t('bags.carryOnlyOffAnnounce'));
        }}
      />
      <Body muted>{t(on ? 'bags.carryOnlyOn' : 'bags.carryOnlyOff')}</Body>
      {managing ? (
        <BagManager list={list} update={update} onClose={() => setManaging(false)} />
      ) : (
        <Button label={t('bags.manage')} hint={t('bags.manageHint')} kind="quiet" icon="color-palette-outline" onPress={() => setManaging(true)} />
      )}
    </Card>
  );
}

function ColourPicker({ value, onChange, name }: { value: CardColour; onChange: (c: CardColour) => void; name: string }) {
  const { t, theme } = useApp();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('bags.colourGroup', { name })} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {CARD_COLOURS.map((c) => {
        const selected = value === c;
        const paint = cardPaint(theme, c);
        return (
          <PressableScale
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={t('bags.colourA11y', { colour: colourName(t, c) })}
            accessibilityHint={t('bags.colourHint')}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(c)}
            style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: selected ? 3 : 1, borderColor: selected ? theme.ink : theme.line }}
          >
            <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: paint.fill, alignItems: 'center', justifyContent: 'center' }}>
              {selected ? <Ionicons name="checkmark" size={18} color={paint.ink} /> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function BagEditor({ bag, list, update }: { bag: Bag; list: PackList; update: Update }) {
  const { t, theme, lang } = useApp();
  const unit = useWeightUnit();
  const name = bagName(t, bag);
  const example = unit === 'lb' ? '15' : '7';
  const [limit, setLimit] = useState(weightInput(bag.limitG, unit, lang));
  const [limitError, setLimitError] = useState<string | undefined>();
  const [rename, setRename] = useState(bag.name ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const saveLimit = () => {
    const g = parseWeight(limit, unit, lang);
    if (g === null) {
      setLimitError(t('bags.limitError', { example }));
      return;
    }
    setLimitError(undefined);
    update((l) => editBag(l, bag.id, { limitG: g ?? null }).list);
    AccessibilityInfo.announceForAccessibility(t('bags.limitSaved', { name }));
  };
  const saveName = () => {
    const r = editBag(list, bag.id, { name: rename });
    if (r.error) {
      setNameError(t(r.error === 'empty' ? 'bags.errorEmpty' : 'bags.errorDuplicate'));
      return;
    }
    setNameError(undefined);
    update((l) => editBag(l, bag.id, { name: rename }).list);
  };
  const confirmRemove = () =>
    Alert.alert(t('bags.removeTitle', { name }), t('bags.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('bags.removeConfirm'), style: 'destructive', onPress: () => update((l) => removeBag(l, bag.id)) },
    ]);
  return (
    <View style={{ gap: space.s, paddingTop: space.m, borderTopWidth: 1, borderTopColor: theme.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <View style={{ width: 16, height: 16, borderRadius: radius.pill, backgroundColor: cardPaint(theme, bag.colour).fill }} />
        <Text accessibilityRole="header" style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>
          {name} · {whereText(t, bag)}
        </Text>
      </View>
      {bag.kind === 'own' ? (
        <>
          <TextField label={t('bags.rename')} value={rename} onChange={setRename} error={nameError} autoCapitalize="words" />
          {rename.trim() !== (bag.name ?? '') ? <Button kind="secondary" label={t('bags.renameSave')} hint={t('bags.renameSaveHint')} onPress={saveName} /> : null}
          <ToggleRow label={t('bags.holdLabel')} hint={t('bags.holdHint')} value={bag.hold === true} onChange={(v) => update((l) => editBag(l, bag.id, { hold: v }).list)} />
        </>
      ) : null}
      <ColourPicker name={name} value={bag.colour} onChange={(c) => update((l) => editBag(l, bag.id, { colour: c }).list)} />
      <TextField
        label={t('bags.limitLabel', { unit: unitText(t, unit) })}
        value={limit}
        onChange={(v) => {
          setLimit(v);
          if (limitError) setLimitError(undefined);
        }}
        placeholder={t('bags.limitPlaceholder', { example })}
        error={limitError}
        inputMode="decimal"
      />
      {limit !== weightInput(bag.limitG, unit, lang) ? <Button kind="secondary" label={t('bags.limitSave')} hint={t('bags.limitSaveHint')} onPress={saveLimit} /> : null}
      {bag.kind === 'own' ? (
        <Button kind="quiet" icon="trash-outline" label={t('bags.remove', { name })} hint={t('bags.removeHint')} onPress={confirmRemove} />
      ) : null}
    </View>
  );
}

function BagManager({ list, update, onClose }: { list: PackList; update: Update; onClose: () => void }) {
  const { t, theme } = useApp();
  const [name, setName] = useState('');
  const [hold, setHold] = useState(false);
  const [colour, setColour] = useState<CardColour>(OWN_BAG_COLOUR);
  const [error, setError] = useState<string | undefined>();
  const add = () => {
    const id = newId('bag');
    const draft = { name, colour, hold };
    const r = addBag(list, draft, id);
    if (r.error) {
      setError(t(r.error === 'empty' ? 'bags.errorEmpty' : r.error === 'duplicate' ? 'bags.errorDuplicate' : 'bags.errorFull'));
      return;
    }
    update((l) => addBag(l, draft, id).list);
    haptic.success();
    AccessibilityInfo.announceForAccessibility(t('bags.added', { name: name.trim() }));
    setName('');
    setHold(false);
    setColour(OWN_BAG_COLOUR);
    setError(undefined);
  };
  const shown = bagsOf(list).filter((b) => !isCarryOnOnly(list) || isCabin(b) || b.kind === 'own');
  return (
    <View style={{ gap: space.m }}>
      <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
        {t('bags.manageTitle')}
      </Text>
      <Body muted>{t('bags.manageBody')}</Body>
      {shown.map((b) => (
        <BagEditor key={b.id} bag={b} list={list} update={update} />
      ))}
      <View style={{ gap: space.s, paddingTop: space.m, borderTopWidth: 1, borderTopColor: theme.line }}>
        <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
          {t('bags.addTitle')}
        </Text>
        <TextField
          label={t('bags.addName')}
          value={name}
          onChange={(v) => {
            setName(v);
            if (error) setError(undefined);
          }}
          placeholder={t('bags.addPlaceholder')}
          error={error}
          autoCapitalize="words"
        />
        <Label>{t('bags.addWhereGroup')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('bags.addWhereGroup')} style={{ flexDirection: 'row', gap: space.s }}>
          <Chip label={t('bags.where.cabin')} hint={t('bags.addWhereHint')} selected={!hold} onPress={() => setHold(false)} />
          <Chip label={t('bags.where.hold')} hint={t('bags.addWhereHint')} selected={hold} onPress={() => setHold(true)} />
        </View>
        <ColourPicker name={name.trim() || t('bags.addName')} value={colour} onChange={setColour} />
        <Button label={t('bags.add')} hint={t('bags.addHint')} icon="add" onPress={add} />
      </View>
      <Button label={t('bags.manageClose')} kind="quiet" onPress={onClose} />
    </View>
  );
}

// ---------------------------------------------------------------- row pieces

/** Small coloured dot + bag name (and the weight) under a row's label. */
export const BagBadge = memo(function BagBadge({ bag, weightG, unit }: { bag: Bag | null; weightG: number | undefined; unit: WeightUnit }) {
  const { t, theme, lang } = useApp();
  if (!bag && weightG === undefined) return null;
  const name = bag ? bagName(t, bag) : '';
  const parts = [bag ? t('bags.item.badgeA11y', { name }) : '', weightG !== undefined ? t('bags.item.weightA11y', { weight: formatWeight(weightG, unit, lang), unitName: t(unit === 'lb' ? 'bags.unit.lbName' : 'bags.unit.kgName') }) : ''];
  return (
    <View accessible accessibilityLabel={parts.filter(Boolean).join(', ')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      {bag ? <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: cardPaint(theme, bag.colour).fill }} /> : null}
      {bag ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{name}</Text> : null}
      {weightG !== undefined ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted, fontVariant: ['tabular-nums'] }}>
          {bag ? '· ' : ''}
          {t('bags.item.weightBadge', { weight: formatWeight(weightG, unit, lang), unit: unitText(t, unit) })}
        </Text>
      ) : null}
    </View>
  );
});

/** The bag chips in a row's edit card (radio group; choosing one saves at once). Hold bags hide with Carry-on only. */
export function ItemBagPicker({ list, item, onPick }: { list: PackList; item: PackItem; onPick: (bagId: string | null) => void }) {
  const { t, theme } = useApp();
  const bags = bagsOf(list).filter((b) => !isCarryOnOnly(list) || isCabin(b));
  const current = item.bag && bags.some((b) => b.id === item.bag) ? item.bag : null;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{t('bags.item.bagLabel')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('bags.item.bagGroup', { label: item.label })} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {bags.map((b) => (
          <Chip
            key={b.id}
            label={bagName(t, b)}
            hint={t('bags.item.bagChipHint')}
            selected={current === b.id}
            onPress={() => onPick(b.id)}
            icon={<View style={{ width: 12, height: 12, borderRadius: radius.pill, backgroundColor: cardPaint(theme, b.colour).fill }} />}
          />
        ))}
        <Chip label={t('bags.item.noBag')} selected={current === null} onPress={() => onPick(null)} />
      </View>
    </View>
  );
}

/** Weight-of-one field for the edit card. `error` is shown when the text isn't a weight. */
export function ItemWeightField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: boolean }) {
  const { t } = useApp();
  const unit = useWeightUnit();
  const example = unit === 'lb' ? '0.5' : '0.25';
  return (
    <TextField
      label={t('bags.item.weightLabel', { unit: unitText(t, unit) })}
      value={value}
      onChange={onChange}
      placeholder={t('bags.item.weightPlaceholder', { example })}
      error={error ? t('bags.item.weightError', { example }) : undefined}
      inputMode="decimal"
    />
  );
}

