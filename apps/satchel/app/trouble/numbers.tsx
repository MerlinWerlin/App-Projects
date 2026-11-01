// T78 My important numbers: labelled phone numbers the traveller wants at hand when something goes wrong (card
// block lines, embassy or consulate, airline, accommodation, other), grouped in that order. Tap a row to call it
// through the same helper as the emergency card (callAndExplain). Stored on this phone only under
// IMPORTANT_NUMBERS_KEY; never part of a .satchel trip file (tripfile.ts only sees one trip) or anything else that
// leaves the phone. Opened with ?add=<group> from a guide step to start the form on that group.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newId } from '../../src/core/model.ts';
import {
  cleanNumbers,
  groupNumbers,
  hasNumberErrors,
  IMPORTANT_NUMBERS_KEY,
  isNumberGroup,
  NUMBER_GROUPS,
  removeNumber,
  upsertNumber,
  validateNumber,
  type ImportantNumber,
  type NumberErrors,
  type NumberGroup,
} from '../../src/core/troubles.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { elevated, fonts, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { FadeInView, IconBadge, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { Body, Button, Card, Chip, EmptyState, PressableScale, TextField } from '../../src/ui/kit.tsx';

const NO_NUMBERS: unknown = [];

const GROUP_ICON: Record<NumberGroup, IconName> = {
  cardBlock: 'card-outline',
  embassy: 'flag-outline',
  airline: 'airplane-outline',
  accommodation: 'bed-outline',
  other: 'call-outline',
};
const GROUP_TONE: Record<NumberGroup, Tone> = { cardBlock: 'warn', embassy: 'sea', airline: 'accent', accommodation: 'teal', other: 'ok' };

type Draft = { id: string | null; group: NumberGroup; label: string; phone: string };

const LABEL_ERR: Record<NonNullable<NumberErrors['label']>, Key> = { required: 'trouble.numbers.err.labelRequired', tooLong: 'trouble.numbers.err.labelTooLong' };
const PHONE_ERR: Record<NonNullable<NumberErrors['phone']>, Key> = { required: 'trouble.numbers.err.phoneRequired', invalid: 'trouble.numbers.err.phoneInvalid' };

export default function ImportantNumbersScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = usePersisted<unknown>(IMPORTANT_NUMBERS_KEY, NO_NUMBERS);
  const numbers = useMemo(() => cleanNumbers(raw), [raw]);
  const groups = useMemo(() => groupNumbers(numbers), [numbers]);
  const [draft, setDraft] = useState<Draft | null>(() => (isNumberGroup(params.add) ? { id: null, group: params.add, label: '', phone: '' } : null));
  const [showErrors, setShowErrors] = useState(false);
  const errors = draft ? validateNumber(draft.label, draft.phone) : {};

  const startAdd = () => {
    setShowErrors(false);
    setDraft({ id: null, group: 'cardBlock', label: '', phone: '' });
  };
  const startEdit = (n: ImportantNumber) => {
    setShowErrors(false);
    setDraft({ id: n.id, group: n.group, label: n.label, phone: n.phone });
  };
  const save = () => {
    if (!draft) return;
    if (hasNumberErrors(errors)) {
      setShowErrors(true);
      return;
    }
    const n: ImportantNumber = { id: draft.id ?? newId('num'), group: draft.group, label: draft.label, phone: draft.phone };
    setRaw((old: unknown) => upsertNumber(cleanNumbers(old), n));
    setDraft(null);
  };
  const askDelete = (n: ImportantNumber) =>
    Alert.alert(t('trouble.numbers.deleteTitle', { label: n.label }), t('trouble.numbers.deleteBody'), [
      { text: t('trouble.numbers.cancel'), style: 'cancel' },
      {
        text: t('trouble.numbers.delete'),
        style: 'destructive',
        onPress: () => {
          setRaw((old: unknown) => removeNumber(cleanNumbers(old), n.id));
          if (draft?.id === n.id) setDraft(null);
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
      keyboardShouldPersistTaps="handled"
    >
      <FadeInView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <IconBadge name="call" tone="teal" size="l" />
          <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{t('trouble.numbers.intro')}</Text>
        </View>
      </FadeInView>

      {draft ? (
        <Card style={{ gap: space.m }}>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {draft.id ? t('trouble.numbers.editTitle') : t('trouble.numbers.newTitle')}
          </Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{t('trouble.numbers.group')}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {NUMBER_GROUPS.map((g) => (
              <Chip key={g} label={t(`trouble.group.${g}` as Key)} selected={draft.group === g} onPress={() => setDraft({ ...draft, group: g })} />
            ))}
          </View>
          <TextField
            label={t('trouble.numbers.label')}
            value={draft.label}
            onChange={(v) => setDraft({ ...draft, label: v })}
            placeholder={t('trouble.numbers.labelPlaceholder')}
            error={showErrors && errors.label ? t(LABEL_ERR[errors.label]) : undefined}
          />
          <TextField
            label={t('trouble.numbers.phone')}
            value={draft.phone}
            onChange={(v) => setDraft({ ...draft, phone: v })}
            placeholder={t('trouble.numbers.phonePlaceholder')}
            inputMode="tel"
            error={showErrors && errors.phone ? t(PHONE_ERR[errors.phone]) : undefined}
          />
          <Body muted>{t('trouble.numbers.tip')}</Body>
          <Button icon="checkmark" label={t('trouble.numbers.save')} hint={t('trouble.numbers.saveHint')} onPress={save} />
          <Button kind="quiet" label={t('trouble.numbers.cancel')} hint={t('trouble.numbers.cancelHint')} onPress={() => setDraft(null)} />
        </Card>
      ) : (
        <Button icon="add" label={t('trouble.numbers.add')} hint={t('trouble.numbers.addHint')} onPress={startAdd} />
      )}

      {groups.length === 0 && !draft ? <EmptyState art="lifebuoy" title={t('trouble.numbers.emptyTitle')} body={t('trouble.numbers.emptyBody')} /> : null}

      {groups.map(({ group, numbers: list }) => (
        <View key={group} style={{ gap: space.s }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <IconBadge name={GROUP_ICON[group]} tone={GROUP_TONE[group]} size="s" />
            <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
              {t(`trouble.group.${group}` as Key)}
            </Text>
          </View>
          {list.map((n) => (
            <View
              key={n.id}
              style={[
                elevated(theme, 'low'),
                { flexDirection: 'row', alignItems: 'center', borderRadius: radius.l, paddingRight: space.xs },
              ]}
            >
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('trouble.numbers.rowA11y', { label: n.label, phone: n.phone })}
                accessibilityHint={t('trouble.numbers.rowHint')}
                onPress={() => callAndExplain(n.phone, t)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: TOUCH }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{n.label}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted, fontVariant: ['tabular-nums'] }}>{n.phone}</Text>
                </View>
                <Ionicons name="call" size={22} color={theme.ok} />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('trouble.numbers.edit')}
                accessibilityHint={t('trouble.numbers.editHint', { label: n.label })}
                onPress={() => startEdit(n)}
                style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="create-outline" size={22} color={theme.muted} />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('trouble.numbers.delete')}
                accessibilityHint={t('trouble.numbers.deleteHint', { label: n.label })}
                onPress={() => askDelete(n)}
                style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </PressableScale>
            </View>
          ))}
        </View>
      ))}

      <Body muted>{t('trouble.offline')}</Body>
    </ScrollView>
  );
}
