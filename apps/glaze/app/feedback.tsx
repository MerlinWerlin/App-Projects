// /feedback: "Send feedback" (T23, owner requirement docs/feedback/2026-10-12-feedback-email.md).
// Composes an email in the user's own Mail app via expo-mail-composer (works in Expo Go).
// Subject/body come from src/core/feedback.ts; the address from src/config/feedback.ts.
// If Mail isn't set up: selectable address, Copy address, Copy message and a mailto: link.
// Glaze itself sends nothing and collects no data. The email body and subject stay in English (they go to
// the Glaze team); everything on screen comes from the `feedback` catalogue namespace.
// Design v2 (T83): grouped bg, mint privacy card, pill type chips, inputs on surface, pills.
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEEDBACK_ADDRESS } from '../src/config/feedback';
import {
  buildFeedbackEmail,
  draftProblem,
  FEEDBACK_TYPES,
  isFeedbackType,
  MAX_APP_NAME,
  type FeedbackDiagnostics,
  type FeedbackDraft,
  type FeedbackType,
} from '../src/core/feedback';
import { composeMail, isMailAvailable } from '../src/native/mail';
import { useT } from '../src/i18n';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { PillButton } from '../src/ui/PillButton';
import { deviceDiagnostics, feedbackMailto, loadDiagnostics, openMailto } from '../src/ui/feedbackDevice';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';
import { useToast } from '../src/ui/Toast';

const TYPE_LABEL = {
  bug: 'feedback.types.bug',
  idea: 'feedback.types.idea',
  theme: 'feedback.types.theme',
  icon: 'feedback.types.icon',
  other: 'feedback.types.misc',
} as const satisfies Record<FeedbackType, string>;

/** draftProblem() (core, English) → catalogue key. */
function problemKey(draft: FeedbackDraft): 'feedback.problemAppName' | 'feedback.problemMessage' | null {
  const problem = draftProblem(draft);
  if (!problem) return null;
  return draft.type === 'icon' && /app name/i.test(problem) ? 'feedback.problemAppName' : 'feedback.problemMessage';
}

const MAX_MESSAGE = 4000;
const EXPO_GO = 'Expo Go'; // i18n-ignore (product name)

