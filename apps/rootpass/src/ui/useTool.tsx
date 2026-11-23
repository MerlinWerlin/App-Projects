import { Icon } from './Icon.tsx';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native';
import { convertValues, newJobId, type Job } from '../core/jobs.ts';
import type { PdfDoc } from '../core/pdf.ts';
import { parseNum, toMm, unitLabel, type UnitSystem } from '../core/units.ts';
import { sharePdf, printPdf } from '../native/exportPdf.ts';
import type { ToolId } from '../plus/entitlement.ts';
import { useApp } from '../state/AppState.tsx';
import { Btn, Card, Screen, Txt } from './kit.tsx';
import { C, RADIUS, SPACE } from './theme.ts';
import { TOOL_META } from './tools.ts';

export function useTool(tool: ToolId, defaults: Record<string, string>, lengthKeys: readonly string[]) {
  const app = useApp();
  const router = useRouter();
  const units = app.prefs.units;
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  const [state, setState] = useState<{ units: UnitSystem; values: Record<string, string> }>(() => {
    // A link such as rootpass://tool/saddle?angle=60 can preset fields (metric values, like the defaults).
    const preset: Record<string, string> = {};
    for (const k of Object.keys(defaults)) {
      const p = params[k];
      if (typeof p === 'string' && p.length <= 40) preset[k] = p;
    }
    return { units, values: convertValues({ ...defaults, ...preset }, lengthKeys, 'metric', units) };
  });
  const loadedJob = useRef<string | null>(null);

  useEffect(() => {
    const id = typeof params.job === 'string' ? params.job : null;
    if (!id || loadedJob.current === id) return;
    const job = app.jobs.find(j => j.id === id && j.tool === tool);
    if (!job) return;
    loadedJob.current = id;
    setJobId(job.id);
    setJobName(job.name);
    setState({ units, values: convertValues({ ...defaults, ...job.values }, lengthKeys, job.units, units) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.job, app.jobs]);

  useEffect(() => {
    setState(s => (s.units === units ? s : { units, values: convertValues(s.values, lengthKeys, s.units, units) }));
  }, [units, lengthKeys]);

  const v = state.values;
  const set = useCallback((key: string) => (val: string) => setState(s => ({ ...s, values: { ...s.values, [key]: val } })), []);
  const setMany = useCallback((vals: Record<string, string>) => setState(s => ({ ...s, values: { ...s.values, ...vals } })), []);
  /** A length field in millimetres (NaN if empty or not a number). */
  const mm = (key: string) => toMm(parseNum(v[key]), state.units);
  /** A plain number (angle, count, %). */
  const num = (key: string) => parseNum(v[key]);
  const invalid = (key: string) => v[key] !== undefined && v[key].trim() !== '' && !Number.isFinite(parseNum(v[key]));

  const save = useCallback(() => {
    if (!app.can('saveJobs')) {
      Alert.alert('Save jobs with Full Unlock', 'Saving jobs is part of Full Unlock (or the free 7-day trial).', [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Full Unlock', onPress: () => router.push('/unlock') },
      ]);
      return;
    }
    const write = async (name: string) => {
      const job: Job = { id: jobId ?? newJobId(Date.now()), tool, name: name.trim() || TOOL_META[tool].title, units: state.units, values: state.values, savedAt: Date.now() };
      try {
        await app.saveJob(job);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setJobId(job.id);
        setJobName(job.name);
      } catch {
        Alert.alert('Could not save', 'The job could not be saved on this phone. Free some storage and try again.');
      }
    };
    if (Platform.OS === 'ios') {
      Alert.prompt('Save job', 'Name it so you can find it on the Jobs tab.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: (name?: string) => void write(name ?? '') },
      ], 'plain-text', jobName ?? '');
    } else void write(jobName ?? TOOL_META[tool].title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, jobId, jobName, state, tool]);

  return { v, set, setMany, mm, num, invalid, units: state.units, u: unitLabel(state.units), save, jobName };
}

/**
 * The frame every tool shares: title, Save in the top right, and, for a Full Unlock tool while locked, a real preview:
 * the tool's own result for its sample job (template, drawing, cut plan), the top part clear and the rest blurred
 * under an unlock card, so people see exactly what they would get.
 */
export function ToolScreen({ tool, onSave, jobName, children, preview }: { tool: ToolId; onSave?: () => void; jobName?: string | null; children: ReactNode; preview?: ReactNode }) {
  const app = useApp();
  const router = useRouter();
  const meta = TOOL_META[tool];
  // Capture builds can show the locked view with ?lockedPreview=1 (store screenshots and review only).
  const { lockedPreview } = useLocalSearchParams<{ lockedPreview?: string }>();
  const forceLocked = app.capture && lockedPreview === '1';
  const open = app.can(tool) && !forceLocked;
  return (
    <>
      <Stack.Screen
        options={{
          title: jobName ?? app.sp(meta.title),
          headerRight: open && onSave ? () => (
            <Pressable onPress={onSave} accessibilityRole="button" accessibilityLabel="Save job" hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bookmark" size={24} color={C.accent} />
            </Pressable>
          ) : undefined,
        }}
      />
      {open ? <Screen>{children}</Screen> : (
        <Screen>
          <View style={{ gap: SPACE.sm }}>
            <Txt v="title" accessibilityRole="header">{meta.title}</Txt>
            <Txt v="body" tone="ink2">{meta.pitch}</Txt>
          </View>
          {preview ? (
            <View style={{ borderRadius: RADIUS.lg, overflow: 'hidden', maxHeight: 460 }} accessible accessibilityLabel={app.sp(`Sample ${meta.title.toLowerCase()} result, blurred. Unlock to use it with your own sizes.`)}>
              <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{preview}</View>
              <BlurView intensity={28} tint="dark" style={{ position: 'absolute', left: 0, right: 0, top: 150, bottom: 0 }} />
              <View style={{ position: 'absolute', top: SPACE.md, right: SPACE.md, backgroundColor: C.accent, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4 }}>
                <Txt v="label" tone="accentInk" style={{ fontSize: 13 }}>Sample</Txt>
              </View>
            </View>
          ) : null}
          <Card tone="accent">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
              <Icon name="lock" size={22} color={C.accent} />
              <Txt v="headline" style={{ flex: 1 }}>{meta.title} is part of Full Unlock</Txt>
            </View>
            <Txt v="body" tone="ink2">Try everything free for 7 days, then one payment unlocks it for good. No subscription.</Txt>
            <Btn label="Try it free" icon="flash" onPress={() => router.push('/unlock')} />
          </Card>
        </Screen>
      )}
    </>
  );
}

/** Print or share a template PDF, behind Full Unlock. */
export function usePdfExport() {
  const app = useApp();
  const router = useRouter();
  return useCallback((make: () => { doc: PdfDoc; fileName: string } | null) => {
    if (!app.can('pdf')) {
      Alert.alert('Printable templates are in Full Unlock', 'Start the free 7-day trial or unlock once to print true-scale templates.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Full Unlock', onPress: () => router.push('/unlock') },
      ]);
      return;
    }
    const made = make();
    if (!made) return;
    const run = async (how: 'print' | 'share') => {
      try {
        if (how === 'print') await printPdf(made.doc, made.fileName);
        else await sharePdf(made.doc, made.fileName);
      } catch (e) {
        Alert.alert('Could not make the PDF', `Nothing was lost; please try again. [${String((e as { message?: string })?.message ?? e).slice(0, 80)}]`);
      }
    };
    const pages = made.doc.pages.length;
    const title = `${pages} sheet${pages === 1 ? '' : 's'} of ${app.prefs.paper === 'letter' ? 'US Letter' : 'A4'}`;
    const message = 'Print at 100 % (Actual size). Check the 100 mm ruler on the sheet with a tape before marking out.';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ title, message, options: ['Print', 'Save or share PDF', 'Cancel'], cancelButtonIndex: 2 }, i => {
        if (i === 0) void run('print');
        if (i === 1) void run('share');
      });
    } else void run('share');
  }, [app, router]);
}
