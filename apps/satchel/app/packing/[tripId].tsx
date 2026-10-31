// Trip packing list (FLOWS §10). No list yet: pick one or more trip-type templates (the suggested one preselected)
// or start empty. With a list: a hero card with a progress ring (T75), the laundry switch, opt-in suggestions
// (forecast / daylight / season / plug adapter; Add or Dismiss, never added on their own), items grouped by category
// with checkboxes, add / rename / remove, Add a template (items already there are skipped; ticks and renames stay),
// Share list as text and Repack for home (unticks all, confirmed). Clothes counts follow the trip's nights read in
// the bookings' own zones (src/core/smartpack.ts). Everything is stored on the phone under 'satchel.packing.v1'.
// Free forever.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newId } from '../../src/core/model.ts';
import {
  addItem,
  addTemplates,
  buildList,
  emptyList,
  EMPTY_STORE,
  groupByCategory,
  listFor,
  listTemplates,
  PACKING_KEY,
  parseTemplates,
  progress,
  putList,
  removeItem,
  renameItem,
  resetTicks,
  suggestTemplate,
  toggleItem,
  tripFacts,
  type PackItem,
  type PackList,
  type PackStore,
  type Template,
} from '../../src/core/packing.ts';
import {
  acceptSuggestion,
  dismissedOf,
  dismissSuggestion,
  isLaundry,
  itemQty,
  LAUNDRY_EVERY_NIGHTS,
  openSuggestions,
  restoreSuggestions,
  ruleIndex,
  setLaundry,
  smartSuggestions,
  tripNightsInZones,
  type Suggestion,
} from '../../src/core/smartpack.ts';
import templateData from '../../src/content/packing_templates.json';
import type { Trip } from '../../src/core/model.ts';
import type { Key } from '../../src/i18n/en.ts';
import type { T } from '../../src/i18n/core.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, TOUCH } from '../../src/theme/tokens.ts';
import { useDiscardConfirm } from '../../src/ui/discardConfirm.ts';
import { Body, Button, Card, EmptyState, Label, PressableScale, Screen, TextField, Title, ToggleRow } from '../../src/ui/kit.tsx';
import { PackHero, SharePackingList, suggestionLabel, SuggestionsCard, nightsText, useSmartData } from '../../src/ui/SmartPack.tsx';
import { useTempUnit } from '../../src/ui/WeatherCard.tsx';

const TEMPLATES: Template[] = parseTemplates(templateData).templates;
const RULES = ruleIndex(TEMPLATES);

const CATEGORY_KEYS: Record<string, Key> = {
  documents: 'packing.cat.documents',
  money: 'packing.cat.money',
  clothes: 'packing.cat.clothes',
  toiletries: 'packing.cat.toiletries',
  health: 'packing.cat.health',
  tech: 'packing.cat.tech',
  outdoor: 'packing.cat.outdoor',
  kids: 'packing.cat.kids',
  misc: 'packing.cat.misc',
};
const categoryName = (t: T, c: string) => (CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '));

type Row = { type: 'header'; key: string; category: string; done: number; total: number } | { type: 'item'; key: string; item: PackItem };

export default function PackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips, loaded: tripsLoaded } = useTrips();
  const [store, setStore, storeLoaded] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const trip = trips.find((x) => x.id === tripId);
  const list = tripId ? listFor(store, tripId) : null;

  const update = useCallback(
    (fn: (l: PackList) => PackList) =>
      setStore((s) => {
        const l = listFor(s, tripId);
        return l ? putList(s ?? {}, fn(l)) : s;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId],
  );

  if (!tripsLoaded || !storeLoaded) {
    return (
      <Screen>
        <Body muted>{t('packing.loading')}</Body>
      </Screen>
    );
  }
  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('packing.title')} body={t('packing.notFound')} />
      </Screen>
    );
  }
  if (!list) {
    return (
      <TemplatePicker
        tripName={trip.name}
        suggested={suggestTemplate(trip, TEMPLATES)}
        onCreate={(chosen) => {
          const next = chosen.length ? buildList(trip.id, chosen, { nights: tripNightsInZones(trip), facts: tripFacts(trip, chosen) }) : emptyList(trip.id);
          setStore((s) => putList(s ?? {}, next));
        }}
      />
    );
  }
  return <PackingList trip={trip} list={list} update={update} />;
}

