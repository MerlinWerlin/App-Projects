// T109 Stay details for one stay booking: check-in / check-out from the booking, room number, door / key-box / gate
// codes (masked until tapped; optional Face ID through the vault's auth helper), Wi-Fi with a "Join this Wi-Fi" QR
// code drawn by the offline encoder (src/core/qr.ts via BarcodeView) and Copy password, reception phone with
// tap-to-call, an Apple Maps link to the address, "Show to a taxi" (the address card) and house notes.
// Stored on this phone only, one key per booking (src/state/stay.ts); never part of a .satchel trip file.
// View and edit share the screen; switching fades in (timed, no springs).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert, Linking, Text, useWindowDimensions, View } from 'react-native';
import { formatDay, formatTime } from '../../src/core/format.ts';
import {
  appleMapsAddressUrl,
  CODE_FIELDS,
  dialable,
  EMPTY_STAY,
  isEmptyStay,
  isStay,
  mayReveal,
  NOTE_FIELDS,
  savedCodes,
  shownCode,
  WIFI_SECURITIES,
  wifiQr,
  type AuthOutcome,
  type CodeField,
  type StayDetails,
} from '../../src/core/staydetails.ts';
import { localDate } from '../../src/core/tz.ts';
import { authenticate, CANNOT_LOCK } from '../../src/native/auth.ts';
import { clipboardAvailable, copyText } from '../../src/native/clipboard.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveStay, useStayDetails } from '../../src/state/stay.ts';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space } from '../../src/theme/tokens.ts';
import { BarcodeView } from '../../src/ui/Barcode.tsx';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { FadeInView, HeroHeader, SectionCard, SectionHeader } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen, TextField, ToggleRow, Warning } from '../../src/ui/kit.tsx';

