import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PALETTES, paletteById } from '../../src/core/palettes';
import { type Edit, type History, apply, markFound, redo, undo } from '../../src/core/progress';
import { layout } from '../../src/core/scene';
import { t, tx } from '../../src/i18n';
import { sceneById } from '../../src/scenes';
import { flushProgress, getProgress, setProgress } from '../../src/store/progress';
import { updateSettings, useSettings } from '../../src/store/settings';
import { radius, space, type as ty, useColors } from '../../src/theme/tokens';
import { Canvas, type CanvasHandle, type DrawTool, type Mode } from '../../src/ui/Canvas';
import { useHaptics } from '../../src/ui/haptics';
import { Button, IconButton } from '../../src/ui/kit';

export default function SceneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scene = sceneById(String(id));
  const router = useRouter();
  const { c } = useColors();
  if (!scene) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <Text style={[ty.body, { color: c.ink2 }]}>{t('gallery.empty')}</Text>
        <Button label={t('tool.back')} onPress={() => router.back()} />
      </View>
    );
  }
  return <Colouring sceneId={scene.id} />;
}

function Colouring({ sceneId }: { sceneId: string }) {
  const scene = sceneById(sceneId)!;
  const L = layout(scene);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c } = useColors();
  const h = useHaptics();
  const settings = useSettings();
  const canvas = useRef<CanvasHandle>(null);

  const [progress, setP] = useState(() => getProgress(scene));
  const hist = useRef<History>({ past: [], future: [] });
  const [histLen, setHistLen] = useState({ past: 0, future: 0 });
  const [mode, setMode] = useState<Mode>('fill');
  const [tool, setTool] = useState<'pencil' | 'marker'>('pencil');
  // The eraser is its own tool in both modes: clears a shape's colour (tap) or rubs out drawing (drag).
  const [erasing, setErasing] = useState(false);
  const [sizeIndex, setSizeIndex] = useState<0 | 1 | 2>(1);
  const [paletteId, setPaletteId] = useState(scene.palette);
  const palette = paletteById(paletteId);
  const [color, setColor] = useState<string>(palette.colors[0] ?? '#B5523B');
  const [focus, setFocus] = useState(L.root.id);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(true);

  const commit = useCallback(
    (next: typeof progress, nh: History) => {
      hist.current = nh;
      setHistLen({ past: nh.past.length, future: nh.future.length });
      setP(next);
      setProgress(scene, next);
    },
    [scene],
  );

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const onEdit = useCallback(
    (e: Edit) => {
      const r = apply(progressRef.current, hist.current, e, Date.now());
      if (r.p !== progressRef.current) {
        if (e.kind === 'fill') h.tap();
        commit(r.p, r.h);
      }
    },
    [commit, h],
  );

  const onFocus = useCallback(
    (levelId: string, visible: string[]) => {
      setFocus(levelId);
      let p = progressRef.current;
      for (const v of visible) {
        if (v === L.root.id || p.found.includes(v)) continue;
        p = markFound(p, v);
        setToast(t('level.found', { name: tx(`scene.${scene.id}.level.${v}`) }));
        h.success();
      }
      if (p !== progressRef.current) {
        progressRef.current = p;
        setP(p);
        setProgress(scene, p);
      }
    },
    [L, scene, h],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => () => flushProgress(), []);

  const focusLevel = L.byId.get(focus) ?? L.root;
  const depthTotal = Math.max(...L.order.map((p) => p.depth)) + 1;
  // "Look closer" flies into the next level from here; at the bottom it flies back out.
  const nextLevel = useMemo(() => {
    const kids = focusLevel.children.map((k) => L.byId.get(k)!);
    return kids.find((k) => !progress.found.includes(k.id)) ?? kids[0] ?? null;
  }, [focusLevel, L, progress.found]);

  const doUndo = () => {
    const r = undo(progressRef.current, hist.current, Date.now());
    commit(r.p, r.h);
  };
  const doRedo = () => {
    const r = redo(progressRef.current, hist.current, Date.now());
    commit(r.p, r.h);
  };
  const doClear = () => {
    Alert.alert(t('menu.clearTitle'), t('menu.clearBody'), [
      { text: t('menu.cancel'), style: 'cancel' },
      { text: t('menu.clearConfirm'), style: 'destructive', onPress: () => onEdit({ kind: 'clear' }) },
    ]);
  };

  const wide = width >= 700;
  const panelW = Math.min(width - space.lg * 2, 760);
  const swatchSize = wide ? 40 : 34;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <Canvas
        ref={canvas}
        L={L}
        progress={progress}
        mode={mode}
        tool={erasing ? ('eraser' as DrawTool) : tool}
        color={erasing ? null : color}
        sizeIndex={sizeIndex}
        insideLines={settings.insideLines}
        onEdit={onEdit}
        onFocus={onFocus}
        onTouchStart={() => setHint(false)}
      />

      {/* top bar */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Bubble>
          <IconButton
            icon="chevron-left"
            label={t('tool.back')}
            onPress={() => {
              flushProgress();
              router.back();
            }}
            size={28}
          />
        </Bubble>
        <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="box-none">
          <View
            accessible
            accessibilityRole="header"
            style={{ backgroundColor: c.card, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, borderWidth: 1, borderColor: c.line, maxWidth: '100%' }}
          >
            <Text style={[ty.bodyBold, { color: c.ink, textAlign: 'center' }]} numberOfLines={1}>
              {tx(`scene.${scene.id}.title`)}
            </Text>
            {depthTotal > 1 ? (
              <Text style={[ty.small, { color: c.ink3, textAlign: 'center' }]} numberOfLines={1}>
                {t('level.where', { name: tx(`scene.${scene.id}.level.${focusLevel.id}`), i: focusLevel.depth + 1, n: depthTotal })}
              </Text>
            ) : null}
          </View>
        </View>
        <Bubble row>
          <IconButton icon="undo-variant" label={t('tool.undo')} onPress={doUndo} disabled={histLen.past === 0} />
          <IconButton icon="redo-variant" label={t('tool.redo')} onPress={doRedo} disabled={histLen.future === 0} />
          <IconButton icon="delete-sweep-outline" label={t('menu.clear')} onPress={doClear} />
        </Bubble>
      </View>

      {/* zoom rail */}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: space.md, top: insets.top + 90, gap: space.sm }}>
        <Bubble>
          <IconButton icon="plus" label={t('zoom.in')} onPress={() => canvas.current?.zoomBy(2)} />
          <IconButton icon="minus" label={t('zoom.out')} onPress={() => canvas.current?.zoomBy(0.5)} />
          <IconButton icon="fit-to-screen-outline" label={t('zoom.fit')} onPress={() => canvas.current?.fit()} />
        </Bubble>
        {depthTotal > 1 ? (
          <Bubble>
            <IconButton
              icon={nextLevel ? 'magnify-plus-outline' : 'arrow-collapse-all'}
              label={nextLevel ? t('zoom.closer') : t('zoom.backOut')}
              active={!!nextLevel && !progress.found.includes(nextLevel.id)}
              onPress={() => (nextLevel ? canvas.current?.flyTo(nextLevel.id) : canvas.current?.fit())}
            />
          </Bubble>
        ) : null}
      </View>

      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 84, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: c.ink, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
            <Text style={[ty.bodyBold, { color: c.bg }]}>{toast}</Text>
          </View>
        </View>
      ) : null}

      {/* tools + palette */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space.md, alignItems: 'center' }}>
        {hint ? (
          <View pointerEvents="none" style={{ marginBottom: space.sm, backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, maxWidth: panelW }}>
            <Text style={[ty.small, { color: c.ink2, textAlign: 'center' }]}>{erasing ? (mode === 'fill' ? t('hint.eraseFill') : t('hint.eraseDraw')) : mode === 'fill' ? t('hint.fill') : t('hint.draw')}</Text>
          </View>
        ) : null}
        <View style={{ width: panelW, backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: space.sm, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
            <Segment
              items={[
                { key: 'fill', icon: 'format-color-fill', label: t('tool.fill') },
                { key: 'draw', icon: 'draw', label: t('tool.draw') },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m as Mode);
                setErasing(false);
                setHint(true);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tool.eraser')}
              accessibilityHint={mode === 'fill' ? t('hint.eraseFill') : t('hint.eraseDraw')}
              accessibilityState={{ selected: erasing }}
              onPress={() => {
                h.select();
                setErasing((e) => !e);
                setHint(true);
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: space.md,
                borderRadius: radius.pill,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1.5,
                borderColor: erasing ? c.accent : c.line,
                backgroundColor: erasing ? c.accent : 'transparent',
              }}
            >
              <MaterialCommunityIcons name={'eraser' as never} size={20} color={erasing ? c.accentInk : c.ink2} />
              <Text style={[ty.small, { color: erasing ? c.accentInk : c.ink2, fontWeight: '700' }]}>{t('tool.eraser')}</Text>
            </Pressable>
            {mode === 'draw' ? (
              <>
                <View style={{ width: 1, height: 28, backgroundColor: c.line, marginHorizontal: space.xs }} />
                <IconButton icon="pencil-outline" label={t('tool.pencil')} active={!erasing && tool === 'pencil'} onPress={() => { setTool('pencil'); setErasing(false); }} />
                <IconButton icon="marker" label={t('tool.marker')} active={!erasing && tool === 'marker'} onPress={() => { setTool('marker'); setErasing(false); }} />
                {!erasing
                  ? ([0, 1, 2] as const).map((i) => (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        accessibilityLabel={t('tool.size', { n: i + 1 })}
                        accessibilityState={{ selected: sizeIndex === i }}
                        onPress={() => setSizeIndex(i)}
                        style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <View
                          style={{
                            width: 6 + i * 6,
                            height: 6 + i * 6,
                            borderRadius: 12,
                            backgroundColor: sizeIndex === i ? c.accent : c.ink3,
                          }}
                        />
                      </Pressable>
                    ))
                  : null}
                {!erasing ? (
                  <IconButton
                    icon={settings.insideLines ? 'shape-outline' : 'shape-plus'}
                    label={t('tool.inside')}
                    active={settings.insideLines}
                    onPress={() => updateSettings({ insideLines: !settings.insideLines })}
                  />
                ) : null}
              </>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingHorizontal: 2 }}>
            {PALETTES.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: p.id === paletteId }}
                accessibilityLabel={tx(`palette.${p.id}`)}
                onPress={() => {
                  setPaletteId(p.id);
                  setColor(p.colors[0] ?? color);
                }}
                style={{
                  minHeight: 32,
                  paddingHorizontal: space.md,
                  borderRadius: radius.pill,
                  justifyContent: 'center',
                  backgroundColor: p.id === paletteId ? c.ink : 'transparent',
                }}
              >
                <Text style={[ty.small, { color: p.id === paletteId ? c.bg : c.ink2, fontWeight: '700' }]}>{tx(`palette.${p.id}`)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, alignItems: 'center' }}>
            {palette.colors.map((col, i) => {
              const on = !erasing && color === col;
              return (
                <Pressable
                  key={col}
                  accessibilityRole="button"
                  accessibilityLabel={t('colour.swatch', { n: i + 1 })}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setColor(col);
                    setErasing(false);
                  }}
                  style={{
                    width: swatchSize + 8,
                    height: swatchSize + 8,
                    borderRadius: (swatchSize + 8) / 2,
                    borderWidth: 3,
                    borderColor: on ? c.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ width: swatchSize, height: swatchSize, borderRadius: swatchSize / 2, backgroundColor: col, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function Bubble({ children, row = false }: { children: ReactNode; row?: boolean }) {
  const { c } = useColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 28, borderWidth: 1, borderColor: c.line, padding: 2, flexDirection: row ? 'row' : 'column' }}>
      {children}
    </View>
  );
}

function Segment({ items, value, onChange }: { items: { key: string; icon: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const { c } = useColors();
  const h = useHaptics();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: radius.pill, padding: 3 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              h.select();
              onChange(it.key);
            }}
            style={{
              minHeight: 44,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: on ? c.card : 'transparent',
            }}
          >
            <MaterialCommunityIcons name={it.icon as never} size={20} color={on ? c.accent : c.ink2} />
            <Text style={[ty.small, { color: on ? c.ink : c.ink2, fontWeight: on ? '700' : '500' }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
