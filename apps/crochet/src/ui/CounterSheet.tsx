// Edit or add a counter: name, value, goal, and "repeat every N rows" linked to another counter.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { newCounter, type Counter } from '../core/model';
import { t } from '../i18n';
import { space } from '../theme/tokens';
import { Body, Button, Chip, Field, Label, NumberField, Sheet } from './kit';

export function CounterSheet({
  visible,
  counter,
  others,
  isMain,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  /** undefined = adding a new one. */
  counter?: Counter;
  others: Counter[];
  isMain?: boolean;
  onSave: (c: Counter) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState<number | undefined>(0);
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [every, setEvery] = useState<number | undefined>(undefined);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setLabel(counter?.label ?? t('counter.defaultExtra'));
    setValue(counter?.value ?? 0);
    setTarget(counter?.target);
    setEvery(counter?.every);
    setParentId(counter?.parentId);
    setKey((k) => k + 1);
  }, [visible, counter]);

  const presets = [t('counter.presetRepeat'), t('counter.presetStitch'), t('counter.presetPiece'), t('counter.presetStripe')];

  const save = () => {
    const base = counter ?? newCounter(label);
    onSave({
      ...base,
      label: label.trim() || t('counter.defaultExtra'),
      value: Math.max(0, Math.floor(value ?? 0)),
      target: target && target > 0 ? Math.floor(target) : undefined,
      every: every && every > 0 ? Math.floor(every) : undefined,
      parentId: every && every > 0 ? parentId : undefined,
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={counter ? t('counter.edit') : t('counter.add')}>
      <View key={key} style={{ gap: space.l }}>
        <Field label={t('counter.name')} value={label} onChangeText={setLabel} />
        {!counter ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((p) => (
              <Chip key={p} label={p} on={label === p} onPress={() => setLabel(p)} />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <NumberField style={{ flex: 1 }} label={t('counter.value')} value={value} onChange={setValue} />
          <NumberField style={{ flex: 1 }} label={t('counter.goal')} value={target} onChange={setTarget} placeholder={t('common.optional')} />
        </View>
        {!isMain ? (
          <View style={{ gap: space.s }}>
            <NumberField label={t('counter.repeatEvery')} value={every} onChange={setEvery} placeholder={t('counter.repeatEveryPlaceholder')} />
            {every && every > 0 && others.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Label>{t('counter.whenRepeatDone')}</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label={t('counter.nothing')} on={!parentId} onPress={() => setParentId(undefined)} />
                  {others.map((o) => (
                    <Chip key={o.id} label={t('counter.addOneTo', { label: o.label })} on={parentId === o.id} onPress={() => setParentId(o.id)} />
                  ))}
                </View>
              </View>
            ) : null}
            <Body small muted>
              {t('counter.repeatHelp')}
            </Body>
          </View>
        ) : null}
        <Button title={t('common.save')} icon="check" onPress={save} />
        {onDelete && !isMain ? (
          <Button
            title={t('counter.delete')}
            kind="ghost"
            icon="trash-2"
            onPress={() => {
              onDelete();
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
