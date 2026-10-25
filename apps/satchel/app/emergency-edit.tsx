// Edit emergency card: insurer, policy, insurer phone, emergency contacts (typed, or one picked with the system
// contact picker), private medical notes. Saved only on this phone. Leaving with unsaved changes asks first.
// T41: a failed check is announced; Save, Cancel and Remove contact say what they do (ACCESSIBILITY "Edit emergency card").
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { cleanCard, EMERGENCY_KEY, EMPTY_CARD, hasErrors, normaliseCard, sameCard, validateCard, type CardErrors } from '../src/core/emergency.ts';
import { newId, type EmergencyCard, type EmergencyContact } from '../src/core/model.ts';
import type { PermissionState } from '../src/core/permissions.ts';
import { pickContact } from '../src/native/contacts.ts';
import { useApp } from '../src/state/app.tsx';
import { usePersisted } from '../src/state/persisted.ts';
import { fonts, space } from '../src/theme/tokens.ts';
import { Body, Button, Card, Label, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { PermissionNotice } from '../src/ui/PermissionNotice.tsx';

export default function EmergencyEditScreen() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [stored, setStored, loaded] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const [draft, setDraft] = useState<EmergencyCard>(() => normaliseCard(stored));
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<CardErrors | null>(null);
  /** Contacts refused or the picker missing: PermissionNotice with "type the contact by hand". */
  const [contactsPerm, setContactsPerm] = useState<Exclude<PermissionState, 'granted'> | null>(null);

  // Header back, Android back, swipe-down and Cancel all ask before throwing away changes (src/ui/discardConfirm.ts).
  const { leaving, gestureEnabled } = useDiscardConfirm(touched && !sameCard(draft, normaliseCard(stored)));

  // The store may finish loading after first render; take its value until the user starts typing.
  useEffect(() => {
    if (loaded && !touched) setDraft(normaliseCard(stored));
  }, [loaded, stored, touched]);

  const update = (patch: Partial<EmergencyCard>) => {
    setTouched(true);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const updateContact = (id: string, patch: Partial<EmergencyContact>) => {
    setTouched(true);
    setDraft((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  };
  const addContact = (c?: Partial<EmergencyContact>) => {
    setTouched(true);
    setDraft((d) => ({ ...d, contacts: [...d.contacts, { id: newId('contact'), name: c?.name ?? '', phone: c?.phone ?? '', ...(c?.relation ? { relation: c.relation } : {}) }] }));
  };
  const removeContact = (c: EmergencyContact) => {
    const drop = () => {
      setTouched(true);
      setDraft((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== c.id) }));
    };
    if (!c.name.trim() && !c.phone.trim()) return drop();
    Alert.alert(t('emergency.edit.removeConfirm', { name: c.name.trim() || t('emergency.edit.unnamed') }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('emergency.edit.removeContact'), style: 'destructive', onPress: drop },
    ]);
  };

  const typeByHand = () => {
    setContactsPerm(null);
    addContact();
  };

  const pick = async () => {
    setContactsPerm(null);
    const r = await pickContact();
    if (r.ok) {
      addContact({ name: r.contact.name, phone: r.contact.phone ?? '' });
      if (!r.contact.phone) Alert.alert(t('emergency.contacts.noPhoneTitle'), t('emergency.contacts.noPhoneBody', { name: r.contact.name || t('emergency.edit.unnamed') }));
      return;
    }
    if (r.reason === 'cancelled') return;
    if (r.reason === 'denied' || r.reason === 'unavailable') {
      const p = r.permission && r.permission !== 'granted' ? r.permission : r.reason === 'denied' ? 'blocked' : 'unavailable';
      setContactsPerm(p);
      return;
    }
    Alert.alert(t('emergency.contacts.error'), undefined, [{ text: t('emergency.contacts.addManually'), onPress: () => addContact() }]);
  };

  const save = () => {
    const e = validateCard(draft);
    if (hasErrors(e)) {
      setErrors(e);
      AccessibilityInfo.announceForAccessibility(t('emergency.edit.errSummary'));
      return;
    }
    setStored(cleanCard(draft));
    leaving();
    router.back();
  };

  const contactErr = (id: string, which: 'name' | 'phone') =>
    errors?.contacts[id]?.includes(which) ? t(which === 'name' ? 'emergency.edit.errName' : 'emergency.edit.errPhone') : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled }} />
      {errors && hasErrors(errors) ? <Warning text={t('emergency.edit.errSummary')} /> : null}

      <Card>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {t('emergency.insuranceHeading')}
        </Text>
        <TextField label={t('emergency.insurer')} value={draft.insurer ?? ''} onChange={(v) => update({ insurer: v })} placeholder={t('emergency.edit.insurerPlaceholder')} autoCapitalize="words" />
        <TextField label={t('emergency.policy')} value={draft.policy ?? ''} onChange={(v) => update({ policy: v })} placeholder={t('emergency.edit.policyPlaceholder')} autoCapitalize="none" />
        <TextField
          label={t('emergency.insurerPhone')}
          value={draft.insurerPhone ?? ''}
          onChange={(v) => update({ insurerPhone: v })}
          placeholder={t('emergency.edit.phonePlaceholder')}
          inputMode="tel"
          error={errors?.insurerPhone ? t('emergency.edit.errPhone') : undefined}
        />
      </Card>

      <Card>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {t('emergency.contactsHeading')}
        </Text>
        {draft.contacts.length === 0 ? <Body muted>{t('emergency.contactsEmptyBody')}</Body> : null}
        {draft.contacts.map((c, i) => (
          <View key={c.id} style={{ gap: space.s, paddingVertical: space.s, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}>
            <Label>{t('emergency.edit.contactN', { n: i + 1 })}</Label>
            <TextField label={t('emergency.edit.contactName')} value={c.name} onChange={(v) => updateContact(c.id, { name: v })} autoCapitalize="words" error={contactErr(c.id, 'name')} />
            <TextField
              label={t('emergency.edit.contactPhone')}
              value={c.phone}
              onChange={(v) => updateContact(c.id, { phone: v })}
              placeholder={t('emergency.edit.phonePlaceholder')}
              inputMode="tel"
              error={contactErr(c.id, 'phone')}
            />
            <TextField
              label={t('emergency.edit.contactRelation')}
              value={c.relation ?? ''}
              onChange={(v) => updateContact(c.id, { relation: v })}
              placeholder={t('emergency.edit.contactRelationPlaceholder')}
            />
            <Button
              kind="quiet"
              label={t('emergency.edit.removeContactA11y', { name: c.name.trim() || t('emergency.edit.unnamed') })}
              hint={t('spec41.emergencyEdit.removeHint')}
              onPress={() => removeContact(c)}
            />
          </View>
        ))}
        <Button kind="quiet" label={t('emergency.edit.addContact')} hint={t('emergency.edit.addContactHint')} onPress={() => addContact()} />
        <Button kind="quiet" label={t('emergency.edit.pickContact')} hint={t('emergency.edit.pickContactHint')} onPress={pick} />
        {contactsPerm ? (
          <PermissionNotice kind="contacts" state={contactsPerm} onRetry={contactsPerm === 'ask' ? pick : undefined} onFallback={typeByHand} />
        ) : null}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {t('emergency.medicalHeading')}
        </Text>
        <Body muted>{t('emergency.edit.medicalPrivate')}</Body>
        <TextField label={t('emergency.medicalHeading')} value={draft.medicalNotes ?? ''} onChange={(v) => update({ medicalNotes: v })} placeholder={t('emergency.edit.medicalPlaceholder')} multiline />
      </Card>

      <Button label={t('emergency.edit.save')} hint={t('spec41.emergencyEdit.saveHint')} onPress={save} />
      <Button kind="quiet" label={t('common.cancel')} hint={t('spec41.form.cancelHint')} onPress={() => router.back()} />
    </Screen>
  );
}
