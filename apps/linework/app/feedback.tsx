// Send feedback / request a feature (owner 24 Oct 2026). Type chips (Idea / Bug / Other), a message box and Send,
// which opens the user's Mail app with a mailto: link pre-filled to the owner (src/core/feedback.ts) plus the app
// version, OS, device model and language. No native mail module: works in Expo Go and every build. If Mail can't
// open, the address is shown (selectable) so the message can be sent another way.
import { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { useThemeV2 } from '../src/theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../src/theme/tokensV2';
import { select } from '../src/native/haptics';
import { useT } from '../src/i18n';
import { FEEDBACK_ADDRESS, FEEDBACK_TYPES, draftReady, feedbackMailto, type FeedbackType } from '../src/core/feedback';
import { PillButton, ScreenV2 } from '../src/ui/v2';

function deviceModel(): string {
  const ios = (Constants.platform as { ios?: { model?: string | null } } | undefined)?.ios?.model;
  if (ios) return ios;
  const pc = Platform.constants as { Model?: string; Brand?: string } | undefined;
  return [pc?.Brand, pc?.Model].filter(Boolean).join(' ') || 'unknown';
}

export default function FeedbackScreen() {
  const { c, text } = useThemeV2();
  const { t, locale } = useT();
  const router = useRouter();
  const [type, setType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'empty' | 'sent' | 'noMail'>('idle');

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const send = async () => {
    const draft = { type, message };
    if (!draftReady(draft)) {
      setState('empty');
      return;
    }
    const url = feedbackMailto('Linework', draft, {
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      os: Platform.OS,
      osVersion: String(Platform.Version),
      deviceModel: deviceModel(),
      language: locale,
    });
    try {
      await Linking.openURL(url);
      setState('sent');
    } catch {
      setState('noMail');
    }
  };

  const typeLabel = (k: FeedbackType) => t(`feedback.type.${k}` as 'feedback.type.idea');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenV2 title={t('feedback.title')} onBack={goBack}>
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.muted, marginBottom: spaceV2.x5 }]}>
          {t('feedback.intro')}
        </Text>

        <View accessibilityRole="radiogroup" accessibilityLabel={t('feedback.typeLabel')} style={{ flexDirection: 'row', gap: spaceV2.x2, marginBottom: spaceV2.x4 }}>
          {FEEDBACK_TYPES.map((k) => {
            const on = type === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, checked: on }}
                accessibilityLabel={typeLabel(k)}
                onPress={() => {
                  if (on) return;
                  select();
                  setType(k);
                }}
                style={{
                  minHeight: sizeV2.touch,
                  paddingHorizontal: spaceV2.x4,
                  borderRadius: radiusV2.pill,
                  justifyContent: 'center',
                  backgroundColor: on ? c.ink : c.card,
                  borderWidth: 1,
                  borderColor: on ? c.ink : c.line,
                }}
              >
                <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: on ? c.onInk : c.ink, fontWeight: '600' }]}>
                  {typeLabel(k)}
                </Text>
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
          placeholder={t('feedback.placeholder')}
          placeholderTextColor={c.muted}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('feedback.title')}
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[
            text('body'),
            {
              minHeight: 160,
              padding: spaceV2.x4,
              borderRadius: radiusV2.md,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.line,
              color: c.ink,
              marginBottom: spaceV2.x4,
            },
          ]}
        />

        {state === 'empty' ? (
          <Text accessibilityLiveRegion="polite" style={[text('subhead'), { color: c.ink, marginBottom: spaceV2.x3 }]}>
            {t('feedback.empty')}
          </Text>
        ) : null}
        {state === 'sent' ? (
          <Text accessibilityLiveRegion="polite" style={[text('subhead'), { color: c.ink, marginBottom: spaceV2.x3 }]}>
            {t('feedback.thanks')}
          </Text>
        ) : null}
        {state === 'noMail' ? (
          <View accessibilityLiveRegion="polite" style={{ marginBottom: spaceV2.x3 }}>
            <Text style={[text('subhead'), { color: c.ink }]}>{t('feedback.noMail')}</Text>
            <Text selectable style={[text('headline'), { color: c.ink, marginTop: spaceV2.x1 }]}>
              {FEEDBACK_ADDRESS}
            </Text>
          </View>
        ) : null}

        <PillButton title={t('feedback.send')} icon="send" onPress={send} accessibilityHint={t('feedback.sendHint')} />
      </ScreenV2>
    </>
  );
}
