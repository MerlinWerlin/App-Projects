// T97 "I'm safe / Share where I am" (owner-1031 D, deepen Emergency). One location check on request (never
// background, never on a timer) gives the position as decimal degrees, degrees-minutes-seconds and a Plus Code with
// its accuracy, plus "near <hotel / saved place>" within 300 m. "Read this to the operator" shows it in large type
// (screen kept awake while open). A message template (I'm safe, I've landed, Running late, I need help) is filled
// with the time, the position, an Apple Maps link and the current hotel's address; the person can edit it, then
// opens Messages (sms: link with the body, works on a phone signal without data) or the share sheet. Nothing is
// sent automatically. Up to 5 trusted contacts are kept only on this phone (src/state/safeContacts.ts).
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { currentHotel } from '../src/core/battery.ts';
import { newId } from '../src/core/model.ts';
import {
  addContact,
  clockStamp,
  composeMessage,
  dmsPart,
  encodeOlc,
  formatDms,
  MAX_CONTACTS,
  nearCandidates,
  nearestPlace,
  removeContact,
  roundAccuracy,
  smsUrl,
  spellCode,
  TEMPLATE_KINDS,
  type Hemispheres,
  type SafeContact,
  type TemplateKind,
} from '../src/core/safecheck.ts';
import type { Key } from '../src/i18n/en.ts';
import { pickContact } from '../src/native/contacts.ts';
import { haptic } from '../src/native/device.ts';
import { useScreenAwake } from '../src/native/keepAwake.ts';
import { locateOnce, type LocateResult } from '../src/native/location.ts';
import { shareText } from '../src/native/share.ts';
import { openSms, smsPlatform } from '../src/native/sms.ts';
import { useApp } from '../src/state/app.tsx';
import { saveSafeContacts, useSafeContacts } from '../src/state/safeContacts.ts';
import { useTrips } from '../src/state/trips.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, SectionCard } from '../src/ui/hero.tsx';
import { Body, Button, Chip, Label, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { PermissionNotice } from '../src/ui/PermissionNotice.tsx';

type Fix = { lat: number; lon: number; accuracy: number | null; at: number };
type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; fix: Fix } | { state: 'failed'; result: Extract<LocateResult, { ok: false }> };

const offsetAt = (ms: number) => -new Date(ms).getTimezoneOffset();

