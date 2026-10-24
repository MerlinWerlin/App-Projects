// Paste or type a written pattern. Live preview of how it splits into steps, US/UK detection.
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { parsePattern, stepLabel } from '../../../src/core/pattern';
import { detectTerms, type Terms } from '../../../src/core/terms';
import { t } from '../../../src/i18n';
import { updateProject, useProject } from '../../../src/store/data';
import { useSettings } from '../../../src/store/settings';
import { space, useColors } from '../../../src/theme/tokens';
import { haptic } from '../../../src/ui/haptics';
import { Body, Button, Card, Field, Label, ScreenScroll, Segmented } from '../../../src/ui/kit';
import { useToast } from '../../../src/ui/Toast';

export default function PastePattern() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProject(id);
  const settings = useSettings();
  const toast = useToast();
  const { c } = useColors();
  const [text, setText] = useState(p?.pattern?.text ?? '');
  const detected = useMemo(() => detectTerms(text), [text]);
  const [terms, setTerms] = useState<Terms>(p?.pattern?.terms ?? settings.terms);
  const [touchedTerms, setTouchedTerms] = useState(!!p?.pattern);
  const shownTerms: Terms = touchedTerms || detected === 'unknown' ? terms : detected;
  const parsed = useMemo(() => parsePattern(text), [text]);

  const paste = async () => {
    try {
      const s = await Clipboard.getStringAsync();
      if (!s.trim()) {
        toast(t('paste.clipboardEmpty'));
        return;
      }
      setText(text.trim() ? `${text}\n${s}` : s);
      haptic('success');
    } catch {
      toast(t('paste.clipboardFailed'));
    }
  };

  const save = () => {
    if (!p) return;
    updateProject(p.id, (q) => ({
      ...q,
      pattern: text.trim() ? { text, terms: shownTerms, step: q.pattern?.step ?? 0, done: q.pattern?.done ?? [] } : undefined,
    }));
    haptic('success');
    router.back();
  };

  return (
    <ScreenScroll keyboard>
      <View style={{ gap: space.l }}>
        <Body muted>{t('paste.help')}</Body>
        <Button title={t('paste.fromClipboard')} kind="secondary" icon="clipboard" onPress={() => paste().catch(() => {})} />
        <Field label={t('paste.text')} value={text} onChangeText={setText} multiline placeholder={t('paste.placeholder')} autoCorrect={false} autoCapitalize="none" />
        <View style={{ gap: 6 }}>
          <Label>{t('paste.writtenIn')}</Label>
          <Segmented
            options={[
              { value: 'US', label: t('terms.us') },
              { value: 'UK', label: t('terms.uk') },
            ]}
            value={shownTerms}
            onChange={(v) => {
              setTerms(v);
              setTouchedTerms(true);
            }}
          />
          {detected !== 'unknown' && !touchedTerms ? (
            <Body small muted>
              {t('paste.detected', { terms: detected })}
            </Body>
          ) : null}
        </View>
        {text.trim() ? (
          <Card>
            <Label>{t('paste.preview')}</Label>
            {parsed.steps.length ? (
              <View style={{ gap: 4, marginTop: 8 }}>
                <Body bold>{t('paste.found', { count: parsed.steps.length, sections: parsed.sections.length || 1 })}</Body>
                {parsed.steps.slice(0, 4).map((s) => (
                  <Body key={s.i} small muted numberOfLines={1}>
                    {stepLabel(s)}: {s.text}
                  </Body>
                ))}
                {parsed.steps.length > 4 ? (
                  <Body small muted>
                    …
                  </Body>
                ) : null}
              </View>
            ) : (
              <Body small style={{ color: c.warn, marginTop: 8 }}>
                {t('paste.noSteps')}
              </Body>
            )}
          </Card>
        ) : null}
        <Button title={t('common.save')} icon="check" onPress={save} />
      </View>
    </ScreenScroll>
  );
}
