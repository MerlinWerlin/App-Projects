// The emergency card body: local numbers (big call buttons, verify locally, source pending / checked, T25 doubted-number
// lines from the GUARD review and the import's confidence rating), insurance,
// contacts and private medical notes behind a tap. Presentational: data and callbacks come in as props, so the
// Emergency tab and the low-battery essentials screen (T07) render the same card. 'essentials' = pure black.
import { Alert, Text, View } from 'react-native';
import { lineLabelServices, type Confidence, type DoubtField, type RowDisplay, type Service } from '../core/emergency.ts';
import type { EmergencyCard } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import type { Key } from '../i18n/en.ts';
import { callNumber } from '../native/contacts.ts';
import { useApp } from '../state/app.tsx';
import { essentials, fonts, radius, space, type Theme } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';

export type CardVariant = 'themed' | 'essentials';

export type VariantColours = { bg: string; card: string; ink: string; muted: string; line: string; strong: string; onStrong: string; soft: string };

/** Colours for a variant: the theme, or the pure-black essentials palette (white text, white buttons). */
export function variantColours(variant: CardVariant, theme: Theme): VariantColours {
  if (variant === 'essentials') {
    return { bg: essentials.bg, card: essentials.bg, ink: essentials.ink, muted: essentials.muted, line: essentials.line, strong: essentials.ink, onStrong: essentials.bg, soft: essentials.bg };
  }
  return { bg: theme.paper, card: theme.card, ink: theme.ink, muted: theme.muted, line: theme.line, strong: theme.danger, onStrong: theme.onAccent, soft: theme.accentSoft };
}

/** Opens the call screen for a number; explains plainly when this device can't call or the number is unusable. */
export async function callAndExplain(number: string, t: T): Promise<void> {
  const r = await callNumber(number);
  if (r.ok) return;
  if (r.reason === 'invalid') Alert.alert(t('emergency.callInvalid'));
  else Alert.alert(t('emergency.callUnavailableTitle'), t('emergency.callUnavailableBody', { number: number.trim() }));
}

const SERVICE_KEY: Record<Service, Key> = {
  general: 'emergency.svc.general',
  police: 'emergency.svc.police',
  ambulance: 'emergency.svc.ambulance',
  fire: 'emergency.svc.fire',
  tourist_police: 'emergency.svc.tourist_police',
};

const LEVEL_KEY: Record<Confidence, Key> = {
  high: 'sources.level.high',
  medium: 'sources.level.medium',
  low: 'sources.level.low',
  unknown: 'sources.level.unknown',
};

/** Words for doubted fields that have no number line of their own ("Ambulance, Fire", "this whole entry"). */
function doubtFieldNames(fields: DoubtField[], t: T): string {
  return fields
    .filter((f): f is Service | 'entry' => f !== 'notes')
    .map((f) => (f === 'entry' ? t('sources.field.entry') : t(SERVICE_KEY[f])))
    .join(', ');
}

export type EmergencyCardViewProps = {
  variant: CardVariant;
  /** Display model for the chosen country, or null when no country is chosen yet. */
  row: RowDisplay | null;
  card: EmergencyCard;
  /** Called with the raw number; the screen sanitises and opens the call screen. */
  onCall: (number: string) => void;
  medicalShown: boolean;
  onToggleMedical: () => void;
};

