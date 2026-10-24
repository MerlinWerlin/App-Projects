// New project: a name is enough. Hook size, a pattern and photos can come later.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { HOOK_SIZES, hookLabel } from '../../src/core/calc';
import { t } from '../../src/i18n';
import { addProject } from '../../src/store/data';
import { space } from '../../src/theme/tokens';
import { haptic } from '../../src/ui/haptics';
import { Body, Button, Chip, Field, Label, NumberField, ScreenScroll, Segmented } from '../../src/ui/kit';

const COMMON_HOOKS = [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 8, 10];

export default function NewProject() {
  const [name, setName] = useState('');
  const [hook, setHook] = useState<number | undefined>(undefined);
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [kind, setKind] = useState<'round' | 'row'>('round');

  const create = (then: 'open' | 'paste') => {
    const label = kind === 'round' ? t('counter.round') : t('counter.row');
    const p = addProject(name.trim() || t('project.untitled'), {
      hookMm: hook,
      counters: [{ id: `c_${Date.now().toString(36)}`, label, value: 0, target, drivesPattern: true }],
    });
    haptic('success');
    router.back();
    setTimeout(() => router.push(then === 'paste' ? `/project/${p.id}/paste` : `/project/${p.id}`), 50);
  };

  return (
    <ScreenScroll keyboard>
      <View style={{ gap: space.l }}>
        <Field label={t('project.name')} value={name} onChangeText={setName} placeholder={t('project.namePlaceholder')} autoFocus returnKeyType="done" />
        <View style={{ gap: 6 }}>
          <Label>{t('project.counting')}</Label>
          <Segmented
            options={[
              { value: 'round', label: t('project.inRounds') },
              { value: 'row', label: t('project.inRows') },
            ]}
            value={kind}
            onChange={setKind}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Label>{t('project.hook')}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COMMON_HOOKS.map((mm) => (
              <Chip key={mm} label={`${mm} mm`} on={hook === mm} onPress={() => setHook(hook === mm ? undefined : mm)} />
            ))}
          </ScrollView>
          {hook ? (
            <Body small muted>
              {hookLabel(hook)}
              {HOOK_SIZES.find((h) => h.mm === hook)?.uk ? ` · UK ${HOOK_SIZES.find((h) => h.mm === hook)?.uk}` : ''}
            </Body>
          ) : null}
        </View>
        <NumberField label={t('project.target')} value={target} onChange={setTarget} placeholder={t('project.targetPlaceholder')} />
        <View style={{ gap: space.s, marginTop: space.s }}>
          <Button title={t('project.create')} icon="check" onPress={() => create('open')} />
          <Button title={t('project.createPaste')} kind="secondary" icon="clipboard" onPress={() => create('paste')} />
        </View>
      </View>
    </ScreenScroll>
  );
}
