// Travelling together (T82) on the spending screen: companions (names only, on this phone), each person's balance in
// the trip's home currency, the settle-up list (mark a payment done, undo it, share the summary as text), and the
// payer / split fields of the expense form. All maths lives in src/core/together.ts.
import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { deviceZone, formatDay, todayIn } from '../core/format.ts';
import { newId, type SplitMode, type Trip } from '../core/model.ts';
import { companionToneIndex } from '../core/followups90.ts';
import { formatMoney, readSpending } from '../core/spending.ts';
import {
  addCompanion,
  addSettlement,
  balances,
  companionUse,
  exactRemaining,
  ME,
  peopleOf,
  readCompanions,
  readSettlements,
  removeCompanion,
  removeSettlement,
  renameCompanion,
  settlePlan,
  togglePerson,
  validateName,
  type Balance,
  type NameError,
  type SettlePlan,
  type TogetherDraft,
  type TogetherError,
  type Transfer,
} from '../core/together.ts';
import type { Key } from '../i18n/en.ts';
import { haptic } from '../native/device.ts';
import { shareText } from '../native/share.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge, toneColours, type Tone } from './hero.tsx';
import { Body, Button, Card, Chip, Label, PressableScale, TextField, Warning } from './kit.tsx';

/**
 * Avatar colours: You in the warm accent, companions one of the other token tones (all AA in both themes), picked
 * from the companion's id (T84) so a colour never moves to someone else when the list changes.
 */
const COMPANION_TONES: readonly Tone[] = ['sea', 'teal', 'ok', 'warn', 'ink', 'danger'];
const NAME_ERRORS: Record<NameError, Key> = {
  empty: 'together.err.empty',
  long: 'together.err.long',
  duplicate: 'together.err.duplicate',
  full: 'together.err.full',
};
const MODE_KEYS: Record<SplitMode, Key> = { equal: 'together.mode.equal', shares: 'together.mode.shares', exact: 'together.mode.exact' };

export type People = { order: string[]; name: (id: string) => string; tone: (id: string) => Tone };

/** Names and avatar tones for everyone on the trip ('me' is "You"; a person no longer on the trip reads as You). */
export function usePeople(trip: Trip): People {
  const { t } = useApp();
  return useMemo(() => {
    const companions = readCompanions(trip);
    const byId = new Map(companions.map((c) => [c.id, { name: c.name, tone: COMPANION_TONES[companionToneIndex(c.id, COMPANION_TONES.length)] ?? 'sea' }]));
    return {
      order: peopleOf(trip),
      name: (id: string) => byId.get(id)?.name ?? t('together.you'),
      tone: (id: string) => byId.get(id)?.tone ?? 'accent',
    };
  }, [trip, t]);
}

/** Up to two initials from a name ("Sam Lee" -> "SL"). */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toLocaleUpperCase() ?? '')
    .join('');

/** A coloured circle with initials. Decorative: the row it sits in names the person. */
export const Avatar = memo(function Avatar({ name, tone, size = 36 }: { name: string; tone: Tone; size?: number }) {
  const { theme } = useApp();
  const { fg, bg } = toneColours(theme, tone);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: 1.5, borderColor: fg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.round(size * 0.38), color: fg }}>{initials(name)}</Text>
    </View>
  );
});

type Save = (t: Trip) => Promise<boolean>;

/** The whole "Travelling together" section: companions, balances and settle-up. */
export function TogetherSection({ trip, save }: { trip: Trip; save: Save }) {
  const people = usePeople(trip);
  const b = useMemo(() => balances(trip), [trip]);
  const plan = useMemo(() => settlePlan(b), [b]);
  const hasCompanions = people.order.length > 1;
  return (
    <View style={{ gap: space.m }}>
      <CompanionsCard trip={trip} save={save} people={people} />
      {hasCompanions || b.shared ? (
        <FadeInView style={{ gap: space.m }}>
          <BalancesCard trip={trip} people={people} inHome={b.inHome} home={b.home} apart={b.apart} />
          <SettleCard trip={trip} save={save} people={people} plan={plan} />
        </FadeInView>
      ) : null}
    </View>
  );
}

