// A project: the big row counter, the current pattern step, extra counters, reminders, timer, files,
// photos and notes. Everything saves as you tap.
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { hookLabel } from '../../../src/core/calc';
import {
  bump,
  dueReminders,
  formatClock,
  formatDuration,
  mainCounter,
  newId,
  setValue,
  startTimer,
  stopTimer,
  timeWorked,
  type Counter,
  type Project,
  type Reminder,
} from '../../../src/core/model';
import { stepLabel } from '../../../src/core/pattern';
import { t } from '../../../src/i18n';
import { canUndo, changeCounters, undoLast, updateProject, useData, useProject } from '../../../src/store/data';
import { pickPatternFile, pickPatternImage, pickPhoto } from '../../../src/store/files';
import { useSettings } from '../../../src/store/settings';
import { font, radius, space, useColors } from '../../../src/theme/tokens';
import { BigCounter, MiniCounter } from '../../../src/ui/Counter';
import { CounterSheet } from '../../../src/ui/CounterSheet';
import { haptic } from '../../../src/ui/haptics';
import { Body, Button, Card, Chip, Field, Group, IconButton, Label, NumberField, Row, ScreenScroll, Section, Sheet, Title } from '../../../src/ui/kit';
import { useToast } from '../../../src/ui/Toast';
import { usePattern } from '../../../src/ui/usePattern';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProject(id);
  if (!p) {
    return (
      <ScreenScroll>
        <Stack.Screen options={{ title: '' }} />
        <Body muted>{t('project.missing')}</Body>
      </ScreenScroll>
    );
  }
  return <ProjectBody p={p} />;
}

function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [on]);
  return now;
}