export default function SafeScreen() {
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const [contacts] = useSafeContacts();
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [lastFix, setLastFix] = useState<Fix | null>(null);
  const [operator, setOperator] = useState(false);
  const [kind, setKind] = useState<TemplateKind>('safe');
  const [draft, setDraft] = useState<string | null>(null); // null: follow the template
  const [stampMs, setStampMs] = useState(() => Date.now());
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const busy = useRef(false);

  const hemi: Hemispheres = { n: t('safe.hemi.n'), s: t('safe.hemi.s'), e: t('safe.hemi.e'), w: t('safe.hemi.w') };
  const fix = lastFix;
  const near = useMemo(() => (fix ? nearestPlace(fix, nearCandidates(trips)) : null), [fix, trips]);
  // Not memoised: a cheap scan, and the stay "now" depends on the clock.
  const hotel = currentHotel(trips, Date.now());
  const hotelText = hotel
    ? [hotel.item.place?.name?.trim() || hotel.item.title, hotel.item.place?.address?.trim() || hotel.item.place?.localAddress?.trim()].filter(Boolean).join(', ')
    : '';

  const templateText = composeMessage(
    {
      head: t(`safe.tpl.${kind}.message` as Key),
      time: t('safe.msg.time'),
      near: t('safe.msg.near'),
      coords: t('safe.msg.coords'),
      accuracy: t('safe.msg.accuracy'),
      plus: t('safe.msg.plus'),
      map: t('safe.msg.map'),
      noFix: t('safe.msg.noFix'),
      hotel: t('safe.msg.hotel'),
    },
    {
      time: clockStamp(fix?.at ?? stampMs, offsetAt(fix?.at ?? stampMs)),
      position: fix,
      near: near?.name ?? null,
      hotel: hotelText || null,
    },
  );
  const message = draft ?? templateText;
  const recipients = contacts.filter((c) => !skipped.has(c.id));

  const locate = async () => {
    if (busy.current) return;
    busy.current = true;
    setCheck({ state: 'checking' });
    const r = await locateOnce();
    busy.current = false;
    if (r.ok) {
      const f: Fix = { ...r.coords, at: Date.now() };
      haptic.success();
      setLastFix(f);
      setDraft(null);
      setCheck({ state: 'ok', fix: f });
    } else {
      setCheck({ state: 'failed', result: r });
    }
  };

  const chooseKind = (k: TemplateKind) => {
    setKind(k);
    setDraft(null);
    setStampMs(Date.now());
  };

  const addFrom = async (draftContact: { name?: string | null; phone?: string | null }) => {
    setContactError(null);
    const r = addContact(contacts, draftContact, newId('safe'));
    if (!r.ok) {
      setContactError(t(`safe.contacts.err.${r.reason}` as Key));
      return false;
    }
    const saved = await saveSafeContacts(() => r.list);
    if (!saved) {
      setContactError(t('safe.contacts.err.save'));
      return false;
    }
    haptic.success();
    return true;
  };

  const pick = async () => {
    setContactError(null);
    const r = await pickContact();
    if (r.ok) {
      if (!r.contact.phone) setContactError(t('safe.contacts.err.noPhone'));
      else await addFrom({ name: r.contact.name, phone: r.contact.phone });
    } else if (r.reason === 'denied') setContactError(t('safe.contacts.err.denied'));
    else if (r.reason !== 'cancelled') setContactError(t('safe.contacts.err.pick'));
  };

  const addTyped = async () => {
    if (await addFrom({ name, phone })) {
      setName('');
      setPhone('');
    }
  };

  const remove = async (c: SafeContact) => {
    setContactError(null);
    if (!(await saveSafeContacts((old) => removeContact(old, c.id)))) setContactError(t('safe.contacts.err.save'));
  };

  const toggle = (c: SafeContact) =>
    setSkipped((old) => {
      const next = new Set(old);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });

  const sendSms = async () => {
    setSendError(null);
    if (!message.trim()) return setSendError(t('safe.send.empty'));
    const ok = await openSms(smsUrl(recipients.map((c) => c.phone), message, smsPlatform()));
    if (!ok) setSendError(t('safe.send.smsFailed'));
  };

  const share = async () => {
    setSendError(null);
    if (!message.trim()) return setSendError(t('safe.send.empty'));
    if ((await shareText(message, t('safe.title'))) === 'failed') setSendError(t('safe.send.shareFailed'));
  };

  if (operator && fix) return <OperatorView fix={fix} near={near?.name ?? null} hotel={hotelText} hemi={hemi} onDone={() => setOperator(false)} />;

  const smsLabel =
    recipients.length === 1
      ? t('safe.send.smsOne', { name: recipients[0].name || recipients[0].phone })
      : recipients.length > 1
        ? t('safe.send.smsCount', { n: recipients.length })
        : t('safe.send.sms');

  return (
    <Screen>
      <FadeInView>
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
            {t('safe.title')}
          </Text>
          <Body muted>{t('safe.intro')}</Body>
        </View>
      </FadeInView>

      <SectionCard title={t('safe.where.title')} icon="location-outline" tone="sea">
        {check.state === 'checking' ? (
          <Text accessibilityLiveRegion="polite" style={[typeScale.body, { color: theme.muted }]}>
            {t('safe.where.checking')}
          </Text>
        ) : null}
        {check.state === 'failed' && check.result.reason === 'denied' ? (
          <PermissionNotice
            kind="location"
            state={check.result.state}
            reason={t('safe.where.deniedReason')}
            onRetry={check.result.state === 'ask' ? locate : undefined}
          />
        ) : null}
        {check.state === 'failed' && check.result.reason === 'unavailable' ? (
          <Warning text={check.result.servicesOff ? t('safe.where.servicesOff') : t('safe.where.unavailable')} />
        ) : null}
        {fix ? (
          <FixDetails fix={fix} near={near ? { name: near.name, meters: near.meters } : null} hemi={hemi} />
        ) : check.state !== 'checking' ? (
          <Body muted>{t('safe.where.none')}</Body>
        ) : null}
        <Button
          kind={fix ? 'secondary' : 'primary'}
          icon="locate-outline"
          label={fix ? t('safe.where.again') : t('safe.where.check')}
          hint={t('safe.where.checkHint')}
          onPress={locate}
        />
        {fix ? <Button kind="quiet" icon="call-outline" label={t('safe.operator.open')} hint={t('safe.operator.openHint')} onPress={() => setOperator(true)} /> : null}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('safe.verify')}</Text>
      </SectionCard>

      <SectionCard title={t('safe.tpl.title')} icon="chatbubble-ellipses-outline" tone="ok">
        <View accessibilityRole="radiogroup" accessibilityLabel={t('safe.tpl.pick')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {TEMPLATE_KINDS.map((k) => (
            <Chip key={k} label={t(`safe.tpl.${k}.label` as Key)} selected={kind === k} hint={t('safe.tpl.pickHint')} onPress={() => chooseKind(k)} />
          ))}
        </View>
        <TextField label={t('safe.msg.field')} value={message} onChange={setDraft} multiline />
        {draft !== null && draft !== templateText ? (
          <Button
            kind="quiet"
            icon="refresh-outline"
            label={t('safe.msg.reset')}
            hint={t('safe.msg.resetHint')}
            onPress={() => {
              setDraft(null);
              setStampMs(Date.now());
            }}
          />
        ) : null}
      </SectionCard>

      <SectionCard title={t('safe.contacts.title')} icon="people-outline" tone="teal">
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('safe.contacts.privacy')}</Text>
        {contacts.length === 0 ? <Body muted>{t('safe.contacts.empty')}</Body> : null}
        {contacts.map((c) => {
          const label = c.name || c.phone;
          const on = !skipped.has(c.id);
          return (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityLabel={t('safe.contacts.select', { name: label })}
                accessibilityHint={t('safe.contacts.selectHint')}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(c)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.m,
                  paddingHorizontal: space.m,
                  borderRadius: radius.m,
                  borderWidth: 1,
                  borderColor: on ? theme.accent : theme.line,
                  backgroundColor: on ? theme.accentSoft : theme.card,
                }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.accentInk : theme.muted} />
                <View style={{ flex: 1, paddingVertical: space.xs }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{label}</Text>
                  {c.name ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{c.phone}</Text> : null}
                </View>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('safe.contacts.remove', { name: label })}
                accessibilityHint={t('safe.contacts.removeHint')}
                onPress={() => remove(c)}
                style={{ width: TOUCH, alignItems: 'center' }}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </PressableScale>
            </View>
          );
        })}
        {contacts.length < MAX_CONTACTS ? (
          <View style={{ gap: space.s }}>
            <Button kind="secondary" icon="person-add-outline" label={t('safe.contacts.pick')} hint={t('safe.contacts.pickHint')} onPress={pick} />
            <TextField label={t('safe.contacts.name')} value={name} onChange={setName} autoCapitalize="words" />
            <TextField label={t('safe.contacts.phone')} value={phone} onChange={setPhone} inputMode="tel" placeholder={t('safe.contacts.phonePlaceholder')} />
            <Button kind="quiet" icon="add-outline" label={t('safe.contacts.add')} hint={t('safe.contacts.addHint')} onPress={addTyped} />
          </View>
        ) : (
          <Body muted>{t('safe.contacts.full')}</Body>
        )}
        {contactError ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
            {contactError}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title={t('safe.send.title')} icon="send-outline" tone="accent">
        <Button icon="chatbox-outline" label={smsLabel} hint={t('safe.send.smsHint')} onPress={sendSms} />
        <Button kind="secondary" icon="share-outline" label={t('safe.send.share')} hint={t('safe.send.shareHint')} onPress={share} />
        {sendError ? <Warning text={sendError} /> : null}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('safe.send.smsNote')}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('safe.send.manual')}</Text>
      </SectionCard>
    </Screen>
  );
}