export default function FeedbackScreen() {
  const { c } = useColorsV2();
  const toast = useToast();
  const { t, script } = useT();
  const tt = {
    heading: [textV2.headline, textStyleFor(script, textV2.headline)],
    label: [textV2.subhead, textStyleFor(script, textV2.subhead), styles.semibold],
    body: [textV2.body, textStyleFor(script, textV2.body)],
    small: [textV2.footnote, textStyleFor(script, textV2.footnote)],
  };
  const params = useLocalSearchParams<{ type?: string; app?: string }>();
  const [kind, setKind] = useState((isFeedbackType(params.type) ? params.type : 'bug') as FeedbackType);
  const [appName, setAppName] = useState(typeof params.app === 'string' ? params.app.slice(0, MAX_APP_NAME) : '');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState(null as string | null);
  const [diag, setDiag] = useState((): FeedbackDiagnostics => deviceDiagnostics(null, null));
  const [mailOk, setMailOk] = useState(null as boolean | null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null as string | null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    loadDiagnostics().then((d) => {
      if (alive.current) setDiag(d);
    });
    isMailAvailable().then((ok) => {
      if (alive.current) setMailOk(ok);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const draft: FeedbackDraft = useMemo(
    () => ({ type: kind, message, appName: kind === 'icon' ? appName : undefined }),
    [kind, message, appName],
  );
  const pk = problemKey(draft);
  const problem = pk ? t(pk) : null;
  const email = useMemo(() => buildFeedbackEmail(draft, diag), [draft, diag]);

  const pickShot = async () => {
    if (busy) return;
    setNote(null);
    try {
      // The system photo picker needs no library permission; images only.
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      if (!alive.current) return;
      setShot(res.assets[0].uri);
      haptic('select');
    } catch {
      setNote(t('feedback.photosFailed'));
    }
  };

  const send = async () => {
    if (busy) return;
    if (problem) {
      haptic('warning');
      setNote(problem);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const outcome = await composeMail({
        recipients: [FEEDBACK_ADDRESS],
        subject: email.subject,
        body: email.body,
        attachments: shot ? [shot] : undefined,
      });
      if (!alive.current) return;
      if (outcome === 'sent') {
        haptic('success');
        toast.show(t('feedback.sent'), 'success');
        setMessage('');
        setShot(null);
      } else if (outcome === 'saved') {
        toast.show(t('feedback.saved'), 'info');
      } else if (outcome === 'unavailable' || outcome === 'failed') {
        setMailOk(false);
        setNote(t('feedback.mailUnavailable'));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      await Clipboard.setStringAsync(text);
      haptic('success');
      toast.show(done, 'success');
    } catch {
      setNote(t('feedback.copyFailed'));
    }
  };

  const openLink = async () => {
    if (problem) {
      haptic('warning');
      setNote(problem);
      return;
    }
    const ok = await openMailto(feedbackMailto(draft, diag));
    if (!ok && alive.current) setNote(t('feedback.noMailApp'));
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.privacy, continuous, { backgroundColor: c.pastels.mint.fill }]}>
          <Feather name="shield" size={18} color={c.pastels.mint.ink} />
          <Text style={[...tt.small, styles.flex, { color: c.pastels.mint.ink }]}>{t('feedback.privacy')}</Text>
        </View>

        <Text accessibilityRole="header" style={[...tt.heading, { color: c.ink }]}>
          {t('feedback.about')}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('feedback.typeGroup')} style={styles.chips}>
          {FEEDBACK_TYPES.map((ft) => {
            const selected = ft === kind;
            const label = t(TYPE_LABEL[ft]);
            return (
              <Pressable
                key={ft}
                accessibilityRole="radio"
                accessibilityLabel={t('feedback.typeOptionA11y', { type: label })}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => {
                  if (selected) return;
                  haptic('select');
                  setKind(ft);
                  setNote(null);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? c.tint : c.fill,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[...tt.label, { color: selected ? c.onTint : c.ink }, selected && styles.bold]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {kind === 'icon' ? (
          <View style={styles.field}>
            <Text style={[...tt.label, { color: c.ink }]}>{t('feedback.appLabel')}</Text>
            <TextInput
              value={appName}
              onChangeText={setAppName}
              placeholder={t('feedback.appPlaceholder')}
              placeholderTextColor={c.inkTertiary}
              maxLength={MAX_APP_NAME}
              accessibilityLabel={t('feedback.appA11y')}
              returnKeyType="done"
              style={[styles.input, continuous, ...tt.body, { color: c.ink, backgroundColor: c.surface }]}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[...tt.label, { color: c.ink }]}>{t('feedback.messageLabel')}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={kind === 'bug' ? t('feedback.messagePlaceholderBug') : t('feedback.messagePlaceholderIdea')}
            placeholderTextColor={c.inkTertiary}
            multiline
            maxLength={MAX_MESSAGE}
            textAlignVertical="top"
            accessibilityLabel={t('feedback.messageLabel')}
            style={[
              styles.input,
              styles.multiline,
              continuous,
              ...tt.body,
              { color: c.ink, backgroundColor: c.surface },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[...tt.label, { color: c.ink }]}>{t('feedback.screenshotLabel')}</Text>
          {shot ? (
            <View style={[styles.shotRow, continuous, { backgroundColor: c.surface }]}>
              <Image
                source={{ uri: shot }}
                style={styles.thumb}
                accessibilityLabel={t('feedback.screenshotA11y')}
                accessibilityIgnoresInvertColors
              />
              <Text style={[...tt.small, styles.flex, { color: c.inkSecondary }]}>
                {mailOk === false ? t('feedback.attachYourself') : t('feedback.attached')}
              </Text>
              <PillButton
                label={t('feedback.remove')}
                variant="plain"
                size="small"
                haptic={false}
                onPress={() => setShot(null)}
                accessibilityLabel={t('feedback.removeA11y')}
              />
            </View>
          ) : (
            <PillButton
              label={t('feedback.addPhoto')}
              icon="image"
              variant="tinted"
              haptic={false}
              onPress={pickShot}
              accessibilityHint={t('feedback.addPhotoHint')}
            />
          )}
        </View>

        {note ? (
          <Text accessibilityLiveRegion="polite" style={[...tt.small, { color: c.warn }]}>
            {note}
          </Text>
        ) : null}

        {mailOk !== false ? (
          <PillButton
            label={busy ? t('feedback.opening') : t('feedback.send')}
            icon="send"
            block
            onPress={send}
            disabled={busy || mailOk === null}
            accessibilityHint={t('feedback.sendHint')}
          />
        ) : (
          <View style={[styles.fallback, continuous, { backgroundColor: c.surface }]}>
            <Text accessibilityRole="header" style={[...tt.heading, { color: c.ink }]}>
              {t('feedback.noMailTitle')}
            </Text>
            <Text style={[...tt.small, { color: c.inkSecondary }]}>
              {t('feedback.noMailBody')}
            </Text>
            <Text
              selectable
              accessibilityLabel={t('feedback.addressA11y', { address: FEEDBACK_ADDRESS })}
              style={[...tt.label, { color: c.tint }]}
            >
              {FEEDBACK_ADDRESS}
            </Text>
            <PillButton
              label={t('feedback.copyAddress')}
              icon="copy"
              variant="tinted"
              haptic={false}
              onPress={() => copy(FEEDBACK_ADDRESS, t('feedback.addressCopied'))}
            />
            <PillButton
              label={t('feedback.copyMessage')}
              icon="clipboard"
              variant="tinted"
              haptic={false}
              onPress={() =>
                problem
                  ? setNote(problem)
                  : copy(t('feedback.copiedTemplate', { subject: email.subject, body: email.body }), t('feedback.messageCopied'))
              }
              accessibilityHint={t('feedback.copyMessageHint')}
            />
            <PillButton
              label={t('feedback.openLink')}
              icon="external-link"
              variant="plain"
              haptic={false}
              onPress={openLink}
              accessibilityHint={t('feedback.openLinkHint')}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={[...tt.small, { color: c.inkSecondary }]}>
            {t('feedback.diagIntro')}
          </Text>
          <Text selectable style={[styles.mono, { color: c.inkSecondary, borderColor: c.separator }]}>
            {t('feedback.diagLine', {
              os: diag.os,
              osVersion: diag.osVersion,
              model: diag.deviceModel,
              version: diag.appVersion,
              build: diag.build,
              runtime: diag.runtime === 'expo-go' ? EXPO_GO : t('feedback.runtimeApp'),
              theme: diag.themeId ?? t('feedback.themeNone'),
              shape: diag.iconShape ?? t('feedback.shapeUnknown'),
            })}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: spaceV2.lg, gap: spaceV2.md, paddingBottom: spaceV2.xxl },
  flex: { flex: 1 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceV2.sm,
    padding: spaceV2.md,
    borderRadius: radiusV2.card,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  chip: {
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  field: { gap: spaceV2.sm },
  input: {
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.control,
    paddingHorizontal: spaceV2.md,
    paddingVertical: spaceV2.sm,
  },
  multiline: { minHeight: 140 },
  shotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    padding: spaceV2.sm,
    borderRadius: radiusV2.group,
  },
  thumb: { width: 48, height: 48, borderRadius: iconTileRadius(48) },
  fallback: {
    gap: spaceV2.md,
    padding: spaceV2.lg,
    borderRadius: radiusV2.group,
  },
  mono: {
    ...textV2.caption1,
    fontVariant: ['tabular-nums'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spaceV2.sm,
  },
});