export function EmergencyCardView({ variant, row, card, onCall, medicalShown, onToggleMedical }: EmergencyCardViewProps) {
  const { t, theme } = useApp();
  const c = variantColours(variant, theme);
  const box = { backgroundColor: c.card, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, padding: space.l, gap: space.m } as const;
  const heading = (k: Key) => (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: c.ink }}>
      {t(k)}
    </Text>
  );
  const body = (s: string, muted = false) => <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: muted ? c.muted : c.ink }}>{s}</Text>;
  const field = (label: Key, value?: string) => (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: c.muted }}>{t(label)}</Text>
      {value?.trim() ? (
        <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: c.ink }}>
          {value}
        </Text>
      ) : (
        <Text style={{ fontFamily: fonts.body, fontSize: 16, fontStyle: 'italic', color: c.muted }}>{t('emergency.notAdded')}</Text>
      )}
    </View>
  );
  const smallCall = (label: string, a11y: string, number: string) => (
    <PressableScale
      animate={variant !== 'essentials'}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={t('emergency.callHint')}
      onPress={() => onCall(number)}
      style={{ borderRadius: radius.m, borderWidth: 1, borderColor: c.ink, paddingHorizontal: space.l, alignItems: 'center' }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink }}>{label}</Text>
    </PressableScale>
  );

  const contacts = card.contacts.filter((x) => x.name.trim() || x.phone.trim());

  return (
    <View style={{ gap: space.l }}>
      {row ? (
        <View style={box}>
          {heading('emergency.numbersHeading')}
          {row.noNumber ? (
            <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 25, color: c.ink }}>
              {t('emergency.noNumber')}
            </Text>
          ) : (
            row.lines.map((line) => {
              const service = lineLabelServices(line)
                .map((s) => t(SERVICE_KEY[s]))
                .join(' · ');
              return (
                <PressableScale
                  animate={variant !== 'essentials'}
                  key={line.number}
                  accessibilityRole="button"
                  accessibilityLabel={
                    t('emergency.callNumberA11y', { service, number: line.number, country: row.country }) +
                    (line.doubted ? `. ${t('sources.numberDoubtedA11y')}` : '')
                  }
                  accessibilityHint={t('emergency.callHint')}
                  onPress={() => onCall(line.number)}
                  style={{ backgroundColor: c.strong, borderRadius: radius.m, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 72, gap: 2 }}
                >
                  <Text style={{ fontFamily: fonts.display, fontSize: 36, color: c.onStrong, fontVariant: ['tabular-nums'] }}>{line.number}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.onStrong }}>{service}</Text>
                  {line.doubted ? (
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: c.onStrong, textDecorationLine: 'underline' }}>
                      {t('sources.numberDoubted')}
                    </Text>
                  ) : null}
                </PressableScale>
              );
            })
          )}
          {row.doubtedElsewhere.length ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>
              {t('sources.alsoDoubted', { fields: doubtFieldNames(row.doubtedElsewhere, t) })}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>{t('emergency.verifyLocally')}</Text>
          {body(row.source.kind === 'checked' ? t('emergency.sourceChecked', { host: row.source.host, date: row.source.date }) : t('emergency.sourcePending'), true)}
          {body(t('sources.confidence', { level: t(LEVEL_KEY[row.confidence]) }), true)}
          {row.notes ? body(t('emergency.tableNote', { note: row.notes }), true) : null}
          {row.notesDoubted ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>{t('sources.noteDoubted')}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={box}>
        {heading('emergency.insuranceHeading')}
        {field('emergency.insurer', card.insurer)}
        {field('emergency.policy', card.policy)}
        {field('emergency.insurerPhone', card.insurerPhone)}
        {card.insurerPhone?.trim()
          ? smallCall(t('emergency.callInsurer'), t('emergency.callInsurerA11y', { number: card.insurerPhone.trim() }), card.insurerPhone)
          : null}
      </View>

      <View style={box}>
        {heading('emergency.contactsHeading')}
        {contacts.length === 0 ? (
          <>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink }}>{t('emergency.contactsEmpty')}</Text>
            {body(t('emergency.contactsEmptyBody'), true)}
          </>
        ) : (
          contacts.map((x) => {
            const name = x.name.trim() || x.phone.trim();
            const title = x.relation?.trim() ? t('emergency.contactWithRelation', { name, relation: x.relation.trim() }) : name;
            return (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: c.ink }}>{title}</Text>
                  <Text selectable style={{ fontFamily: fonts.body, fontSize: 16, color: c.muted, fontVariant: ['tabular-nums'] }}>
                    {x.phone.trim() || t('emergency.notAdded')}
                  </Text>
                </View>
                {x.phone.trim() ? smallCall(t('emergency.callContact'), t('emergency.callContactA11y', { name: title, number: x.phone.trim() }), x.phone) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={box}>
        {heading('emergency.medicalHeading')}
        {body(t('emergency.medicalPrivate'), true)}
        {card.medicalNotes?.trim() ? (
          <>
            {medicalShown ? (
              <Text selectable style={{ fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: c.ink }}>
                {card.medicalNotes}
              </Text>
            ) : null}
            <PressableScale
              animate={variant !== 'essentials'}
              accessibilityRole="button"
              accessibilityLabel={medicalShown ? t('emergency.medicalHide') : t('emergency.medicalShow')}
              accessibilityHint={medicalShown ? undefined : t('emergency.medicalShowHint')}
              accessibilityState={{ expanded: medicalShown }}
              onPress={onToggleMedical}
              style={{ borderRadius: radius.m, borderWidth: 1, borderColor: c.line, paddingHorizontal: space.l, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink }}>{medicalShown ? t('emergency.medicalHide') : t('emergency.medicalShow')}</Text>
            </PressableScale>
          </>
        ) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 16, fontStyle: 'italic', color: c.muted }}>{t('emergency.medicalNone')}</Text>
        )}
      </View>
    </View>
  );
}
