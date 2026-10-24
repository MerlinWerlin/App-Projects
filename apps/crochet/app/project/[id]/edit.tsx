// Edit project details.
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { CARD_COLOURS, timeWorked, type ProjectStatus } from '../../../src/core/model';
import { t } from '../../../src/i18n';
import { deleteProject, restoreProject, updateProject, useData, useProject } from '../../../src/store/data';
import { space, useColors, yarnColour } from '../../../src/theme/tokens';
import { Body, Button, Chip, Field, Label, NumberField, PressableScale, ScreenScroll } from '../../../src/ui/kit';
import { useToast } from '../../../src/ui/Toast';

export default function EditProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProject(id);
  const data = useData();
  const toast = useToast();
  const { dark } = useColors();
  const [name, setName] = useState(p?.name ?? '');
  const [designer, setDesigner] = useState(p?.designer ?? '');
  const [url, setUrl] = useState(p?.patternUrl ?? '');
  const [yarnNote, setYarnNote] = useState(p?.yarnNote ?? '');
  const [hook, setHook] = useState<number | undefined>(p?.hookMm);
  const [status, setStatus] = useState<ProjectStatus>(p?.status ?? 'active');
  const [colour, setColour] = useState(p?.colour ?? 'rose');
  const [yarnIds, setYarnIds] = useState<string[]>(p?.yarnIds ?? []);

  if (!p) return null;

  const save = () => {
    updateProject(p.id, (q) => ({
      ...q,
      name: name.trim() || q.name,
      designer: designer.trim() || undefined,
      patternUrl: url.trim() || undefined,
      yarnNote: yarnNote.trim() || undefined,
      hookMm: hook,
      status,
      finishedAt: status === 'finished' ? (q.finishedAt ?? Date.now()) : undefined,
      timeMs: status !== 'active' ? timeWorked(q) : q.timeMs,
      timerStart: status !== 'active' ? undefined : q.timerStart,
      colour,
      yarnIds,
    }));
    router.back();
  };

  const remove = () => {
    Alert.alert(t('project.deleteTitle', { name: p.name }), t('project.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const gone = deleteProject(p.id);
          router.dismissAll();
          if (gone) toast({ text: t('projects.deleted', { name: gone.name }), action: { label: t('common.undo'), run: () => restoreProject(gone) } });
        },
      },
    ]);
  };

  return (
    <ScreenScroll keyboard>
      <View style={{ gap: space.l }}>
        <Field label={t('project.name')} value={name} onChangeText={setName} />
        <View style={{ gap: 6 }}>
          <Label>{t('project.status')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['planned', 'active', 'finished', 'frogged'] as const).map((s) => (
              <Chip key={s} label={t(`status.${s}`)} on={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        </View>
        <NumberField label={t('project.hookMm')} value={hook} onChange={setHook} decimals placeholder="5" />
        <View style={{ gap: 6 }}>
          <Label>{t('project.yarnFromStash')}</Label>
          {data.yarns.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {data.yarns.map((y) => (
                <Chip
                  key={y.id}
                  label={[y.brand, y.name, y.colour].filter(Boolean).join(' ') || t('stash.untitled')}
                  on={yarnIds.includes(y.id)}
                  onPress={() => setYarnIds(yarnIds.includes(y.id) ? yarnIds.filter((x) => x !== y.id) : [...yarnIds, y.id])}
                />
              ))}
            </ScrollView>
          ) : (
            <Body small muted>
              {t('project.noStash')}
            </Body>
          )}
        </View>
        <Field label={t('project.yarnNote')} value={yarnNote} onChangeText={setYarnNote} placeholder={t('project.yarnNotePlaceholder')} />
        <Field label={t('project.designer')} value={designer} onChangeText={setDesigner} />
        <Field label={t('project.patternLink')} value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        {/^https?:\/\//.test(url.trim()) ? (
          <Button title={t('project.openLink')} kind="ghost" icon="external-link" onPress={() => WebBrowser.openBrowserAsync(url.trim()).catch(() => toast(t('project.linkFailed')))} />
        ) : null}
        <View style={{ gap: 6 }}>
          <Label>{t('project.colour')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CARD_COLOURS.map((k) => {
              const col = yarnColour(k, dark);
              return (
                <PressableScale
                  key={k}
                  label={k}
                  role="radio"
                  onPress={() => setColour(k)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col.bg, borderWidth: colour === k ? 3 : 0, borderColor: col.ink }}
                >
                  <View />
                </PressableScale>
              );
            })}
          </View>
        </View>
        <Button title={t('common.save')} icon="check" onPress={save} />
        <Button title={t('project.delete')} kind="ghost" icon="trash-2" onPress={remove} />
      </View>
    </ScreenScroll>
  );
}
