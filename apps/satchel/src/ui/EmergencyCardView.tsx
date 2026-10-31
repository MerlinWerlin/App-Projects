// The emergency card body: local numbers (big call buttons, a 112 + embassy fallback so no country is ever blank,
// the general number named for any missing service, verify locally, source + checked date, T25 doubted-number
// lines from the GUARD review and the import's confidence rating), insurance,
// contacts and private medical notes behind a tap. Presentational: data and callbacks come in as props, so the
// Emergency tab and the low-battery essentials screen (T07) render the same card. 'essentials' = pure black.
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';
import { FALLBACK_NUMBER, lineLabelServices, type Confidence, type DoubtField, type RowDisplay, type Service } from '../core/emergency.ts';
import type { EmergencyCard } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import type { Key } from '../i18n/en.ts';
import { callNumber } from '../native/contacts.ts';
import { useApp } from '../state/app.tsx';
import { essentials, fonts, radius, shadowOf, space, type Theme } from '../theme/tokens.ts';
import { IconBadge, type IconName, type Tone } from './hero.tsx';
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

/** T50: the glyph on a themed call button (essentials stays text only). */
const SERVICE_ICON: Record<Service, IconName> = {
  general: 'call',
  police: 'shield-outline',
  ambulance: 'medkit',
  fire: 'flame',
  tourist_police: 'shield-outline',
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
  // T50: the themed card is the richer look (elevated cards, icon badges, a tinted numbers panel); essentials stays
  // flat black and white with no colour and no motion.
  const rich = variant === 'themed';
  const box = rich
    ? ({ backgroundColor: theme.cardRaised, borderRadius: radius.l, borderWidth: theme.dark ? 1 : 0, borderColor: c.line, padding: space.l, gap: space.m, ...shadowOf(theme, 'low') } as const)
    : ({ backgroundColor: c.card, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, padding: space.l, gap: space.m } as const);
  const numbersBox = rich ? { ...box, backgroundColor: theme.dangerSoft, borderColor: theme.danger, borderWidth: theme.dark ? 1 : 0 } : box;
  const heading = (k: Key, icon?: IconName, tone?: Tone) => {
    const text = (
      <Text accessibilityRole="header" style={{ flex: rich && icon ? 1 : undefined, fontFamily: fonts.displayMedium, fontSize: 20, color: c.ink }}>
        {t(k)}
      </Text>
    );
    if (!rich || !icon) return text;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name={icon} tone={tone} />
        {text}
      </View>
    );
  };
  /** A big call button's inner layout: service glyph, number + label, and a phone glyph on the right (themed). */
  const callInner = (number: string, label: string, icon: IconName, extra?: ReactNode) =>
    rich ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name={icon} tone="danger" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 36, color: c.onStrong, fontVariant: ['tabular-nums'] }}>{number}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.onStrong }}>{label}</Text>
          {extra}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="call" size={26} color={c.onStrong} />
        </View>
      </View>
    ) : (
      <>
        <Text style={{ fontFamily: fonts.display, fontSize: 36, color: c.onStrong, fontVariant: ['tabular-nums'] }}>{number}</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.onStrong }}>{label}</Text>
        {extra}
      </>
    );
  const bigCall = { backgroundColor: c.strong, borderRadius: rich ? radius.l : radius.m, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 72, justifyContent: 'center', ...(rich ? shadowOf(theme, 'low') : null) } as const;
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
        <View style={numbersBox}>
          {heading('emergency.numbersHeading', 'call-outline', 'danger')}
          {row.noNumber ? (
            <>
              <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 25, color: c.ink }}>
                {t('emergency.noNumber')}
              </Text>
              <PressableScale
                animate={variant !== 'essentials'}
                accessibilityRole="button"
                accessibilityLabel={t('emergency.fallbackCallA11y')}
                accessibilityHint={t('emergency.callHint')}
                onPress={() => onCall(FALLBACK_NUMBER)}
                style={bigCall}
              >
                {callInner(FALLBACK_NUMBER, t('emergency.fallbackCall'), 'call')}
              </PressableScale>
            </>
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
                  style={[bigCall, { gap: 2 }]}
                >
                  {callInner(
                    line.number,
                    service,
                    SERVICE_ICON[lineLabelServices(line)[0] ?? 'general'],
                    line.doubted ? (
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: c.onStrong, textDecorationLine: 'underline' }}>
                        {t('sources.numberDoubted')}
                      </Text>
                    ) : null,
                  )}
                </PressableScale>
              );
            })
          )}
          {!row.noNumber && row.missingServices.length ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>
              {row.coverNumber
                ? t('emergency.missingCovered', { services: row.missingServices.map((s) => t(SERVICE_KEY[s])).join(', '), number: row.coverNumber })
                : t('emergency.missingNone', { services: row.missingServices.map((s) => t(SERVICE_KEY[s])).join(', ') })}
            </Text>
          ) : null}
          {row.doubtedElsewhere.length ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>
              {t('sources.alsoDoubted', { fields: doubtFieldNames(row.doubtedElsewhere, t) })}
            </Text>
          ) : null}
          {rich ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: theme.warnSoft, borderRadius: radius.m, padding: space.m }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="alert-circle" size={22} color={theme.warn} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: theme.ink }}>{t('emergency.verifyLocally')}</Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>{t('emergency.verifyLocally')}</Text>
          )}
          {body(row.source.kind === 'checked' ? t('emergency.sourceChecked', { host: row.source.host, date: row.source.date }) : t('emergency.sourcePending'), true)}
          {body(t('sources.confidence', { level: t(LEVEL_KEY[row.confidence]) }), true)}
          {row.notes ? body(t('emergency.tableNote', { note: row.notes }), true) : null}
          {row.notesDoubted ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: c.ink }}>{t('sources.noteDoubted')}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={box}>
        {heading('emergency.insuranceHeading', 'shield-checkmark-outline', 'sea')}
        {field('emergency.insurer', card.insurer)}
        {field('emergency.policy', card.policy)}
        {field('emergency.insurerPhone', card.insurerPhone)}
        {card.insurerPhone?.trim()
          ? smallCall(t('emergency.callInsurer'), t('emergency.callInsurerA11y', { number: card.insurerPhone.trim() }), card.insurerPhone)
          : null}
      </View>

      <View style={box}>
        {heading('emergency.contactsHeading', 'people-outline', 'teal')}
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
        {heading('emergency.medicalHeading', 'medical-outline', 'danger')}
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
