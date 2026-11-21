import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInAppDemoSession, DEMO_APP_ART, SCREENSHOT_DEMO_APPS } from '../src/core/demo';
import { STORE_SERVICES } from '../src/core/storeIcons';

/**
 * App Review: a reviewer with no TV can try Couch through "Try a demo TV" on Add a TV (guideline 2.1). It is
 * opt-in only (Couch never starts in it, owner 7 Nov 2026) and shows no streaming service names or icons (5.2).
 */
const read = (f: string): string => readFileSync(join(__dirname, '..', f), 'utf8');

describe('in-app demo for App Review', () => {
  it('uses only the invented apps with original art', async () => {
    const demo = await createInAppDemoSession();
    expect(demo.tvs.length).toBeGreaterThan(0);
    const serviceNames = new Set(STORE_SERVICES.map((s) => s.name.toLowerCase()));
    // The first demo TV is on (the third starts off, like a real TV in standby).
    for (const d of [...demo.drivers.values()].slice(0, 2)) {
      const apps = await d.listApps();
      expect(apps.map((a) => a.id)).toEqual(SCREENSHOT_DEMO_APPS.map((a) => a.id));
      for (const a of apps) {
        expect(DEMO_APP_ART[a.id]).toBeDefined();
        expect(serviceNames.has(a.name.toLowerCase())).toBe(false);
      }
    }
  });

  it('is offered on Add a TV only while no TV is saved, and Couch never starts in it', () => {
    const src = read('app/add-tv.tsx');
    const guard = src.indexOf('snap.tvs.length === 0 ?');
    const row = src.indexOf("title={t('app.addTv.demoTitle')}");
    expect(guard).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(guard);
    expect(src).toMatch(/createInAppDemoSession\(\)/);
    // Start-up loads demo TVs only for simulator capture builds.
    const session = read('src/state/session.tsx');
    const gate = session.indexOf("process.env.EXPO_PUBLIC_COUCH_CAPTURE === '1'");
    expect(gate).toBeGreaterThan(-1);
    expect(session.indexOf('createInAppDemoSession()')).toBeGreaterThan(gate);
    expect(session.match(/createInAppDemoSession\(\)/g)?.length).toBe(1);
  });

  it('has no pretend voice, like real TVs, so the voice key reads "Search on the TV"', async () => {
    const demo = await createInAppDemoSession();
    for (const d of demo.drivers.values()) expect(d.capabilities.has('voice')).toBe(false);
    const btn = read('src/ui/remote/VoiceButton.tsx');
    expect(btn).toMatch(/canTalk \? 'ui\.remote\.holdToTalk' : 'ui\.remote\.searchTv'/);
    expect(btn).toMatch(/canTalk \? VOICE_BUTTON\.icon : 'search'/);
  });
});
