/**
 * T92 (cast-1024 phase B): the AirPlay / Screen Mirroring shortcut.
 * - src/native/routePicker.ts: false without the native module (Expo Go, Android, tests), passes the
 *   module's answer through, never throws;
 * - modules/route-picker: text checks on the Swift source (it cannot be compiled here);
 * - the button and the guide screen are wired to the adapter and the catalogue.
 * UNVERIFIED on a device.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { _setRoutePickerDeps, hasRoutePicker, showRoutePicker, type RoutePickerModule } from '../src/native/routePicker';
import { ICON_NAMES } from '../src/ui/icons/names';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

function fake(over: Partial<RoutePickerModule> = {}): RoutePickerModule {
  return { show: async () => true, isAvailable: () => true, ...over };
}

afterEach(() => _setRoutePickerDeps());

describe('routePicker adapter', () => {
  it('is false without the native module', async () => {
    expect(hasRoutePicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);
  });

  it('passes the module answer through', async () => {
    _setRoutePickerDeps({ loadModule: () => fake() });
    expect(hasRoutePicker()).toBe(true);
    await expect(showRoutePicker()).resolves.toBe(true);

    _setRoutePickerDeps({ loadModule: () => fake({ show: async () => false }) });
    await expect(showRoutePicker()).resolves.toBe(false);
  });

  it('is false when the module says it is unavailable (and does not call show)', async () => {
    let calls = 0;
    _setRoutePickerDeps({
      loadModule: () =>
        fake({
          isAvailable: () => false,
          show: async () => {
            calls += 1;
            return true;
          },
        }),
    });
    expect(hasRoutePicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);
    expect(calls).toBe(0);
  });

  it('never throws: rejecting show, throwing isAvailable, throwing loader, odd values', async () => {
    _setRoutePickerDeps({ loadModule: () => fake({ show: () => Promise.reject(new Error('boom')) }) });
    await expect(showRoutePicker()).resolves.toBe(false);

    _setRoutePickerDeps({ loadModule: () => fake({ show: () => { throw new Error('sync boom'); } }) });
    await expect(showRoutePicker()).resolves.toBe(false);

    _setRoutePickerDeps({ loadModule: () => fake({ isAvailable: () => { throw new Error('x'); } }) });
    expect(hasRoutePicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);

    _setRoutePickerDeps({ loadModule: () => { throw new Error('load'); } });
    expect(hasRoutePicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);

    _setRoutePickerDeps({ loadModule: () => fake({ show: async () => 'yes' as unknown as boolean }) });
    await expect(showRoutePicker()).resolves.toBe(false);
  });
});

describe('modules/route-picker native sources', () => {
  const dir = 'modules/route-picker';
  const swift = read(`${dir}/ios/RoutePickerModule.swift`);

  it('files exist and the module is registered on Apple only', () => {
    for (const f of ['expo-module.config.json', 'index.ts', 'README.md', 'ios/RoutePickerModule.swift', 'ios/RoutePicker.podspec']) {
      expect({ f, exists: existsSync(join(root, dir, f)) }).toEqual({ f, exists: true });
    }
    const cfg = JSON.parse(read(`${dir}/expo-module.config.json`)) as { platforms: string[]; apple: { modules: string[] } };
    expect(cfg.platforms).toEqual(['apple']);
    expect(cfg.apple.modules).toEqual(['RoutePickerModule']);
    expect(swift).toMatch(/public class RoutePickerModule\s*:\s*Module\b/);
    expect(swift).toContain('Name("RoutePicker")');
    expect(read(`${dir}/index.ts`)).toContain("requireOptionalNativeModule<RoutePickerNativeModule>('RoutePicker')");
    expect(read(`${dir}/ios/RoutePicker.podspec`)).toMatch(/s\.name\s*=\s*'RoutePicker'/);
  });

  it('exposes show (async) and isAvailable', () => {
    expect(swift).toMatch(/AsyncFunction\("show"\)\s*\{\s*\(promise: Promise\) in/);
    expect(swift).toMatch(/Function\("isAvailable"\)\s*\{\s*\(\) -> Bool in/);
  });

  it('taps a hidden AVRoutePickerView button on the main queue, video devices first', () => {
    expect(swift).toContain('import AVKit');
    expect(swift).toContain('AVRoutePickerView(');
    expect(swift).toContain('prioritizesVideoDevices = true');
    expect(swift).toContain('sendActions(for: .touchUpInside)');
    expect(swift).toContain('as? UIButton');
    expect(swift).toContain('removeFromSuperview()');
    // UI work and the promise resolution happen on the main queue, in a @MainActor type
    expect(swift).toMatch(/DispatchQueue\.main\.async \{\s*let shown = RoutePickerPresenter\.present\(\)\s*promise\.resolve\(shown\)/);
    expect(swift).toMatch(/@MainActor\s*\nenum RoutePickerPresenter/);
    expect(swift).toContain('DispatchQueue.main.asyncAfter');
  });

  it('uses the scene key window, not the deprecated UIApplication.keyWindow', () => {
    expect(swift).toContain('connectedScenes');
    expect(swift).toContain('UIWindowScene');
    expect(swift).toContain('isKeyWindow');
    const code = swift.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.shared\.keyWindow|\bUIApplication\.shared\.windows\b/);
  });

  it('never rejects the promise', () => {
    expect(swift).not.toContain('promise.reject');
  });
});

describe('AirPlay button and guide', () => {
  const button = read('src/ui/cast/AirPlayButton.tsx');
  const guide = read('app/airplay.tsx');

  it('the button opens the Screen Mirroring guide (owner feedback 1 Nov 2026: the bare picker left the TV waiting)', () => {
    expect(button).toContain('export default function AirPlayButton');
    expect(button).not.toContain("from '../../native/routePicker'");
    expect(button).toContain('onPress={onShowGuide}');
    expect(button).toContain("label={t('ui.airplay.label')}");
    expect(button).toContain("accessibilityHint={t('ui.airplay.hint')}");
    expect(button).toContain('name="screenMirror"');
    expect(button).toContain('stretch');
    expect(button).not.toMatch(/src\/plus|usePlus/);
    expect(ICON_NAMES).toContain('screenMirror');
  });

  it('the guide has three numbered steps, the Wi-Fi rule and the Cast tab pointer, on v2', () => {
    for (const k of ['title', 'intro', 'step1', 'step2', 'step3', 'stepLabel', 'wifi', 'notOnTv', 'done']) {
      expect(guide).toContain(`'app.airplay.${k}'`);
    }
    expect(guide).toContain('<LargeTitleHeader');
    expect(guide).toContain("from '../src/ui/v2'");
    expect(guide).not.toMatch(/src\/plus|usePlus/);
  });
});
