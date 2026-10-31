import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { FEEDBACK_ADDRESS, FEEDBACK_TYPES, draftReady, feedbackMailto, type FeedbackType } from '../src/core/feedback';
import { getLocale } from '../src/i18n/core';
import { useT } from '../src/i18n/react';
import { APP_VERSION } from '../src/state/lifecycle';
import { list, space, textStyle } from '../src/theme/design';
import { Text } from '../src/ui/Text';
import { LargeTitleHeader, PillButton, useDesign } from '../src/ui/v2';

function deviceModel(): string {
  const ios = (Constants.platform as { ios?: { model?: string | null } } | undefined)?.ios?.model;
  if (ios) return ios;
  const pc = Platform.constants as { Model?: string; Brand?: string } | undefined;
  return [pc?.Brand, pc?.Model].filter(Boolean).join(' ') || 'unknown';
}

/**
 * Send feedback / request a feature (owner 24 Oct 2026). Type chips (Idea / Bug / Other), a message box and Send,
 * which opens the user's Mail app with a mailto: link pre-filled to the owner (src/core/feedback.ts) plus the app
 * version, OS, device model and language. No native mail module, so it works in Expo Go and every build. If Mail
 * can't open, the address is shown (selectable) so the message can be sent another way.
 */
export default function FeedbackScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const [type, setType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'empty' | 'sent' | 'noMail'>('idle');

  const send = async () => {
    const draft = { type, message };
    if (!draftReady(draft)) {
      setState('empty');
      return;
    }
    const url = feedbackMailto('Couch', draft, {
      appVersion: APP_VERSION,
      os: Platform.OS,
      osVersion: String(Platform.Version),
      deviceModel: deviceModel(),
      language: String(getLocale()),
    });
    try {
      await Linking.openURL(url);
      setState('sent');
    } catch {
      setState('noMail');
    }
  };

  const typeLabel = (k: FeedbackType) =>
    k === 'idea' ? t('app.feedback.type.idea') : k === 'bug' ? t('app.feedback.type.bug') : t('app.feedback.type.other');

  return (
    <>
      <LargeTitleHeader
        title={t('app.feedback.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <View style={styles.body}>
          <Text style={[textStyle('body'), { color: p.secondaryLabel }]}>{t('app.feedback.intro')}</Text>

          <View accessibilityRole="radiogroup" accessibilityLabel={t('app.feedback.typeLabel')} style={styles.chips}>
            {FEEDBACK_TYPES.map((k) => {
              const on = type === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }}
                  accessibilityLabel={typeLabel(k)}
                  onPress={() => setType(k)}
                  style={[styles.chip, { backgroundColor: on ? p.tint : p.fill }]}
                >
                  <Text style={[textStyle('subheadline'), { color: on ? p.tintInk : p.label, fontWeight: '600' }]}>{typeLabel(k)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={message}
            onChangeText={(v) => {
              setMessage(v);
              if (state !== 'idle') setState('idle');
            }}
            placeholder={t('app.feedback.placeholder')}
            placeholderTextColor={p.secondaryLabel}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('app.feedback.title')}
            style={[textStyle('body'), styles.input, { backgroundColor: p.surface, borderColor: p.separator, color: p.label }]}
          />

          {state === 'empty' ? (
            <Text accessibilityLiveRegion="polite" style={[textStyle('subheadline'), { color: p.warning }]}>{t('app.feedback.empty')}</Text>
          ) : null}
          {state === 'sent' ? (
            <Text accessibilityLiveRegion="polite" style={[textStyle('subheadline'), { color: p.label }]}>{t('app.feedback.thanks')}</Text>
          ) : null}
          {state === 'noMail' ? (
            <View accessibilityLiveRegion="polite">
              <Text style={[textStyle('subheadline'), { color: p.label }]}>{t('app.feedback.noMail')}</Text>
              <Text selectable style={[textStyle('headline'), { color: p.label, marginTop: space.xs }]}>
                {FEEDBACK_ADDRESS}
              </Text>
            </View>
          ) : null}

          <PillButton stretch label={t('app.feedback.send')} accessibilityHint={t('app.feedback.sendHint')} onPress={send} />
        </View>
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  body: { marginHorizontal: list.inset, gap: space.md, paddingBottom: space.xl },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: 999, justifyContent: 'center' },
  input: { minHeight: 160, padding: space.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
