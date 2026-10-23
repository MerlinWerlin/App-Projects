/** Trial kit guard: the owner's one-click start must stay Expo Go compatible and diagnosable. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const cmd = readFileSync(join(root, 'START_TRIAL.cmd'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

describe('trial kit', () => {
  it('uses CRLF line endings', () => {
    expect(cmd.includes('\r\n')).toBe(true);
    expect(/[^\r]\n/.test(cmd)).toBe(false);
  });

  it('checks node, installs, upgrades expo, fixes versions, starts Expo Go over a tunnel', () => {
    const order = ['where node', 'npm install', 'expo install expo@latest', 'expo install expo-blur expo-linear-gradient', 'expo install --fix', 'tsc --noEmit', 'expo start --go --tunnel', 'pause'];
    let at = -1;
    for (const step of order) {
      const i = cmd.indexOf(step, at + 1);
      expect(i).toBeGreaterThan(at);
      at = i;
    }
  });

  it('typechecks after install without blocking the start (D8-1)', () => {
    const line = cmd.split('\r\n').find((l) => l.includes('tsc --noEmit') && l.includes('powershell'));
    expect(line).toBeDefined();
    expect(line).toContain('Tee-Object');
    expect(line).toContain('tsc exit code');
    // no early exit between the typecheck and expo start
    const between = cmd.slice(cmd.indexOf('tsc --noEmit'), cmd.indexOf('expo start --go'));
    expect(between).not.toMatch(/exit \/b|errorlevel/i);
  });

  it('logs to trial-log.txt', () => {
    expect(cmd).toContain('trial-log.txt');
    expect(cmd).toContain('Tee-Object');
  });

  it('keeps native-only packages out until after trial', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const n of ['expo-dev-client', 'react-native-udp', 'react-native-zeroconf', 'react-native-tcp-socket']) {
      expect(deps[n]).toBeUndefined();
    }
    expect(app.plugins).not.toContain('expo-dev-client');
    expect(pkg.devDependencies['@expo/ngrok']).toBeDefined();
  });
});
