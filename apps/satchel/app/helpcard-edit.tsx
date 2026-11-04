// T121 add or edit one person's help cards: name, who to call (picked from Contacts or typed), the meeting point, an
// optional photo (camera or Photos, copied into Satchel and kept on this phone only) and their access needs (six
// ticks plus free text). The hotel is not typed here: the card reads it from the current stay booking.
// Params: ?id= edits that person; ?companionId=&tripId= starts a new card from a companion's name.
// Photos picked and then not saved are deleted again (Cancel, and T123: any other way the sheet goes away unsaved,
// such as a swipe down or the back gesture); a replaced or removed photo is deleted once the save succeeds. The saved
// card's own photo is never deleted on a dismiss (src/core/followups100.ts unsavedHelpPhotos).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Image, Text, View } from 'react-native';
import { draftForCompanion, draftOf, EMPTY_DRAFT, NEED_IDS, parseIdParam, removePerson, savePerson, toggleNeed, type NeedId, type PersonDraft } from '../src/core/helpcards.ts';
import { unsavedHelpPhotos } from '../src/core/followups100.ts';
import { newId } from '../src/core/model.ts';
import { readCompanions } from '../src/core/together.ts';
import type { Key } from '../src/i18n/en.ts';
import { pickContact } from '../src/native/contacts.ts';
import { haptic, openSettings } from '../src/native/device.ts';
import { helpPhotoPath, pickHelpPhoto, removeHelpPhoto } from '../src/native/helpcardPhoto.ts';
import { useApp } from '../src/state/app.tsx';
import { saveHelpPeople, useHelpPeople } from '../src/state/helpcards.ts';
import { useTrips } from '../src/state/trips.tsx';
import { fonts, radius, space, typeScale } from '../src/theme/tokens.ts';
import { SectionCard } from '../src/ui/hero.tsx';
import { Body, Button, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';

const NEED_KEY = (id: NeedId) => `helpcards.need.${id}` as Key;

export default function HelpCardEditScreen() {
  const params = useLocalSearchParams<{ id?: string; companionId?: string; tripId?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [people, loaded] = useHelpPeople();
  const editId = parseIdParam(params.id);
  const existing = editId ? (people.find((p) => p.id === editId) ?? null) : null;
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picked = useRef<string[]>([]);
  const busy = useRef(false);
  // T123: what a dismiss must keep (the saved card's photo, and the one a save in flight is writing).
  const savedPhoto = useRef<string | null>(null);
  savedPhoto.current = existing?.photoUri ?? null;
  const writing = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      const gone = unsavedHelpPhotos(picked.current, [savedPhoto.current, writing.current]);
      // A save still writing keeps its photo in the list, so a failed save can delete it afterwards.
      picked.current = picked.current.filter((u) => u === writing.current);
      if (gone.length) Promise.all(gone.map((u) => removeHelpPhoto(u))).catch(() => {});
    },
    [],
  );

  // The form starts once the store has loaded (an edit needs the saved person).
  let form = draft;
  if (!form && loaded) {
    if (existing) form = draftOf(existing);
    else {
      const companionId = parseIdParam(params.companionId);
      const trip = trips.find((x) => x.id === parseIdParam(params.tripId));
      const c = companionId && trip ? readCompanions(trip).find((x) => x.id === companionId) : undefined;
      form = c ? draftForCompanion(c) : { ...EMPTY_DRAFT };
    }
  }
  if (!form) return <Screen>{null}</Screen>;
  if (editId && !existing && !draft) {
    return (
      <Screen>
        <Body>{t('helpcards.edit.gone')}</Body>
        <Button label={t('helpcards.edit.back')} hint={t('helpcards.edit.backHint')} onPress={() => router.back()} />
      </Screen>
    );
  }
  const f = form;
  const set = (patch: Partial<PersonDraft>) => setDraft({ ...f, ...patch });

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/helpcards'));
  const cancel = async () => {
    // Photos picked in this visit and not saved go again.
    await Promise.all(picked.current.map((u) => removeHelpPhoto(u)));
    picked.current = [];
    leave();
  };

  const save = async () => {
    if (busy.current) return;
    setError(null);
    const id = existing?.id ?? newId('hc');
    const r = savePerson(people, f, id);
    if (!r.ok) {
      setError(t(`helpcards.edit.err.${r.reason}` as Key));
      return;
    }
    busy.current = true;
    writing.current = r.person.photoUri ?? null;
    const ok = await saveHelpPeople(() => r.list);
    busy.current = false;
    writing.current = null;
    if (!ok) {
      if (!mounted.current) {
        // The sheet went away while this save was failing: its photo was never kept, so it goes too.
        await Promise.all(unsavedHelpPhotos(picked.current, [savedPhoto.current]).map((u) => removeHelpPhoto(u)));
        picked.current = [];
        return;
      }
      setError(t('helpcards.edit.err.save'));
      return;
    }
    // The old photo goes once the new card no longer points at it; unsaved picks other than the kept one go too.
    const keep = r.person.photoUri;
    if (existing?.photoUri && existing.photoUri !== keep) await removeHelpPhoto(existing.photoUri);
    await Promise.all(picked.current.filter((u) => u !== keep).map((u) => removeHelpPhoto(u)));
    picked.current = [];
    haptic.success();
    AccessibilityInfo.announceForAccessibility(t('helpcards.edit.saved', { name: r.person.name }));
    leave();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('helpcards.edit.deleteTitle', { name: existing.name }), t('helpcards.edit.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('helpcards.edit.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          const r = removePerson(people, existing.id);
          if (!(await saveHelpPeople(() => r.list))) {
            setError(t('helpcards.edit.err.save'));
            return;
          }
          await removeHelpPhoto(r.photo);
          await Promise.all(picked.current.map((u) => removeHelpPhoto(u)));
          picked.current = [];
          leave();
        },
      },
    ]);
  };

  const fromContacts = async () => {
    setError(null);
    const r = await pickContact();
    if (r.ok) {
      if (!r.contact.phone) setError(t('helpcards.edit.err.noPhone'));
      else set({ callName: r.contact.name || f.callName, callPhone: r.contact.phone });
    } else if (r.reason === 'denied') {
      setError(t('helpcards.edit.err.contactsDenied'));
      // T160: when only Settings can turn Contacts back on, offer the way there (as the photo errors do).
      if (r.permission !== 'ask')
        Alert.alert(t('permissions.contacts.title.off'), t('helpcards.edit.err.contactsDenied'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.openSettings'), onPress: openSettings },
        ]);
    }
    else if (r.reason !== 'cancelled') setError(t('helpcards.edit.err.contacts'));
  };

  const addPhoto = async (source: 'camera' | 'photos') => {
    const r = await pickHelpPhoto(source);
    if (r.ok) {
      picked.current.push(r.uri);
      set({ photoUri: r.uri });
      AccessibilityInfo.announceForAccessibility(t('helpcards.photo.added'));
      return;
    }
    if (r.reason === 'canceled') return;
    Alert.alert(
      t('helpcards.photo.errTitle'),
      t(`helpcards.photo.err.${r.reason}` as Key),
      r.reason === 'denied' && r.permission !== 'ask' ? [{ text: t('common.cancel'), style: 'cancel' }, { text: t('helpcards.photo.openSettings'), onPress: openSettings }] : undefined,
    );
  };
  const choosePhoto = () =>
    Alert.alert(t('helpcards.photo.sourceTitle'), undefined, [
      { text: t('helpcards.photo.camera'), onPress: () => addPhoto('camera') },
      { text: t('helpcards.photo.photos'), onPress: () => addPhoto('photos') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  const clearPhoto = () => {
    const { photoUri: _p, ...rest } = f;
    setDraft(rest);
  };

  return (
    <Screen>
      <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
        {existing ? t('helpcards.edit.titleEdit', { name: existing.name }) : t('helpcards.edit.titleNew')}
      </Text>

      <SectionCard title={t('helpcards.edit.lostSection')} icon="help-buoy-outline" tone="accent">
        <TextField label={t('helpcards.edit.name')} value={f.name} onChange={(v) => set({ name: v })} autoCapitalize="words" />
        <TextField label={t('helpcards.edit.callName')} value={f.callName} onChange={(v) => set({ callName: v })} placeholder={t('helpcards.edit.callNamePlaceholder')} autoCapitalize="words" />
        <TextField label={t('helpcards.edit.callPhone')} value={f.callPhone} onChange={(v) => set({ callPhone: v })} inputMode="tel" placeholder={t('helpcards.edit.callPhonePlaceholder')} />
        <Button kind="quiet" icon="people-outline" label={t('helpcards.edit.fromContacts')} hint={t('helpcards.edit.fromContactsHint')} onPress={fromContacts} />
        <TextField label={t('helpcards.edit.meeting')} value={f.meetingPoint} onChange={(v) => set({ meetingPoint: v })} placeholder={t('helpcards.edit.meetingPlaceholder')} multiline />
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.edit.hotelNote')}</Text>
      </SectionCard>

      <SectionCard title={t('helpcards.photo.title')} icon="image-outline" tone="sea">
        {f.photoUri ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <Image
              accessible
              accessibilityLabel={t('helpcards.photoOf', { name: f.name || t('helpcards.photo.this') })}
              source={{ uri: helpPhotoPath(f.photoUri) }}
              resizeMode="cover"
              style={{ width: 72, height: 72, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.seaSoft }}
            />
            <View style={{ flex: 1, gap: space.xs }}>
              <Button kind="secondary" icon="camera-outline" label={t('helpcards.photo.replace')} hint={t('helpcards.photo.addHint')} onPress={choosePhoto} />
              <Button kind="quiet" label={t('helpcards.photo.remove')} hint={t('helpcards.photo.removeHint')} onPress={clearPhoto} />
            </View>
          </View>
        ) : (
          <Button kind="secondary" icon="camera-outline" label={t('helpcards.photo.add')} hint={t('helpcards.photo.addHint')} onPress={choosePhoto} />
        )}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.photo.local')}</Text>
      </SectionCard>

      <SectionCard title={t('helpcards.edit.needsSection')} icon="accessibility-outline" tone="teal">
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.edit.needsIntro')}</Text>
        <View accessibilityLabel={t('helpcards.edit.needsSection')} style={{ gap: space.s }}>
          {NEED_IDS.map((id) => {
            const on = f.needs.includes(id);
            return (
              <PressableScale
                key={id}
                accessibilityRole="checkbox"
                accessibilityLabel={t(NEED_KEY(id))}
                accessibilityState={{ checked: on }}
                onPress={() => set({ needs: toggleNeed(f.needs, id) })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.m,
                  paddingHorizontal: space.m,
                  borderRadius: radius.m,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? theme.accent : theme.line,
                  backgroundColor: on ? theme.accentSoft : theme.card,
                }}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.accentInk : theme.muted} />
                </View>
                <Text style={{ flex: 1, paddingVertical: space.s, fontFamily: fonts.bodyBold, fontSize: 16, color: on ? theme.accentInk : theme.ink }}>{t(NEED_KEY(id))}</Text>
              </PressableScale>
            );
          })}
        </View>
        <TextField label={t('helpcards.edit.other')} value={f.otherNeeds} onChange={(v) => set({ otherNeeds: v })} placeholder={t('helpcards.edit.otherPlaceholder')} multiline />
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.edit.otherNote')}</Text>
      </SectionCard>

      {error ? <Warning text={error} /> : null}
      <Button icon="checkmark" label={t('helpcards.edit.save')} hint={t('helpcards.edit.saveHint')} onPress={save} />
      <Button kind="quiet" label={t('common.cancel')} hint={t('helpcards.edit.cancelHint')} onPress={cancel} />
      {existing ? <Button kind="quiet" icon="trash-outline" label={t('helpcards.edit.delete')} hint={t('helpcards.edit.deleteHint')} onPress={remove} /> : null}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.privacy')}</Text>
    </Screen>
  );
}
