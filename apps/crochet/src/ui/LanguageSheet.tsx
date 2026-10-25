// Language picker: the phone's setting or one of the shipped languages, each by its own name.
import { Feather } from '@expo/vector-icons';
import { LANGUAGES, getLocale, languageName, t } from '../i18n';
import { setSettings, useSettings } from '../store/settings';
import { useColors } from '../theme/tokens';
import { Group, Row, Sheet } from './kit';

/** What the current language is called, for a row subtitle or the first-launch line. */
export function currentLanguageLabel(pref: string): string {
  const name = languageName(getLocale());
  return pref === 'system' ? `${t('language.system')} (${name})` : name;
}

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useColors();
  const { language } = useSettings();
  const pick = (code: string) => {
    onClose();
    if (code !== language) setSettings({ language: code });
  };
  const tick = (on: boolean) => (on ? <Feather name="check" size={18} color={c.accent} /> : null);
  const options = [{ code: 'system', name: t('language.system') }, ...LANGUAGES];
  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.language')}>
      <Group>
        {options.map((l, i) => (
          <Row key={l.code} title={l.name} right={tick(language === l.code)} chevron={false} onPress={() => pick(l.code)} last={i === options.length - 1} />
        ))}
      </Group>
    </Sheet>
  );
}