function Row({ label, value, a11y }: { label: string; value: string; a11y?: string }) {
  const { theme } = useApp();
  return (
    <View accessible accessibilityLabel={`${label}: ${a11y ?? value}`} style={{ gap: 2 }}>
      <Label>{label}</Label>
      <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
        {value}
      </Text>
    </View>
  );
}

function FixDetails({ fix, near, hemi }: { fix: Fix; near: { name: string; meters: number } | null; hemi: Hemispheres }) {
  const { t, theme } = useApp();
  const plus = encodeOlc(fix.lat, fix.lon);
  const acc = roundAccuracy(fix.accuracy);
  return (
    <View style={{ gap: space.m }}>
      <View accessible accessibilityLabel={t('safe.where.plusA11y', { spelled: spellCode(plus) })} style={{ gap: 2 }}>
        <Label>{t('safe.where.plus')}</Label>
        <Text selectable style={[typeScale.displayM, { color: theme.ink, letterSpacing: 1 }]}>
          {plus}
        </Text>
      </View>
      <Row label={t('safe.where.decimal')} value={`${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`} />
      <Row label={t('safe.where.dms')} value={formatDms(fix.lat, fix.lon, hemi)} />
      <Text style={[typeScale.small, { color: theme.muted }]}>
        {acc ? t('safe.where.accuracy', { n: acc }) : t('safe.where.accuracyUnknown')}
        {' · '}
        {t('safe.where.checkedAt', { time: clockStamp(fix.at, offsetAt(fix.at)) })}
      </Text>
      {near ? (
        <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('safe.where.near', { place: near.name, n: Math.max(10, Math.round(near.meters / 10) * 10) })}</Text>
      ) : null}
    </View>
  );
}