function TemplatePicker({ tripName, suggested, onCreate }: { tripName: string; suggested: string | null; onCreate: (chosen: Template[]) => void }) {
  const { t, theme } = useApp();
  const [picked, setPicked] = useState<string[]>(suggested ? [suggested] : []);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Screen>
      <Title>{t('packing.forTrip', { trip: tripName })}</Title>
      <Card style={{ gap: space.m }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {t('packing.templateTitle')}
        </Text>
        <Body muted>{t('packing.templateHint')}</Body>
        <TemplateChecks picked={picked} onToggle={toggle} suggested={suggested} />
        {picked.length ? (
          <Button
            label={t('packing.useTemplates')}
            hint={t('packing.useTemplatesHint')}
            onPress={() => onCreate(TEMPLATES.filter((tp) => picked.includes(tp.id)))}
          />
        ) : null}
        <Button label={t('packing.startEmpty')} hint={t('packing.startEmptyHint')} kind="quiet" onPress={() => onCreate([])} />
      </Card>
    </Screen>
  );
}

/** Template checkboxes. Templates in `used` are already on the list: shown, but not selectable. */
function TemplateChecks({ picked, onToggle, suggested, used = [] }: { picked: string[]; onToggle: (id: string) => void; suggested?: string | null; used?: string[] }) {
  const { t, theme } = useApp();
  return (
    <View accessibilityLabel={t('packing.templateGroup')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      {TEMPLATES.map((tp) => {
        const done = used.includes(tp.id);
        const checked = done || picked.includes(tp.id);
        const isSuggested = !done && tp.id === suggested;
        const a11y = done
          ? t('packing.addTemplateUsed', { name: tp.name })
          : t(isSuggested ? 'packing.templateSuggestedA11y' : 'packing.templateA11y', { name: tp.name, count: tp.items.length });
        return (
          <PressableScale
            key={tp.id}
            accessibilityRole="checkbox"
            accessibilityLabel={a11y}
            accessibilityState={{ checked, disabled: done }}
            disabled={done}
            onPress={() => onToggle(tp.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              paddingHorizontal: space.m,
              borderRadius: radius.l,
              borderWidth: 1,
              borderColor: checked ? theme.accent : theme.line,
              backgroundColor: checked ? theme.accentSoft : theme.card,
              opacity: done ? 0.6 : 1,
            }}
          >
            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={18} color={checked ? theme.accent : theme.muted} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink }}>{tp.name}</Text>
            {isSuggested ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>· {t('packing.suggested')}</Text> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** "Add a template" panel on an existing list. */
function AddTemplatePanel({ trip, list, update, onClose }: { trip: Trip; list: PackList; update: (fn: (l: PackList) => PackList) => void; onClose: () => void }) {
  const { t, theme } = useApp();
  const used = listTemplates(list);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const toggle = (id: string) => {
    setNote(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const add = () => {
    const chosen = TEMPLATES.filter((tp) => picked.includes(tp.id));
    if (!chosen.length) return;
    const opts = { nights: tripNightsInZones(trip), facts: tripFacts(trip, chosen) };
    const { added } = addTemplates(list, chosen, opts);
    update((l) => addTemplates(l, chosen, opts).list);
    setPicked([]);
    const msg = added ? t('packing.addTemplateDone', { count: added }) : t('packing.addTemplateNone');
    AccessibilityInfo.announceForAccessibility(msg);
    if (added) onClose();
    else setNote(msg);
  };
  return (
    <Card style={{ gap: space.m }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
        {t('packing.addTemplateTitle')}
      </Text>
      <Body muted>{t('packing.addTemplateBody')}</Body>
      <TemplateChecks picked={picked} onToggle={toggle} used={used} />
      {note ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
          {note}
        </Text>
      ) : null}
      {picked.length ? <Button label={t('packing.addTemplateConfirm')} hint={t('packing.addTemplateConfirmHint')} onPress={add} /> : null}
      <Button label={t('common.cancel')} hint={t('spec41.packing.templateCancelHint')} kind="quiet" onPress={onClose} />
    </Card>
  );
}

function PackingList({ trip, list, update }: { trip: Trip; list: PackList; update: (fn: (l: PackList) => PackList) => void }) {
  const { t, theme } = useApp();
  const [unit] = useTempUnit();
  const smart = useSmartData(trip);
  const nights = tripNightsInZones(trip);
  const laundry = isLaundry(list);
  const qtyOf = useCallback((i: PackItem) => itemQty(i, { nights, laundry, rules: RULES }), [nights, laundry]);
  const all = useMemo(() => smartSuggestions(smart.input), [smart.input]);
  const open = useMemo(() => openSuggestions(list, all, (s) => suggestionLabel(t, s)), [list, all, t]);
  const dismissedCount = dismissedOf(list).length;
  const addSuggestion = (s: Suggestion, label: string) => {
    const id = newId('pk');
    update((l) => acceptSuggestion(l, s, label, id).list);
    AccessibilityInfo.announceForAccessibility(t('smartpack.suggest.added', { label }));
  };
  const dismiss = (s: Suggestion) => {
    update((l) => dismissSuggestion(l, s.id));
    AccessibilityInfo.announceForAccessibility(t('smartpack.suggest.dismissed'));
  };
  const tripName = trip.name;
  const [addingTemplate, setAddingTemplate] = useState(false);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState<string | null>(null);
  // An item typed but not added, or a rename still open, asks before leaving (src/ui/discardConfirm.ts). Ticks,
  // adds and removals are saved at once, so they never count as unsaved.
  const { gestureEnabled } = useDiscardConfirm(draft.trim() !== '' || editing !== null);

  const p = progress(list);
  const rows = useMemo<Row[]>(() => {
    const cat = new Map(p.categories.map((c) => [c.category, c]));
    return groupByCategory(list).flatMap((g) => [
      { type: 'header' as const, key: `h:${g.category}`, category: g.category, done: cat.get(g.category)?.done ?? 0, total: g.items.length },
      ...g.items.map((item) => ({ type: 'item' as const, key: `i:${item.id}`, item })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const add = () => {
    const id = newId('pk');
    const label = draft;
    const r = addItem(list, label, id);
    if (r.error) {
      setError(t(r.error === 'empty' ? 'packing.errorEmpty' : 'packing.errorDuplicate'));
      return;
    }
    setError(undefined);
    setDraft('');
    update((l) => addItem(l, label, id).list);
  };

  // "Repack for home": untick everything (nothing removed), after a confirm.
  const confirmReset = () =>
    Alert.alert(t('smartpack.repackTitle'), t('smartpack.repackBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('smartpack.repackConfirm'),
        style: 'destructive',
        onPress: () => {
          update(resetTicks);
          AccessibilityInfo.announceForAccessibility(t('smartpack.repackDone'));
        },
      },
    ]);

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) =>
      row.type === 'header' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: space.l, paddingBottom: space.xs }}>
          <View accessibilityRole="header">
            <Label>{categoryName(t, row.category)}</Label>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted, fontVariant: ['tabular-nums'] }}>
            {t('packing.categoryProgress', { done: row.done, total: row.total })}
          </Text>
        </View>
      ) : (
        <PackRow
          item={row.item}
          qty={qtyOf(row.item)}
          editing={editing === row.item.id}
          onToggle={() => update((l) => toggleItem(l, row.item.id))}
          onEdit={() => setEditing(row.item.id)}
          onRename={(label) => {
            update((l) => renameItem(l, row.item.id, label));
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
          onRemove={() => {
            update((l) => removeItem(l, row.item.id));
            AccessibilityInfo.announceForAccessibility(t('packing.removedAnnounce', { label: row.item.label }));
          }}
        />
      ),
    [t, theme, editing, update, qtyOf],
  );

  const header = (
    <View style={{ gap: space.m, marginBottom: space.s }}>
      <PackHero tripName={tripName} done={p.done} total={p.total} nights={nights} laundry={laundry} />
      <Card style={{ gap: space.xs }}>
        <ToggleRow
          label={t('smartpack.laundry')}
          hint={t('smartpack.laundryHint', { n: LAUNDRY_EVERY_NIGHTS })}
          value={laundry}
          onChange={(on) => update((l) => setLaundry(l, on))}
        />
        <Body muted>{t('smartpack.laundryNote', { nights: nightsText(t, nights).toLowerCase() })}</Body>
      </Card>
      <SuggestionsCard
        open={open}
        unit={unit}
        dismissedCount={dismissedCount}
        homeGuessed={smart.homeGuessed}
        fromForecast={smart.hasForecast}
        onAdd={addSuggestion}
        onDismiss={dismiss}
        onRestore={() => update(restoreSuggestions)}
      />
      {p.total === 0 ? <EmptyState title={t('packing.emptyTitle')} body={t('packing.emptyBody')} /> : null}
    </View>
  );
  const footer = (
    <View style={{ gap: space.m, marginTop: space.l }}>
      <TextField
        label={t('packing.itemLabel')}
        value={draft}
        onChange={(v) => {
          setDraft(v);
          if (error) setError(undefined);
        }}
        placeholder={t('packing.itemPlaceholder')}
        error={error}
      />
      <Button label={t('packing.addItem')} hint={t('packing.addHint')} onPress={add} />
      {addingTemplate ? (
        <AddTemplatePanel trip={trip} list={list} update={update} onClose={() => setAddingTemplate(false)} />
      ) : (
        <Button label={t('packing.addTemplate')} hint={t('packing.addTemplateHint')} kind="quiet" onPress={() => setAddingTemplate(true)} />
      )}
      {p.total > 0 ? <SharePackingList tripName={tripName} list={list} qtyOf={qtyOf} laundry={laundry} categoryName={(c) => categoryName(t, c)} /> : null}
      {p.done > 0 ? <Button label={t('smartpack.repack')} hint={t('smartpack.repackHint')} kind="quiet" icon="refresh-outline" onPress={confirmReset} /> : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled }} />
      <FlatList
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl }}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        extraData={[editing, qtyOf]}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      />
    </>
  );
}

const PackRow = memo(function PackRow({
  item,
  qty,
  editing,
  onToggle,
  onEdit,
  onRename,
  onCancel,
  onRemove,
}: {
  item: PackItem;
  /** Shown quantity (worked out from the trip's nights and the laundry switch). */
  qty: number | undefined;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRename: (label: string) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { t, theme } = useApp();
  const [name, setName] = useState(item.label);
  const state = t(item.done ? 'packing.statePacked' : 'packing.stateNotPacked');
  const a11y = qty
    ? t('packing.itemQtyA11y', { label: item.label, qty: t('packing.qtyA11y', { qty }), state })
    : t('packing.itemA11y', { label: item.label, state });

  if (editing) {
    return (
      <Card style={{ marginVertical: space.xs }}>
        <TextField label={t('packing.renameLabel')} value={name} onChange={setName} />
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <View style={{ flex: 1 }}>
            <Button label={t('common.save')} onPress={() => onRename(name)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('common.cancel')}
              kind="quiet"
              onPress={() => {
                setName(item.label);
                onCancel();
              }}
            />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.line }}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={a11y}
        accessibilityHint={t(item.done ? 'packing.hintUnpack' : 'packing.hintPack')}
        accessibilityState={{ checked: item.done }}
        onPress={onToggle}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs }}
      >
        <Ionicons name={item.done ? 'checkbox' : 'square-outline'} size={26} color={item.done ? theme.ok : theme.muted} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 16,
            color: item.done ? theme.muted : theme.ink,
            textDecorationLine: item.done ? 'line-through' : 'none',
          }}
        >
          {item.label}
        </Text>
        {qty ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.muted, fontVariant: ['tabular-nums'] }}>{t('packing.qty', { qty })}</Text> : null}
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('packing.renameItem', { label: item.label })}
        accessibilityHint={t('packing.renameHint')}
        onPress={() => {
          setName(item.label);
          onEdit();
        }}
        style={{ width: TOUCH, alignItems: 'center' }}
      >
        <Ionicons name="create-outline" size={20} color={theme.muted} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('packing.removeItem', { label: item.label })}
        accessibilityHint={t('packing.removeHint')}
        onPress={onRemove}
        style={{ width: TOUCH, alignItems: 'center' }}
      >
        <Ionicons name="trash-outline" size={20} color={theme.danger} />
      </PressableScale>
    </View>
  );
});