function CompanionsCard({ trip, save, people }: { trip: Trip; save: Save; people: People }) {
  const { t, theme } = useApp();
  const companions = readCompanions(trip);
  const [name, setName] = useState('');
  const [error, setError] = useState<NameError | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; error: NameError | null } | null>(null);
  const you = t('together.you');

  const add = async () => {
    const err = validateName(trip, name, you);
    setError(err);
    if (err) {
      AccessibilityInfo.announceForAccessibility(t(NAME_ERRORS[err]));
      return;
    }
    if (await save(addCompanion(trip, name, newId('pal')))) {
      AccessibilityInfo.announceForAccessibility(t('together.added', { name: name.trim() }));
      setName('');
    }
  };
  const rename = async () => {
    if (!editing) return;
    const err = validateName(trip, editing.name, you, editing.id);
    if (err) {
      setEditing({ ...editing, error: err });
      AccessibilityInfo.announceForAccessibility(t(NAME_ERRORS[err]));
      return;
    }
    if (await save(renameCompanion(trip, editing.id, editing.name))) {
      setEditing(null);
      AccessibilityInfo.announceForAccessibility(t('together.renamed'));
    }
  };
  const remove = (id: string) => {
    const who = people.name(id);
    const use = companionUse(trip, id);
    const go = async () => {
      if (await save(removeCompanion(trip, id))) AccessibilityInfo.announceForAccessibility(t('together.removed', { name: who }));
    };
    if (use.expenses === 0 && use.settlements === 0) {
      go();
      return;
    }
    Alert.alert(t('together.removeTitle', { name: who }), t('together.removeBody', { name: who, n: use.expenses + use.settlements }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('together.remove'), style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="people-outline" tone="teal" />
        <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
          {t('together.title')}
        </Text>
      </View>
      <Body muted>{companions.length ? t('together.body') : t('together.emptyBody')}</Body>

      <View style={{ gap: space.xs }}>
        <View accessible accessibilityLabel={t('together.youA11y')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TOUCH }}>
          <Avatar name={you} tone="accent" />
          <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{you}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('together.alwaysThere')}</Text>
        </View>
        {companions.map((c) =>
          editing?.id === c.id ? (
            <View key={c.id} style={{ gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
              <TextField
                label={t('together.renameLabel', { name: c.name })}
                value={editing.name}
                onChange={(v) => setEditing({ ...editing, name: v, error: null })}
                autoCapitalize="words"
                error={editing.error ? t(NAME_ERRORS[editing.error]) : undefined}
              />
              <View style={{ flexDirection: 'row', gap: space.s }}>
                <View style={{ flex: 1 }}>
                  <Button label={t('together.saveName')} hint={t('together.saveNameHint')} icon="checkmark" onPress={rename} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label={t('common.cancel')} hint={t('together.cancelRenameHint')} kind="quiet" onPress={() => setEditing(null)} />
                </View>
              </View>
            </View>
          ) : (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: 1, borderTopColor: theme.line }}>
              <Avatar name={c.name} tone={people.tone(c.id)} />
              <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]} numberOfLines={2}>
                {c.name}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('together.renameA11y', { name: c.name })}
                accessibilityHint={t('together.renameHint')}
                onPress={() => setEditing({ id: c.id, name: c.name, error: null })}
                style={{ width: TOUCH, alignItems: 'center' }}
              >
                <Ionicons name="create-outline" size={20} color={theme.sea} />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('together.removeA11y', { name: c.name })}
                accessibilityHint={t('together.removeHint')}
                onPress={() => remove(c.id)}
                style={{ width: TOUCH, alignItems: 'center' }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </PressableScale>
            </View>
          ),
        )}
      </View>

      <TextField
        label={t('together.addLabel')}
        value={name}
        onChange={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder={t('together.addPlaceholder')}
        autoCapitalize="words"
        error={error ? t(NAME_ERRORS[error]) : undefined}
      />
      <Button label={t('together.add')} hint={t('together.addHint')} kind="secondary" icon="person-add-outline" onPress={add} />
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('together.privacy')}</Text>
    </Card>
  );
}