/** Large, high-contrast read-out for an emergency call. The screen stays awake while it is open. */
function OperatorView({ fix, near, hotel, hemi, onDone }: { fix: Fix; near: string | null; hotel: string; hemi: Hemispheres; onDone: () => void }) {
  const { t, theme } = useApp();
  useScreenAwake('safe-operator');
  const plus = encodeOlc(fix.lat, fix.lon);
  const lat = dmsPart(fix.lat, true, hemi);
  const lon = dmsPart(fix.lon, false, hemi);
  const latText = t(lat.hemi === hemi.s ? 'safe.operator.south' : 'safe.operator.north', { v: Math.abs(fix.lat).toFixed(5) });
  const lonText = t(lon.hemi === hemi.w ? 'safe.operator.west' : 'safe.operator.east', { v: Math.abs(fix.lon).toFixed(5) });
  const big = { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: theme.ink } as const;
  const acc = roundAccuracy(fix.accuracy);
  return (
    <Screen>
      <Text accessibilityRole="header" style={[typeScale.displayL, { color: theme.ink }]}>
        {t('safe.operator.title')}
      </Text>
      <View accessible accessibilityLabel={t('safe.where.plusA11y', { spelled: spellCode(plus) })} style={{ gap: space.xs }}>
        <Label>{t('safe.where.plus')}</Label>
        <Text style={[big, { fontSize: 40, lineHeight: 48, letterSpacing: 2 }]}>{plus}</Text>
      </View>
      <View accessible accessibilityLabel={`${t('safe.operator.lat')}: ${latText}`} style={{ gap: space.xs }}>
        <Label>{t('safe.operator.lat')}</Label>
        <Text style={big}>{latText}</Text>
      </View>
      <View accessible accessibilityLabel={`${t('safe.operator.lon')}: ${lonText}`} style={{ gap: space.xs }}>
        <Label>{t('safe.operator.lon')}</Label>
        <Text style={big}>{lonText}</Text>
      </View>
      <Text style={[typeScale.title, { color: theme.ink }]}>{formatDms(fix.lat, fix.lon, hemi)}</Text>
      <Text style={[typeScale.body, { color: theme.muted }]}>{acc ? t('safe.where.accuracy', { n: acc }) : t('safe.where.accuracyUnknown')}</Text>
      {near ? (
        <View accessible style={{ gap: space.xs }}>
          <Label>{t('safe.operator.near')}</Label>
          <Text style={[typeScale.displayM, { color: theme.ink }]}>{near}</Text>
        </View>
      ) : null}
      {hotel ? (
        <View accessible style={{ gap: space.xs }}>
          <Label>{t('safe.operator.hotel')}</Label>
          <Text style={[typeScale.displayM, { color: theme.ink }]}>{hotel}</Text>
        </View>
      ) : null}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('safe.verify')}</Text>
      <Button label={t('safe.operator.done')} hint={t('safe.operator.doneHint')} onPress={onDone} />
    </Screen>
  );
}
