// T87 add / edit a membership card: type (radio chips), programme name (typed by the user, never prefilled), name on
// card, number, optional tier and expiry (YYYY-MM-DD, like vault documents), card colour (token paints) and what
// the card shows (barcode, QR code or number only). A live preview of the card sits above Save. Saved on this phone
// only. Leaving with changes asks first (src/ui/discardConfirm.ts). T88: an optional card photo, picked from the
// library and copied into Satchel's own folder like journal photos (src/native/journal.ts); a replaced or removed
// photo's copy is deleted once the save is stored, and photos picked but not saved are deleted on leaving.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, View } from 'react-native';
import { stalePhoto, unusedPicks } from '../src/core/followups91.ts';
import {
  BARCODE_TYPES,
  CARD_COLOURS,
  cardFromDraft,
  DEFAULT_COLOUR,
  draftFromCard,
  LOYALTY_KINDS,
  newCardDraft,
  upsertCard,
  validateCard,
  type BarcodeType,
  type CardDraft,
  type CardError,
} from '../src/core/loyalty.ts';
import { newId } from '../src/core/model.ts';
import type { Key } from '../src/i18n/en.ts';
import { haptic, openSettings } from '../src/native/device.ts';
import { appPath, removeAppFiles } from '../src/native/files.ts';
import { pickJournalPhotos } from '../src/native/journal.ts';
import { useApp } from '../src/state/app.tsx';
import { saveCards, useLoyaltyCards } from '../src/state/loyalty.ts';
import { cardPaint, radius, space } from '../src/theme/tokens.ts';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { Body, Button, Chip, Label, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { colourKey, LOYALTY_ICON, LoyaltyCardFace, loyaltyKindKey } from '../src/ui/loyaltyCards.tsx';

const BARCODE_KEY: Record<BarcodeType, Key> = { code128: 'loyalty.barcode.code128', qr: 'loyalty.barcode.qr', none: 'loyalty.barcode.none' };

export default function LoyaltyEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const [cards] = useLoyaltyCards();
  const prev = id ? cards.find((c) => c.id === id) : undefined;
  const [d, setD] = useState<CardDraft>(() => (prev ? draftFromCard(prev) : newCardDraft()));
  const initial = useRef(JSON.stringify(d));
  const filled = useRef(!!prev || !id);
  const [errors, setErrors] = useState<CardError[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { leaving, gestureEnabled } = useDiscardConfirm(JSON.stringify(d) !== initial.current);
  const [photoProblem, setPhotoProblem] = useState<{ key: Key; settings?: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  // Photo copies made in this editor; any the saved card doesn't keep are deleted (on save, or on leaving unsaved).
  const picked = useRef<string[]>([]);
  const saved = useRef(false);
  const prevPhoto = useRef(prev?.photo);
  prevPhoto.current = prev?.photo;
  useEffect(
    () => () => {
      if (!saved.current) removeAppFiles(unusedPicks(picked.current, prevPhoto.current)).catch(() => {});
    },
    [],
  );

  const pickPhoto = async () => {
    if (picking) return;
    setPicking(true);
    setPhotoProblem(null);
    try {
      const r = await pickJournalPhotos(1);
      if (!r.ok) {
        if (r.reason === 'canceled') return;
        if (r.reason === 'denied') setPhotoProblem({ key: 'f91.photo.denied', settings: r.permission !== 'unavailable' });
        else if (r.reason === 'storage') setPhotoProblem({ key: 'journal.edit.photos.storage' });
        else setPhotoProblem({ key: 'journal.edit.photos.unreadable' });
        return;
      }
      const uri = r.photos[0]?.uri;
      if (!uri) return;
      picked.current = [...picked.current, uri];
      setD((o) => ({ ...o, photo: uri }));
      haptic.success();
    } finally {
      setPicking(false);
    }
  };

  // Editing a card that was still loading from storage: fill the form once it arrives.
  useEffect(() => {
    if (!filled.current && prev) {
      filled.current = true;
      const next = draftFromCard(prev);
      initial.current = JSON.stringify(next);
      setD(next);
    }
  }, [prev]);

  const set = <K extends keyof CardDraft>(k: K, v: CardDraft[K]) => setD((o) => ({ ...o, [k]: v }));

  const save = async () => {
    if (busy) return;
    const e = validateCard(d);
    setErrors(e);
    setSaveFailed(false);
    if (e.length) {
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    setBusy(true);
    const card = cardFromDraft(d, prev?.id ?? newId('card'), prev?.createdAt ?? Date.now());
    const ok = await saveCards((old) => upsertCard(old, card));
    setBusy(false);
    if (!ok) {
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('loyalty.err.save'));
      return;
    }
    saved.current = true;
    const gone = [stalePhoto(prev, card), ...unusedPicks(picked.current, card.photo)].filter((u): u is string => !!u);
    if (gone.length) removeAppFiles(gone).catch(() => {});
    leaving();
    router.back();
  };

  const err = (k: CardError): string | undefined => {
    if (!errors.includes(k)) return undefined;
    if (k === 'barcode') return t(d.barcode === 'qr' ? 'loyalty.err.barcode.qr' : 'loyalty.err.barcode.code128');
    return t(`loyalty.err.${k}` as Key);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: prev ? t('loyalty.edit.editTitle') : t('loyalty.edit.newTitle'), gestureEnabled }} />

      <View style={{ gap: space.s }}>
        <Label>{t('loyalty.field.kind')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('loyalty.field.kind')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {LOYALTY_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(loyaltyKindKey(k))}
              selected={d.kind === k}
              // A colour still on the old type's default follows the new type; a colour the user picked stays.
              onPress={() => setD((o) => ({ ...o, kind: k, colour: o.colour === DEFAULT_COLOUR[o.kind] ? DEFAULT_COLOUR[k] : o.colour }))}
              icon={<Ionicons name={LOYALTY_ICON[k]} size={18} color={d.kind === k ? theme.accentInk : theme.ink} />}
            />
          ))}
        </View>
      </View>

      <TextField
        label={t('loyalty.field.programme')}
        value={d.programme}
        onChange={(v) => set('programme', v)}
        placeholder={t('loyalty.field.programmePlaceholder')}
        autoCapitalize="words"
        error={err('programme')}
      />
      <TextField label={t('loyalty.field.number')} value={d.number} onChange={(v) => set('number', v)} placeholder={t('loyalty.field.numberPlaceholder')} autoCapitalize="none" error={err('number')} />
      <TextField label={t('loyalty.field.memberName')} value={d.memberName} onChange={(v) => set('memberName', v)} placeholder={t('loyalty.field.memberNamePlaceholder')} autoCapitalize="words" />
      <TextField label={t('loyalty.field.tier')} value={d.tier} onChange={(v) => set('tier', v)} placeholder={t('loyalty.field.tierPlaceholder')} autoCapitalize="words" />
      <TextField label={t('loyalty.field.expires')} value={d.expires} onChange={(v) => set('expires', v)} placeholder={t('loyalty.field.expiresPlaceholder')} autoCapitalize="none" error={err('expires')} />

      <View style={{ gap: space.s }}>
        <Label>{t('loyalty.field.barcode')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('loyalty.field.barcode')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {BARCODE_TYPES.map((b) => (
            <Chip key={b} label={t(BARCODE_KEY[b])} selected={d.barcode === b} onPress={() => set('barcode', b)} />
          ))}
        </View>
        <Body muted>{t('loyalty.field.barcodeHelp')}</Body>
        {err('barcode') ? <Warning text={err('barcode')!} /> : null}
      </View>

      <View style={{ gap: space.s }}>
        <Label>{t('loyalty.field.colour')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('loyalty.field.colour')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {CARD_COLOURS.map((c) => {
            const selected = d.colour === c;
            return (
              <PressableScale
                key={c}
                accessibilityRole="radio"
                accessibilityLabel={t('loyalty.colour.a11y', { colour: t(colourKey(c)) })}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => set('colour', c)}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: selected ? 3 : 1, borderColor: selected ? theme.ink : theme.line }}
              >
                <View style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: cardPaint(theme, c).fill, alignItems: 'center', justifyContent: 'center' }}>
                  {selected ? <Ionicons name="checkmark" size={20} color={cardPaint(theme, c).ink} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space.s }}>
        <Label>{t('f91.photo.label')}</Label>
        <Body muted>{t('f91.photo.help')}</Body>
        {d.photo ? (
          <Image
            source={{ uri: appPath(d.photo) }}
            accessible
            accessibilityLabel={t('f91.photo.a11y', { programme: d.programme.trim() || t('loyalty.field.programme') })}
            resizeMode="contain"
            style={{ width: '100%', aspectRatio: 1.586, borderRadius: radius.m, backgroundColor: theme.line }}
          />
        ) : null}
        <Button
          kind="secondary"
          icon="image-outline"
          label={d.photo ? t('f91.photo.change') : t('f91.photo.add')}
          hint={d.photo ? t('f91.photo.changeHint') : t('f91.photo.addHint')}
          onPress={pickPhoto}
        />
        {d.photo ? <Button kind="quiet" icon="trash-outline" label={t('f91.photo.remove')} hint={t('f91.photo.removeHint')} onPress={() => set('photo', '')} /> : null}
        {photoProblem ? <Warning text={t(photoProblem.key)} /> : null}
        {photoProblem?.settings ? <Button label={t('journal.edit.openSettings')} hint={t('journal.edit.openSettingsHint')} kind="secondary" onPress={openSettings} /> : null}
      </View>

      <View style={{ gap: space.s }}>
        <Label>{t('loyalty.preview')}</Label>
        <LoyaltyCardFace
          card={{
            kind: d.kind,
            programme: d.programme.trim() || t('loyalty.field.programme'),
            memberName: d.memberName.trim() || undefined,
            number: d.number.trim() || t('loyalty.field.numberPlaceholder'),
            tier: d.tier.trim() || undefined,
            expires: errors.includes('expires') ? undefined : d.expires.trim() || undefined,
            colour: d.colour,
          }}
        />
      </View>

      <Body muted>{t('loyalty.privacy')}</Body>
      {saveFailed ? <Warning text={t('loyalty.err.save')} /> : null}
      <Button label={t('loyalty.save')} hint={t('loyalty.saveHint')} onPress={save} />
      <Button label={t('common.cancel')} hint={t('spec41.form.cancelHint')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
