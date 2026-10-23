/**
 * Trial-path safety for the v2 UI in Expo Go (oversight D6-2).
 * - Hold to talk: with no speech-to-text module (Expo Go), a TV without native voice gets the clear
 *   "Voice needs the full app" note and the keyboard sheet; the demo TV still uses native voice.
 * - Infrared setup is not offered on iPhone (no IR emitter).
 * Pure TS + Node built-ins.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { irSetupOffered } from '../src/core/addTv';
import type { TvDriver } from '../src/core/driver';
import { MockTv } from '../src/core/drivers/mock';
import { VOICE_NOTES, VoiceController, voiceMode } from '../src/core/voice';
import { hasSpeechToText, loadSpeechToText } from '../src/native/speech';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** A connected TV with no 'voice' capability (like every real driver in Expo Go today). */
function plainDriver(): TvDriver {
  const tv = new MockTv();
  (tv as unknown as { capabilities: Set<string> }).capabilities = new Set(
    [...tv.capabilities].filter((c) => c !== 'voice'),
  );
  (tv as unknown as { beginVoice?: unknown }).beginVoice = undefined;
  return tv;
}

describe('hold to talk in Expo Go', () => {
  it('has no speech-to-text module in this build', () => {
    expect(loadSpeechToText()).toBeNull();
    expect(hasSpeechToText()).toBe(false);
  });

  it('shows "voice needs the full app" and opens the keyboard for a TV without native voice', async () => {
    const notes: string[] = [];
    let keyboard = 0;
    const driver = plainDriver();
    expect(voiceMode(driver, false)).toBe('keyboard');
    const c = new VoiceController({
      getDriver: () => driver,
      stt: loadSpeechToText(),
      onNote: (n) => notes.push(n),
      onOpenKeyboard: () => keyboard++,
    });
    await c.press();
    await c.release();
    expect(notes).toEqual([VOICE_NOTES.keyboard]);
    expect(VOICE_NOTES.keyboard).toMatch(/needs the full app/);
    expect(keyboard).toBe(1);
    expect(c.state).toBe('idle');
  });

  it('still uses native voice on the demo TV', async () => {
    const tv = new MockTv();
    await tv.connect();
    expect(voiceMode(tv, hasSpeechToText())).toBe('native');
  });

  it('VoiceButton feeds the guarded speech loader into the controller and locks scrolling while held', () => {
    const src = read('src/ui/remote/VoiceButton.tsx');
    expect(src).toMatch(/stt:\s*loadSpeechToText\(\)/);
    expect(src).toMatch(/onOpenKeyboard/);
    expect(src).toMatch(/lockRef\.current\(true\)/);
    expect(src).toMatch(/lockRef\.current\(false\)/);
  });
});

describe('infrared setup on iPhone', () => {
  it('is offered only on Android', () => {
    expect(irSetupOffered('ios')).toBe(false);
    expect(irSetupOffered('web')).toBe(false);
    expect(irSetupOffered('android')).toBe(true);
  });

  it('add-tv guards the infrared row with irSetupOffered(Platform.OS)', () => {
    const src = read('app/add-tv.tsx');
    const guard = src.indexOf('irSetupOffered(Platform.OS) ?');
    const rows = [...src.matchAll(/accessibilityLabel=\{t\('app\.addTv\.irRowLabel'/g)].map((m) => m.index ?? -1);
    expect(guard).toBeGreaterThan(-1);
    expect(rows.length).toBe(1);
    expect(rows[0]).toBeGreaterThan(guard);
    expect(src.indexOf(') : null}', rows[0])).toBeGreaterThan(rows[0]);
    // The only way into /add-tv-ir is that guarded row.
    for (const f of ['app/(tabs)/remote.tsx', 'app/(tabs)/tvs.tsx', 'app/settings.tsx', 'app/(tabs)/apps.tsx']) {
      expect({ f, links: read(f).includes('add-tv-ir') }).toEqual({ f, links: false });
    }
  });
});