function ProjectBody({ p }: { p: Project }) {
  const { c } = useColors();
  const settings = useSettings();
  const toast = useToast();
  const data = useData();
  const pattern = usePattern(p, settings.terms);
  const main = mainCounter(p)!;
  const extras = p.counters.filter((x) => x.id !== main.id);
  const [editing, setEditing] = useState<Counter | 'new' | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const now = useNow(!!p.timerStart);

  // Keep the screen on while counting.
  useEffect(() => {
    if (!settings.keepAwake) return;
    const tag = `project-${p.id}`;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [settings.keepAwake, p.id]);

  const steps = pattern?.steps ?? [];
  const stepIdx = steps.length ? Math.min(main.value, steps.length - 1) : -1;
  const step = stepIdx >= 0 ? steps[stepIdx] : undefined;
  const finishedPattern = steps.length > 0 && main.value >= steps.length;
  const due = dueReminders(p.reminders, main.value + 1);

  const plusMain = () => {
    changeCounters(p.id, (cs) => bump(cs, main.id, 1), main.value + 1);
    const next = main.value + 1;
    if (main.target && next === main.target) {
      haptic('success');
      toast(t('counter.goalReached', { label: main.label }));
    }
    const upcoming = dueReminders(p.reminders, next + 1);
    if (upcoming.length) {
      haptic('warning');
      toast(t('reminder.toast', { text: upcoming.map((r) => r.text).join(' · ') }));
    }
    if (steps.length && next === steps.length) {
      haptic('success');
      toast(t('pattern.allDone'));
    }
  };
  const minusMain = () => changeCounters(p.id, (cs) => bump(cs, main.id, -1), Math.max(0, main.value - 1));

  const toggleTimer = () => {
    haptic('select');
    updateProject(p.id, (q) => (q.timerStart ? stopTimer(q) : startTimer(q)), false);
  };

  const addFile = async (kind: 'file' | 'image') => {
    const r = kind === 'file' ? await pickPatternFile() : await pickPatternImage();
    if (!r.ok) {
      if (r.reason !== 'cancelled') toast(r.message);
      return;
    }
    updateProject(p.id, (q) => ({ ...q, files: [...q.files, r.value] }));
    haptic('success');
    router.push(`/project/${p.id}/file?f=${r.value.id}`);
  };

  const addPhoto = async (source: 'library' | 'camera') => {
    const r = await pickPhoto(source);
    if (!r.ok) {
      if (r.reason !== 'cancelled') toast(r.message);
      return;
    }
    updateProject(p.id, (q) => ({ ...q, photos: [...q.photos, { uri: r.value, at: Date.now() }], cover: q.cover ?? r.value }));
    haptic('success');
  };

  const photoMenu = () => {
    const opts = [t('photos.camera'), t('photos.library'), t('common.cancel')];
    const run = (i: number) => {
      if (i === 0) addPhoto('camera').catch(() => {});
      if (i === 1) addPhoto('library').catch(() => {});
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 2 }, run);
    else Alert.alert(t('photos.add'), undefined, [{ text: opts[0], onPress: () => run(0) }, { text: opts[1], onPress: () => run(1) }, { text: opts[2], style: 'cancel' }]);
  };

  const yarns = useMemo(() => data.yarns.filter((y) => p.yarnIds.includes(y.id)), [data.yarns, p.yarnIds]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="corner-up-left"
                label={t('common.undo')}
                disabled={!canUndo(p.id)}
                onPress={() => {
                  if (undoLast(p.id)) toast(t('common.undone'));
                }}
              />
              <IconButton icon="edit-3" label={t('project.edit')} onPress={() => router.push(`/project/${p.id}/edit`)} />
            </View>
          ),
        }}
      />
      <ScreenScroll>
        <Title size={28}>{p.name}</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.s }}>
          <Chip icon={p.timerStart ? 'pause' : 'clock'} label={p.timerStart ? formatClock(timeWorked(p, now)) : formatDuration(timeWorked(p))} on={!!p.timerStart} onPress={toggleTimer} />
          {p.hookMm ? <Chip icon="edit-2" label={hookLabel(p.hookMm)} /> : null}
          {p.status !== 'active' ? <Chip label={t(`status.${p.status}`)} /> : null}
        </View>

        {due.length ? (
          <Card style={{ marginTop: space.l, backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
            <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
              <Feather name="bell" size={20} color={c.accent} />
              <Body bold style={{ flex: 1 }}>
                {t('reminder.thisRow', { text: due.map((r) => r.text).join(' · ') })}
              </Body>
            </View>
          </Card>
        ) : null}

        {step ? (
          <Card style={{ marginTop: space.l }} onPress={() => router.push(`/project/${p.id}/pattern`)} label={t('pattern.open')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{finishedPattern ? t('pattern.finished') : `${t('pattern.now')} · ${step.section ? `${step.section} · ` : ''}${stepLabel(step)}`}</Label>
              <Feather name="maximize-2" size={16} color={c.ink3} />
            </View>
            {!finishedPattern ? (
              <>
                {step.notes.length ? (
                  <Body small muted style={{ marginTop: 6 }}>
                    {step.notes.join(' ')}
                  </Body>
                ) : null}
                <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: font.bodyBold, fontSize: 20, lineHeight: 28, color: c.ink, marginTop: 6 }}>
                  {pattern!.show(step.text)}
                </Text>
                {pattern!.issues.get(step.i) ? (
                  <Body small style={{ color: c.warn, marginTop: 6 }}>
                    {t('pattern.countWarn', { got: pattern!.issues.get(step.i)!.got, expected: pattern!.issues.get(step.i)!.expected })}
                  </Body>
                ) : null}
                {steps[stepIdx + 1] ? (
                  <Body small muted style={{ marginTop: 8 }} numberOfLines={1}>
                    {t('pattern.next')}: {stepLabel(steps[stepIdx + 1])} · {pattern!.show(steps[stepIdx + 1].text)}
                  </Body>
                ) : null}
              </>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ marginTop: space.l, paddingVertical: space.xl }}>
          <BigCounter
            counter={main}
            onPlus={plusMain}
            onMinus={minusMain}
            onEdit={() => setEditing(main)}
            subtitle={steps.length ? t('pattern.stepOf', { n: Math.min(main.value, steps.length), total: steps.length }) : undefined}
          />
        </Card>

        <Section
          title={t('counter.more')}
          right={<Chip icon="plus" label={t('counter.add')} onPress={() => setEditing('new')} />}
        >
          {extras.length === 0 ? (
            <Body small muted style={{ paddingHorizontal: 4 }}>
              {t('counter.moreHelp')}
            </Body>
          ) : (
            extras.map((x) => (
              <MiniCounter
                key={x.id}
                counter={x}
                parentLabel={x.parentId ? p.counters.find((o) => o.id === x.parentId)?.label : undefined}
                onPlus={() => {
                  haptic('tap');
                  changeCounters(p.id, (cs) => bump(cs, x.id, 1));
                }}
                onMinus={() => changeCounters(p.id, (cs) => bump(cs, x.id, -1))}
                onEdit={() => setEditing(x)}
              />
            ))
          )}
        </Section>

        <Section title={t('pattern.section')}>
          <Group>
            {p.pattern?.text ? (
              <Row icon="list" title={t('pattern.stepMode')} subtitle={t('pattern.stepsCount', { count: steps.length })} onPress={() => router.push(`/project/${p.id}/pattern`)} />
            ) : (
              <Row icon="clipboard" title={t('pattern.paste')} subtitle={t('pattern.pasteHelp')} onPress={() => router.push(`/project/${p.id}/paste`)} />
            )}
            {p.files.map((f) => (
              <Row key={f.id} icon={f.kind === 'pdf' ? 'file-text' : 'image'} title={f.name} subtitle={f.kind === 'pdf' ? t('files.pdf') : t('files.image')} onPress={() => router.push(`/project/${p.id}/file?f=${f.id}`)} />
            ))}
            <Row icon="file-plus" title={t('files.addPdf')} subtitle={t('files.addPdfHelp')} onPress={() => addFile('file').catch(() => {})} />
            <Row icon="image" title={t('files.addScreenshot')} onPress={() => addFile('image').catch(() => {})} last />
          </Group>
        </Section>

        <Section title={t('reminder.title')} right={<Chip icon="plus" label={t('reminder.add')} onPress={() => setReminderOpen(true)} />}>
          {p.reminders.length === 0 ? (
            <Body small muted style={{ paddingHorizontal: 4 }}>
              {t('reminder.help')}
            </Body>
          ) : (
            <Group>
              {p.reminders.map((r, i) => (
                <Row
                  key={r.id}
                  icon="bell"
                  title={r.text}
                  subtitle={r.until ? t('reminder.ruleUntil', { from: r.from, every: r.every, until: r.until, label: main.label }) : t('reminder.rule', { from: r.from, every: r.every, label: main.label })}
                  right={<IconButton icon="x" label={t('common.delete')} onPress={() => updateProject(p.id, (q) => ({ ...q, reminders: q.reminders.filter((x) => x.id !== r.id) }))} />}
                  last={i === p.reminders.length - 1}
                />
              ))}
            </Group>
          )}
        </Section>

        <Section title={t('photos.title')} right={<Chip icon="camera" label={t('photos.add')} onPress={photoMenu} />}>
          {p.photos.length === 0 ? (
            <Body small muted style={{ paddingHorizontal: 4 }}>
              {t('photos.help')}
            </Body>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {p.photos
                .slice()
                .reverse()
                .map((ph) => (
                  <Image key={ph.uri} source={{ uri: ph.uri }} style={{ width: 120, height: 120, borderRadius: radius.m }} contentFit="cover" accessibilityLabel={t('photos.a11y')} />
                ))}
            </ScrollView>
          )}
        </Section>

        <Section title={t('project.details')}>
          <Group>
            <Row icon="package" title={t('project.yarn')} subtitle={yarns.length ? yarns.map((y) => [y.brand, y.name, y.colour].filter(Boolean).join(' ')).join(', ') : p.yarnNote || t('project.addInEdit')} onPress={() => router.push(`/project/${p.id}/edit`)} />
            <Row icon="user" title={t('project.designer')} subtitle={p.designer || t('project.addInEdit')} onPress={() => router.push(`/project/${p.id}/edit`)} last />
          </Group>
        </Section>

        <Section title={t('project.notes')}>
          <NotesBox p={p} />
        </Section>
      </ScreenScroll>

      <CounterSheet
        visible={editing !== null}
        counter={editing === 'new' ? undefined : (editing ?? undefined)}
        isMain={editing !== 'new' && editing?.id === main.id}
        others={p.counters.filter((x) => editing === 'new' || x.id !== (editing as Counter | null)?.id)}
        onClose={() => setEditing(null)}
        onSave={(cn) => {
          if (editing === 'new') changeCounters(p.id, (cs) => [...cs, cn]);
          else changeCounters(p.id, (cs) => setValue(cs.map((x) => (x.id === cn.id ? { ...cn, drivesPattern: x.drivesPattern } : x)), cn.id, cn.value), cn.id === main.id ? cn.value : undefined);
        }}
        onDelete={editing && editing !== 'new' ? () => changeCounters(p.id, (cs) => cs.filter((x) => x.id !== editing.id).map((x) => (x.parentId === editing.id ? { ...x, parentId: undefined } : x))) : undefined}
      />
      <ReminderSheet
        visible={reminderOpen}
        label={main.label}
        onClose={() => setReminderOpen(false)}
        onSave={(r) => updateProject(p.id, (q) => ({ ...q, reminders: [...q.reminders, r] }))}
      />
    </>
  );
}

function NotesBox({ p }: { p: Project }) {
  const { c } = useColors();
  const [text, setText] = useState(p.notes);
  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== p.notes) updateProject(p.id, (q) => ({ ...q, notes: text }));
    }, 500);
    return () => clearTimeout(id);
  }, [text, p.id, p.notes]);
  return (
    <TextInput
      accessibilityLabel={t('project.notes')}
      value={text}
      onChangeText={setText}
      multiline
      placeholder={t('project.notesPlaceholder')}
      placeholderTextColor={c.ink3}
      style={{ minHeight: 110, padding: space.l, borderRadius: radius.l, backgroundColor: c.surface, color: c.ink, fontFamily: font.body, fontSize: 16, textAlignVertical: 'top' }}
    />
  );
}

