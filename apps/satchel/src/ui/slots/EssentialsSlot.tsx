// Essentials screen content (T07, docs/spec/FLOWS.md §9.2): next ticket, hotel address card, emergency card, on
// pure black with white text. No animation (plain Pressables here; the shared address and emergency card views
// turn their PressableScale off with animate={false} in the 'essentials' variant), no map. A section with nothing saved shows
// a short prompt linking to the setup screen; nothing is ever invented.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import table from '../../content/emergency_numbers.json';
import { currentHotel, nextTicket, setupTrip } from '../../core/battery.ts';
import { cardStatus, COUNTRY_KEY, displayRow, EMERGENCY_KEY, EMPTY_CARD, findCountry, guessCountry, normaliseCard, type EmergencyTable } from '../../core/emergency.ts';
import { deviceZone, formatDay, formatTime, todayIn, zoneCity } from '../../core/format.ts';
import type { EmergencyCard, ItemKind } from '../../core/model.ts';
import { localDate } from '../../core/tz.ts';
import { useApp } from '../../state/app.tsx';
import { usePersisted } from '../../state/persisted.ts';
import { useTrips } from '../../state/trips.tsx';
import { essentials, fonts, radius, space, TOUCH } from '../../theme/tokens.ts';
import { AddressCardView } from '../AddressCardView.tsx';
import { callAndExplain, EmergencyCardView } from '../EmergencyCardView.tsx';
import { KindIcon, kindKey } from '../kinds.tsx';

const TABLE = table as EmergencyTable;
const NO_PICK: string | null = null;

/** Plain essentials button: white outline (or solid white when `strong`), no press animation. */
export function EssentialsButton({ label, hint, onPress, strong }: { label: string; hint?: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={8}
      style={{
        minHeight: TOUCH,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: essentials.ink,
        backgroundColor: strong ? essentials.ink : essentials.bg,
        borderRadius: radius.m,
        paddingHorizontal: space.l,
        paddingVertical: space.s,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: strong ? essentials.bg : essentials.ink }}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.m, borderTopWidth: 1, borderTopColor: essentials.line, paddingTop: space.l }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, color: essentials.ink }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const Line = ({ children, muted, big }: { children: ReactNode; muted?: boolean; big?: boolean }) => (
  <Text style={{ fontFamily: big ? fonts.bodyBold : fonts.body, fontSize: big ? 22 : 17, lineHeight: big ? 29 : 24, color: muted ? essentials.muted : essentials.ink }}>{children}</Text>
);

export function EssentialsSlot() {
  const { t, lang } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [stored] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const [picked] = usePersisted<string | null>(COUNTRY_KEY, NO_PICK);
  const [medicalShown, setMedicalShown] = useState(false);
  // Re-check once a minute so "next" moves on; no other timers on this screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const zone = deviceZone();
  const today = todayIn(zone, now);
  const ticket = useMemo(() => nextTicket(trips, now), [trips, now]);
  const hotel = useMemo(() => currentHotel(trips, now), [trips, now]);
  const card = useMemo(() => normaliseCard(stored), [stored]);
  const guess = useMemo(() => guessCountry(trips, now, today, zone), [trips, now, today, zone]);
  const row = findCountry(TABLE, picked) ?? findCountry(TABLE, guess?.iso2);
  const display = row ? displayRow(row) : null;
  const target = setupTrip(trips, today);

  const addBooking = (kind: ItemKind, label: string) =>
    target ? (
      <EssentialsButton label={label} hint={t('battery.setupHint')} onPress={() => router.push({ pathname: '/item-edit', params: { tripId: target.id, kind } })} />
    ) : null;

  let ticketBody: ReactNode;
  if (!ticket) {
    ticketBody = (
      <>
        <Line big>{t('battery.ticketNone')}</Line>
        <Line muted>{t('battery.ticketNoneBody')}</Line>
        {addBooking('flight', t('battery.addBooking'))}
      </>
    );
  } else {
    const it = ticket.item;
    const when =
      ticket.state === 'now' && it.end
        ? t('battery.ticketNow', { time: formatTime(it.end.local), city: zoneCity(it.end.tz) })
        : t('battery.ticketNext', { day: formatDay(localDate(it.start.local), lang), time: formatTime(it.start.local), city: zoneCity(it.start.tz) });
    const extra = [it.seat ? `${t('item.seat')} ${it.seat}` : '', it.ref ? `${t('item.ref')} ${it.ref}` : ''].filter(Boolean).join(' · ');
    ticketBody = (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('battery.ticketOpen', { title: it.title })}
          accessibilityHint={`${t(kindKey(it.kind))}, ${when}. ${t('battery.ticketOpenHint')}`}
          onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: it.id } })}
          style={{ minHeight: TOUCH, borderWidth: 1, borderColor: essentials.ink, borderRadius: radius.m, padding: space.l, gap: space.s }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <KindIcon kind={it.kind} color={essentials.ink} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: essentials.muted }}>{t(kindKey(it.kind))}</Text>
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: essentials.ink }}>{it.title}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: essentials.ink, fontVariant: ['tabular-nums'] }}>{when}</Text>
          {extra ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: essentials.ink }}>{extra}</Text> : null}
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: essentials.ink, textDecorationLine: 'underline' }}>{t('battery.ticketOpenShort')}</Text>
        </Pressable>
        {!ticket.hasTicket ? <Line muted>{t('battery.ticketNoFile')}</Line> : null}
      </>
    );
  }

  let hotelBody: ReactNode;
  if (!hotel) {
    hotelBody = (
      <>
        <Line big>{t('battery.hotelNone')}</Line>
        <Line muted>{t('battery.hotelNoneBody')}</Line>
        {addBooking('hotel', t('battery.addHotel'))}
      </>
    );
  } else {
    const it = hotel.item;
    const name = it.place?.name?.trim() || it.title;
    hotelBody = hotel.hasAddress ? (
      <>
        <AddressCardView variant="essentials" compact name={name} address={it.place?.address} localAddress={it.place?.localAddress} phone={it.place?.phone} onCall={(n) => callAndExplain(n, t)} />
        <EssentialsButton label={t('battery.hotelOpen', { name })} hint={t('battery.hotelOpenHint')} onPress={() => router.push({ pathname: '/address/[id]', params: { id: it.id } })} />
      </>
    ) : (
      <>
        <Line big>{t('battery.hotelNoAddress', { name })}</Line>
        <EssentialsButton label={t('battery.editBooking')} hint={t('battery.setupHint')} onPress={() => router.push({ pathname: '/item-edit', params: { tripId: hotel.tripId, id: it.id } })} />
      </>
    );
  }

  return (
    <View style={{ gap: space.xl }}>
      <Section title={t('battery.ticketHeading')}>{ticketBody}</Section>
      <Section title={t('battery.hotelHeading')}>{hotelBody}</Section>
      <Section title={t('battery.emergencyHeading')}>
        {!display ? <Line muted>{t('battery.emergencyNoCountry')}</Line> : null}
        {cardStatus(card).empty ? (
          <EssentialsButton label={t('battery.editCard')} hint={t('battery.editCardHint')} onPress={() => router.push('/emergency-edit')} />
        ) : null}
        <EmergencyCardView variant="essentials" row={display} card={card} onCall={(n) => callAndExplain(n, t)} medicalShown={medicalShown} onToggleMedical={() => setMedicalShown(!medicalShown)} />
        <EssentialsButton label={t('battery.emergencyOpen')} hint={t('battery.emergencyOpenHint')} onPress={() => router.navigate('/emergency')} />
      </Section>
    </View>
  );
}
