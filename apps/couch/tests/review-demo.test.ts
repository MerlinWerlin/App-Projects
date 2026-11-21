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

describe('no beta claims, honest content rights (App Review 2.2, 2.3)', () => {
  const listing = JSON.parse(read('store/listing.json')) as { description: string; contentRights: string };

  it('declares third-party content (real TV app icons from the TV or iTunes Search)', () => {
    expect(listing.contentRights).toBe('USES_THIRD_PARTY_CONTENT');
  });

  it('has no "beta" wording or Fire TV claim in the listing, Add a TV or the English catalog', () => {
    expect(JSON.stringify(listing)).not.toMatch(/\bbeta\b/i);
    expect(listing.description).not.toMatch(/Fire TV/);
    expect(read('app/add-tv.tsx')).not.toMatch(/beta/i);
    for (const f of ['app', 'core', 'ui']) {
      const src = read(`src/i18n/catalog/en/${f}.ts`).replace(/^\s*\/\/.*$/gm, '');
      expect({ f, beta: /\bbeta\b/i.test(src) }).toEqual({ f, beta: false });
    }
  });

  it('the Couch website makes no beta or Android TV claims', () => {
    for (const f of ['index.html', 'faq/index.html', 'compare/index.html', 'alternatives/index.html', 'facts.txt']) {
      const html = read(`../../docs/couch/${f}`);
      expect({ f, hit: /\bbeta\b|Android TV/i.test(html) }).toEqual({ f, hit: false });
    }
  });
});