function ReminderSheet({ visible, onClose, onSave, label }: { visible: boolean; onClose: () => void; onSave: (r: Reminder) => void; label: string }) {
  const [text, setText] = useState('');
  const [from, setFrom] = useState<number | undefined>(undefined);
  const [every, setEvery] = useState<number | undefined>(undefined);
  const [until, setUntil] = useState<number | undefined>(undefined);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (visible) {
      setText('');
      setFrom(undefined);
      setEvery(undefined);
      setUntil(undefined);
      setKey((k) => k + 1);
    }
  }, [visible]);
  const ok = text.trim() && from && from > 0;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('reminder.add')}>
      <View key={key} style={{ gap: space.l }}>
        <Field label={t('reminder.what')} value={text} onChangeText={setText} placeholder={t('reminder.whatPlaceholder')} />
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <NumberField style={{ flex: 1 }} label={t('reminder.on', { label })} value={from} onChange={setFrom} />
          <NumberField style={{ flex: 1 }} label={t('reminder.every')} value={every} onChange={setEvery} placeholder={t('reminder.once')} />
          <NumberField style={{ flex: 1 }} label={t('reminder.until')} value={until} onChange={setUntil} placeholder={t('common.optional')} />
        </View>
        <Body small muted>
          {t('reminder.example')}
        </Body>
        <Button
          title={t('common.save')}
          icon="check"
          disabled={!ok}
          onPress={() => {
            const ev = every && every > 0 ? Math.floor(every) : 100000;
            onSave({ id: newId('r'), text: text.trim(), from: Math.floor(from!), every: ev, until: until && until > 0 ? Math.floor(until) : ev === 100000 ? Math.floor(from!) : undefined });
            haptic('success');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

