// Add or edit a yarn in the stash.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { YARN_WEIGHTS } from '../../src/core/calc';
import { newId, type Yarn } from '../../src/core/model';
import { t } from '../../src/i18n';
import { deleteYarn, saveYarn, useData } from '../../src/store/data';
import { pickPhoto } from '../../src/store/files';
import { radius, space } from '../../src/theme/tokens';
import { Button, Chip, Field, Label, NumberField, PressableScale, ScreenScroll, Stepper } from '../../src/ui/kit';
import { useToast } from '../../src/ui/Toast';

const SWATCHES = ['#F2EDE4', '#E8C5C0', '#D9734E', '#B5476A', '#8E5BA6', '#4F6FA8', '#5B9BB0', '#6E9E6B', '#C9B458', '#8B5E3C', '#5A5A5A', '#1F1F1F'];

export default function YarnEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const toast = useToast();
  const existing = data.yarns.find((y) => y.id === id);
  const [y, setY] = useState<Yarn>(
    existing ?? { id: newId('y'), brand: '', name: '', colour: '', balls: 1, createdAt: Date.now() },
  );
  const patch = (p: Partial<Yarn>) => setY((v) => ({ ...v, ...p }));

  const photo = async () => {
    const r = await pickPhoto('camera');
    if (r.ok) patch({ photo: r.value });
    else if (r.reason !== 'cancelled') toast(r.message);
  };

  return (
    <ScreenScroll keyboard>
      <View style={{ gap: space.l }}>
        {y.photo ? <Image source={{ uri: y.photo }} style={{ height: 160, borderRadius: radius.l }} contentFit="cover" /> : null}
        <Button title={y.photo ? t('stash.retakePhoto') : t('stash.photoLabel')} kind="secondary" icon="camera" onPress={() => photo().catch(() => {})} />
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <Field style={{ flex: 1 }} label={t('stash.brand')} value={y.brand} onChangeText={(v) => patch({ brand: v })} />
          <Field style={{ flex: 1 }} label={t('stash.name')} value={y.name} onChangeText={(v) => patch({ name: v })} />
        </View>
        <Field label={t('stash.colour')} value={y.colour} onChangeText={(v) => patch({ colour: v })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SWATCHES.map((s) => (
            <PressableScale key={s} label={s} role="radio" onPress={() => patch({ swatch: s })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: s, borderWidth: y.swatch === s ? 3 : 1, borderColor: y.swatch === s ? '#B5476A' : 'rgba(0,0,0,0.15)' }}>
              <View />
            </PressableScale>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Label>{t('tool.yarn.weight')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {YARN_WEIGHTS.map((w) => (
              <Chip key={w.cyc} label={`${w.cyc} ${w.us.split(' /')[0]}`} on={y.cyc === w.cyc} onPress={() => patch({ cyc: y.cyc === w.cyc ? undefined : w.cyc })} />
            ))}
          </View>
        </View>
        <Field label={t('stash.fibre')} value={y.fibre ?? ''} onChangeText={(v) => patch({ fibre: v })} placeholder={t('stash.fibrePlaceholder')} />
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <NumberField style={{ flex: 1 }} label={t('stash.metresPerBall')} value={y.metresPerBall} onChange={(v) => patch({ metresPerBall: v })} />
          <NumberField style={{ flex: 1 }} label={t('stash.gramsPerBall')} value={y.gramsPerBall} onChange={(v) => patch({ gramsPerBall: v })} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>{t('stash.ballsLabel')}</Label>
          <Stepper label={t('stash.ballsLabel')} value={y.balls} onChange={(v) => patch({ balls: v })} />
        </View>
        <Field label={t('project.notes')} value={y.notes ?? ''} onChangeText={(v) => patch({ notes: v })} multiline />
        <Button
          title={t('common.save')}
          icon="check"
          onPress={() => {
            saveYarn(y);
            router.back();
          }}
        />
        {existing ? (
          <Button
            title={t('stash.delete')}
            kind="ghost"
            icon="trash-2"
            onPress={() =>
              Alert.alert(t('stash.deleteTitle'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  style: 'destructive',
                  onPress: () => {
                    deleteYarn(y.id);
                    router.back();
                  },
                },
              ])
            }
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}