function BalanceRow({ person, amount, code, people }: { person: string; amount: number; code: string; people: People }) {
  const { t, theme, lang } = useApp();
  const name = people.name(person);
  const money = formatMoney(Math.abs(amount), code, lang);
  const text = amount > 0 ? t('together.isOwed', { amount: money }) : amount < 0 ? t('together.owes', { amount: money }) : t('together.even');
  const colour = amount > 0 ? theme.ok : amount < 0 ? theme.danger : theme.muted;
  return (
    <View accessible accessibilityLabel={`${name}, ${text}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TOUCH }}>
      <Avatar name={name} tone={people.tone(person)} />
      <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[typeScale.bodyStrong, { color: colour, fontVariant: ['tabular-nums'] }]}>{text}</Text>
    </View>
  );
}

function BalancesCard({ trip, people, inHome, home, apart }: { trip: Trip; people: People; inHome: Balance[] | null; home: string | null; apart: { currency: string; balances: Balance[] }[] }) {
  const { t, theme } = useApp();
  const rates = readSpending(trip).rates;
  return (
    <Card style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="scale-outline" tone="sea" />
        <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
          {t('together.balances')}
        </Text>
      </View>
      {home && inHome ? (
        <>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('together.balancesIn', { code: home })}</Text>
          {inHome.map((b) => (
            <BalanceRow key={b.person} person={b.person} amount={b.amount} code={home} people={people} />
          ))}
        </>
      ) : (
        <Body muted>{t('together.noHome')}</Body>
      )}
      {apart.map((g) => (
        <View key={g.currency} style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
          <Warning text={home ? (rates[g.currency] == null ? t('together.apartNoRate', { code: g.currency, home }) : t('together.apart', { code: g.currency })) : t('together.apart', { code: g.currency })} />
          {g.balances.map((b) => (
            <BalanceRow key={b.person} person={b.person} amount={b.amount} code={g.currency} people={people} />
          ))}
        </View>
      ))}
    </Card>
  );
}

/** Plain-text settle-up summary for the share sheet. */
function summaryText(trip: Trip, plan: SettlePlan, people: People, t: ReturnType<typeof useApp>['t'], lang: string): string {
  const line = (x: Transfer, code: string) => t('together.transferText', { from: people.name(x.from), to: people.name(x.to), amount: formatMoney(x.amount, code, lang) });
  const out: string[] = [t('together.shareHeading', { trip: trip.name })];
  if (plan.settled) out.push(t('together.allSettled'));
  if (plan.home && plan.inHome.length) {
    out.push('', t('together.shareIn', { code: plan.home }));
    for (const x of plan.inHome) out.push(t('together.shareLine', { line: line(x, plan.home) }));
  }
  for (const g of plan.apart) {
    out.push('', t('together.shareApart', { code: g.currency }));
    for (const x of g.transfers) out.push(t('together.shareLine', { line: line(x, g.currency) }));
  }
  out.push('', t('together.shareFooter'));
  return out.join('\n');
}

function SettleCard({ trip, save, people, plan }: { trip: Trip; save: Save; people: People; plan: SettlePlan }) {
  const { t, theme, lang } = useApp();
  const settlements = readSettlements(trip);
  const [shareFailed, setShareFailed] = useState(false);
  const groups = [...(plan.home && plan.inHome.length ? [{ currency: plan.home, transfers: plan.inHome, apart: false }] : []), ...plan.apart.map((g) => ({ ...g, apart: true }))];

  const markSettled = async (x: Transfer, currency: string) => {
    if (await save(addSettlement(trip, x, currency, newId('settle'), todayIn(deviceZone())))) {
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t('together.markedA11y', { from: people.name(x.from), to: people.name(x.to), amount: formatMoney(x.amount, currency, lang) }));
    }
  };
  const undo = async (id: string) => {
    if (await save(removeSettlement(trip, id))) AccessibilityInfo.announceForAccessibility(t('together.undone'));
  };
  const share = async () => {
    const r = await shareText(summaryText(trip, plan, people, t, lang), t('together.shareTitle'));
    setShareFailed(r === 'failed');
  };

  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="swap-horizontal" tone="ok" />
        <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
          {t('together.settleTitle')}
        </Text>
      </View>
      {plan.settled ? (
        <View accessible accessibilityLabel={t('together.allSettled')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="checkmark-circle" size={20} color={theme.ok} />
          </View>
          <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('together.allSettled')}</Text>
        </View>
      ) : (
        <Body muted>{t('together.settleBody')}</Body>
      )}
      {plan.settled ? null : (
        <View accessible accessibilityLabel={t('f90.settle.ratesHelp')} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
          </View>
          <Text style={[typeScale.small, { flex: 1, color: theme.muted }]}>{t('f90.settle.ratesHelp')}</Text>
        </View>
      )}
      {groups.map((g) => (
        <View key={g.currency} style={{ gap: space.s }}>
          {g.apart ? <Label>{t('together.settleApart', { code: g.currency })}</Label> : null}
          {g.transfers.map((x) => {
            const amount = formatMoney(x.amount, g.currency, lang);
            const from = people.name(x.from);
            const to = people.name(x.to);
            return (
              <View key={`${x.from}-${x.to}`} style={{ gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
                <View accessible accessibilityLabel={t('together.transferA11y', { from, to, amount })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                  <Avatar name={from} tone={people.tone(x.from)} size={32} />
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Ionicons name="arrow-forward" size={18} color={theme.muted} />
                  </View>
                  <Avatar name={to} tone={people.tone(x.to)} size={32} />
                  <Text style={[typeScale.body, { flex: 1, color: theme.ink }]} numberOfLines={2}>
                    {t('together.transferText', { from, to, amount })}
                  </Text>
                </View>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('together.markA11y', { from, to, amount })}
                  accessibilityHint={t('together.markHint')}
                  onPress={() => markSettled(x, g.currency)}
                  style={{ flexDirection: 'row', gap: space.s, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: theme.okSoft }}
                >
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Ionicons name="checkmark" size={18} color={theme.ok} />
                  </View>
                  <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('together.mark')}</Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
      {plan.settled && settlements.length === 0 ? null : (
        <Button label={t('together.share')} hint={t('together.shareHint')} kind="secondary" icon="share-outline" onPress={share} />
      )}
      {shareFailed ? <Warning text={t('together.shareFailed')} /> : null}
      {settlements.length ? (
        <View style={{ gap: space.xs }}>
          <View accessible accessibilityRole="header">
            <Label>{t('together.history')}</Label>
          </View>
          {[...settlements].reverse().map((s) => {
            const from = people.name(s.from);
            const to = people.name(s.to);
            const amount = formatMoney(s.amount, s.currency, lang);
            const day = s.day ? formatDay(s.day, lang) : '';
            const text = day ? t('together.paidOn', { from, to, amount, day }) : t('together.paid', { from, to, amount });
            return (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{text}</Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('together.undoA11y', { text })}
                  accessibilityHint={t('together.undoHint')}
                  onPress={() => undo(s.id)}
                  style={{ paddingHorizontal: space.m, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line }}
                >
                  <Text style={[typeScale.small, { color: theme.ink, fontFamily: fonts.bodyBold }]}>{t('together.undo')}</Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const TOGETHER_ERRORS: Record<TogetherError, Key> = {
  people: 'together.err.people',
  shares: 'together.err.shares',
  exact: 'together.err.exact',
  exactSum: 'together.err.exactSum',
};

/** Paid by + split between fields of the expense form (shown when the trip has companions). */
export function PayerSplitFields({
  trip,
  draft: d,
  onChange,
  amount,
  currency,
  errors,
}: {
  trip: Trip;
  draft: TogetherDraft;
  onChange: (d: TogetherDraft) => void;
  /** The typed amount in minor units, or null while it can't be read. */
  amount: number | null;
  currency: string;
  errors: TogetherError[];
}) {
  const { t, theme, lang } = useApp();
  const people = usePeople(trip);
  const remaining = d.mode === 'exact' && amount != null ? exactRemaining(d, amount, currency) : null;
  return (
    <View style={{ gap: space.m }}>
      <Label>{t('together.paidBy')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('together.paidBy')}>
        {people.order.map((p) => (
          <Chip
            key={p}
            label={people.name(p)}
            selected={d.paidBy === p}
            onPress={() => onChange({ ...d, paidBy: p })}
            icon={<Avatar name={people.name(p)} tone={people.tone(p)} size={24} />}
          />
        ))}
      </View>

      <Label>{t('together.splitHow')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('together.splitHow')}>
        {(['equal', 'shares', 'exact'] as const).map((m) => (
          <Chip key={m} label={t(MODE_KEYS[m])} selected={d.mode === m} onPress={() => onChange({ ...d, mode: m })} />
        ))}
      </View>

      <Label>{t('together.splitWith')}</Label>
      <View style={{ gap: space.xs }}>
        {people.order.map((p) => {
          const on = d.people.includes(p);
          const name = people.name(p);
          return (
            <View key={p} style={{ gap: space.xs }}>
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityLabel={t('together.includeA11y', { name })}
                accessibilityState={{ checked: on }}
                onPress={() => onChange(togglePerson(d, p, people.order))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? theme.accentInk : theme.muted} />
                <Avatar name={name} tone={people.tone(p)} size={28} />
                <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{name}</Text>
              </PressableScale>
              {on && d.mode === 'shares' ? (
                <TextField
                  label={t('together.sharesFor', { name })}
                  value={d.shares[p] ?? '1'}
                  onChange={(v) => onChange({ ...d, shares: { ...d.shares, [p]: v.replace(/[^0-9]/g, '').slice(0, 4) } })}
                  inputMode="numeric"
                />
              ) : null}
              {on && d.mode === 'exact' ? (
                <TextField
                  label={t('together.exactFor', { name, code: currency || t('together.noCode') })}
                  value={d.exact[p] ?? ''}
                  onChange={(v) => onChange({ ...d, exact: { ...d.exact, [p]: v } })}
                  inputMode="decimal"
                  placeholder={t('together.exactPlaceholder')}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      {remaining != null && remaining !== 0 ? (
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.warn }]}>
          {remaining > 0 ? t('together.left', { amount: formatMoney(remaining, currency, lang) }) : t('together.over', { amount: formatMoney(-remaining, currency, lang) })}
        </Text>
      ) : null}
      {errors.map((e) => (
        <Text key={e} accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.danger }]}>
          {t(TOGETHER_ERRORS[e])}
        </Text>
      ))}
    </View>
  );
}

/** One line for an expense row: "Sam paid · split 3 ways", or null for a plain solo expense. */
export function expenseTogetherLine(payer: string, sharers: number, together: boolean, people: People, t: ReturnType<typeof useApp>['t']): string | null {
  if (!together) return null;
  const paid = payer === ME ? t('together.row.youPaid') : t('together.row.paid', { name: people.name(payer) });
  return sharers > 1 ? t('together.row.split', { paid, n: sharers }) : paid;
}
