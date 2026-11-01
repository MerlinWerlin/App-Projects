/** T12: the app config carries the local-network keys every driver depends on. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MDNS_BROWSE_TYPES } from '../src/core/discovery';

const root = join(__dirname, '..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

describe('app config', () => {
  it('declares local network usage on iOS', () => {
    expect(app.ios.infoPlist.NSLocalNetworkUsageDescription).toMatch(/Wi-Fi/);
    // Plain-http LAN control (Roku ECP :8060, TV-served icons) in a dev/release build; never arbitrary loads.
    expect(app.ios.infoPlist.NSAppTransportSecurity).toEqual({ NSAllowsLocalNetworking: true });
  });

  it('lists every mDNS service type the drivers browse', () => {
    expect(app.ios.infoPlist.NSBonjourServices).toEqual(
      expect.arrayContaining(['_androidtvremote2._tcp', '_amzn-wplay._tcp', '_viziocast._tcp', '_googlecast._tcp']),
    );
    // iOS only lets NWBrowser browse types listed here, so every type discovery browses must be in it.
    expect(app.ios.infoPlist.NSBonjourServices).toEqual(expect.arrayContaining([...MDNS_BROWSE_TYPES]));
    // AirPlay is the system route picker's job; Couch does not browse it.
    expect(app.ios.infoPlist.NSBonjourServices).not.toContain('_airplay._tcp');
  });

  it('wires the LAN access plugin', () => {
    expect(app.plugins).toContain('./plugins/withLanAccess');
  });

  it('keeps brand names out of the app name', () => {
    for (const b of ['Roku', 'Samsung', 'LG', 'Google', 'Fire', 'Android', 'Sony', 'Vizio', 'Philips', 'Apple']) {
      expect(app.name).not.toMatch(new RegExp(`\\b${b}\\b`, 'i'));
    }
  });

  it('plugin requests multicast, Wi-Fi and IR permissions on Android', () => {
    const src = readFileSync(join(root, 'plugins/withLanAccess.js'), 'utf8');
    for (const p of ['CHANGE_WIFI_MULTICAST_STATE', 'ACCESS_WIFI_STATE', 'TRANSMIT_IR', 'usesCleartextTraffic']) {
      expect(src).toContain(p);
    }
  });
});