export default function StayScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = itemId ?? '';
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [details, loaded] = useStayDetails(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StayDetails>(EMPTY_STAY);
  const [revealed, setRevealed] = useState<Partial<Record<CodeField, boolean>>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [copy, setCopy] = useState<'copied' | 'failed' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const found = findItem(trips, id);
  if (!found || !isStay(found.item)) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('stay.title')} body={t(found ? 'stay.notStay' : 'stay.notFound')} />
      </Screen>
    );
  }
  const { item } = found;
  const name = item.place?.name?.trim() || item.title;

  const startEdit = () => {
    setDraft(details);
    setSaveFailed(false);
    setEditing(true);
  };
  const save = async () => {
    if (!(await saveStay(item.id, draft))) {
      setSaveFailed(true);
      return;
    }
    setEditing(false);
    setRevealed({});
  };
  const set = <K extends keyof StayDetails>(k: K, v: StayDetails[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const toggleCode = async (f: CodeField) => {
    if (revealed[f]) {
      setRevealed((r) => ({ ...r, [f]: false }));
      return;
    }
    const needsAuth = details.lockCodes && !unlocked;
    let auth: AuthOutcome | null = null;
    if (needsAuth) {
      const r = await authenticate(t('stay.authPrompt'), t('common.cancel'));
      auth = r.ok ? { ok: true } : { ok: false, cannotLock: CANNOT_LOCK.includes(r.reason) };
    }
    if (!mayReveal(needsAuth, auth)) {
      setAuthFailed(true);
      AccessibilityInfo.announceForAccessibility(t('stay.authFailed'));
      return;
    }
    setAuthFailed(false);
    if (needsAuth) setUnlocked(true);
    setRevealed((r) => ({ ...r, [f]: true }));
  };

  const copyPassword = async () => {
    const ok = await copyText(details.wifiPassword);
    setCopy(ok ? 'copied' : 'failed');
    AccessibilityInfo.announceForAccessibility(t(ok ? 'stay.copied' : 'stay.copyFailed'));
  };

  const mapsUrl = appleMapsAddressUrl(item.place);
  const openMaps = async () => {
    if (!mapsUrl) return;
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert(t('stay.mapsFailed'));
    }
  };
  const phone = details.phone && dialable(details.phone) ? details.phone : '';
  const hasAddress = !!(item.place?.address?.trim() || item.place?.localAddress?.trim());

  const valueText = (v: string, big = false) => (
    <Text selectable style={{ fontFamily: big ? fonts.display : fonts.bodyBold, fontSize: big ? 30 : 18, color: theme.ink, fontVariant: ['tabular-nums'] }}>
      {v}
    </Text>
  );

  const times = (
    <SectionCard title={t('stay.times')} icon="time-outline" tone="sea">
      <Body>{t('stay.checkIn', { day: formatDay(localDate(item.start.local), lang), time: formatTime(item.start.local) })}</Body>
      {item.end ? <Body>{t('stay.checkOut', { day: formatDay(localDate(item.end.local), lang), time: formatTime(item.end.local) })}</Body> : null}
    </SectionCard>
  );

  let body;
  if (!loaded) {
    body = null;
  } else if (editing) {
    body = (
      <FadeInView key="edit" style={{ gap: space.l }}>
        <SectionCard title={t('stay.room')} icon="bed-outline" tone="teal">
          <TextField label={t('stay.room')} value={draft.room} onChange={(v) => set('room', v)} placeholder={t('stay.form.roomPlaceholder')} autoCapitalize="none" />
        </SectionCard>
        <SectionCard title={t('stay.codes')} icon="keypad-outline" tone="teal">
          {CODE_FIELDS.map((f) => (
            <TextField key={f} label={t(`stay.code.${f}`)} value={draft[f]} onChange={(v) => set(f, v)} placeholder={t('stay.form.codePlaceholder')} autoCapitalize="none" />
          ))}
          <ToggleRow label={t('stay.form.lock')} hint={t('stay.form.lockHint')} value={draft.lockCodes} onChange={(v) => set('lockCodes', v)} />
        </SectionCard>
        <SectionCard title={t('stay.wifi')} icon="wifi-outline" tone="sea">
          <TextField label={t('stay.wifiName')} value={draft.wifiName} onChange={(v) => set('wifiName', v)} autoCapitalize="none" />
          <Label>{t('stay.form.security')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('stay.form.security')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {WIFI_SECURITIES.map((sec) => (
              <Chip key={sec} label={t(`stay.form.sec.${sec}`)} hint={t('stay.form.secHint')} selected={draft.wifiSecurity === sec} onPress={() => set('wifiSecurity', sec)} />
            ))}
          </View>
          {draft.wifiSecurity !== 'nopass' ? (
            <TextField label={t('stay.wifiPassword')} value={draft.wifiPassword} onChange={(v) => set('wifiPassword', v)} autoCapitalize="none" />
          ) : null}
          <ToggleRow label={t('stay.form.hidden')} hint={t('stay.form.hiddenHint')} value={draft.wifiHidden} onChange={(v) => set('wifiHidden', v)} />
        </SectionCard>
        <SectionCard title={t('stay.contact')} icon="call-outline" tone="accent">
          <TextField label={t('stay.form.phone')} value={draft.phone} onChange={(v) => set('phone', v)} inputMode="tel" />
        </SectionCard>
        <SectionCard title={t('stay.notes')} icon="document-text-outline" tone="ok">
          {NOTE_FIELDS.map((f) => (
            <TextField key={f} label={t(`stay.note.${f}`)} value={draft[f]} onChange={(v) => set(f, v)} multiline />
          ))}
        </SectionCard>
        {saveFailed ? <Warning text={t('stay.err.save')} /> : null}
        <Button icon="checkmark" label={t('stay.form.save')} hint={t('stay.form.saveHint')} onPress={save} />
        <Button kind="quiet" label={t('stay.form.cancel')} hint={t('stay.form.cancelHint')} onPress={() => setEditing(false)} />
      </FadeInView>
    );
  } else if (isEmptyStay(details)) {
    body = (
      <FadeInView key="empty" style={{ gap: space.l }}>
        {times}
        <EmptyState art="suitcase" title={t('stay.emptyTitle')} body={t('stay.emptyBody')} action={<Button icon="add" label={t('stay.add')} hint={t('stay.addHint')} onPress={startEdit} />} />
        {hasAddress ? <Button kind="secondary" icon="car-outline" label={t('stay.taxi')} hint={t('stay.taxiHint')} onPress={() => router.push({ pathname: '/address/[id]', params: { id: item.id } })} /> : null}
      </FadeInView>
    );
  } else {
    const qr = wifiQr(details);
    const codes = savedCodes(details);
    const notes = NOTE_FIELDS.filter((f) => !!details[f]);
    body = (
      <FadeInView key="view" style={{ gap: space.l }}>
        {times}
        {details.room || codes.length ? (
          <SectionCard title={t('stay.codes')} icon="key-outline" tone="teal">
            {details.room ? (
              <View accessible accessibilityLabel={`${t('stay.room')}, ${details.room}`} style={{ gap: 2 }}>
                <Label>{t('stay.room')}</Label>
                {valueText(details.room, true)}
              </View>
            ) : null}
            {codes.map((f) => {
              const label = t(`stay.code.${f}`);
              const open = !!revealed[f];
              return (
                <PressableScale
                  key={f}
                  accessibilityRole="button"
                  accessibilityLabel={open ? `${label}, ${details[f]}` : t('stay.code.hidden', { label })}
                  accessibilityHint={t(open ? 'stay.code.hideHint' : 'stay.code.showHint')}
                  onPress={() => toggleCode(f)}
                  style={{ borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: space.m, paddingVertical: space.s, gap: 2 }}
                >
                  <Label>{label}</Label>
                  {valueText(shownCode(details[f], open), true)}
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.sea }}>{t(open ? 'stay.code.tapToHide' : 'stay.code.tapToShow')}</Text>
                </PressableScale>
              );
            })}
            {authFailed ? <Warning text={t('stay.authFailed')} /> : null}
          </SectionCard>
        ) : null}

        {details.wifiName ? (
          <SectionCard title={t('stay.wifi')} icon="wifi-outline" tone="sea">
            <View style={{ gap: 2 }}>
              <Label>{t('stay.wifiName')}</Label>
              {valueText(details.wifiName)}
              {details.wifiHidden ? <Body muted>{t('stay.wifiHiddenNote')}</Body> : null}
            </View>
            {details.wifiSecurity === 'nopass' ? (
              <Body muted>{t('stay.wifiOpen')}</Body>
            ) : details.wifiPassword ? (
              <View style={{ gap: 2 }}>
                <Label>{t('stay.wifiPassword')}</Label>
                {valueText(details.wifiPassword)}
                {clipboardAvailable() ? <Button kind="quiet" icon="copy-outline" label={t('stay.copyPassword')} hint={t('stay.copyPasswordHint')} onPress={copyPassword} /> : null}
                {copy ? (
                  <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: copy === 'copied' ? theme.ok : theme.ink }}>
                    {t(copy === 'copied' ? 'stay.copied' : 'stay.copyFailed')}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <SectionHeader title={t('stay.join')} icon="qr-code-outline" tone="sea" />
            {!qr ? (
              <Body muted>{t('stay.qrNeedsPassword')}</Body>
            ) : qr.drawable ? (
              <View style={{ alignItems: 'center', gap: space.s }}>
                <BarcodeView type="qr" value={qr.payload} maxWidth={Math.min(width - space.l * 4, 320)} label={t('stay.qrLabel', { name: details.wifiName })} />
                <Body muted>{t('stay.joinBody')}</Body>
              </View>
            ) : (
              <Body muted>{t('stay.qrTooLong')}</Body>
            )}
          </SectionCard>
        ) : null}

        <SectionCard title={t('stay.contact')} icon="call-outline" tone="accent">
          {phone ? <Button kind="secondary" icon="call" label={t('stay.call', { number: phone })} hint={t('stay.callHint')} onPress={() => callAndExplain(phone, t)} /> : null}
          {mapsUrl ? <Button kind="quiet" icon="map-outline" label={t('stay.maps')} hint={t('stay.mapsHint')} onPress={openMaps} /> : null}
          {hasAddress ? <Button kind="quiet" icon="car-outline" label={t('stay.taxi')} hint={t('stay.taxiHint')} onPress={() => router.push({ pathname: '/address/[id]', params: { id: item.id } })} /> : null}
        </SectionCard>

        {notes.length ? (
          <SectionCard title={t('stay.notes')} icon="document-text-outline" tone="ok">
            {notes.map((f) => (
              <View key={f} style={{ gap: 2 }}>
                <Label>{t(`stay.note.${f}`)}</Label>
                <Body>{details[f]}</Body>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <Button kind="secondary" icon="create-outline" label={t('stay.edit')} hint={t('stay.editHint')} onPress={startEdit} />
      </FadeInView>
    );
  }

  return (
    <Screen>
      <HeroHeader tone="trips" compact illustration="route" eyebrow={t('stay.title')} title={name} subtitle={t('stay.phoneOnly')} />
      {body}
    </Screen>
  );
}
