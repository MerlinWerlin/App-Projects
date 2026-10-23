import { readFileSync } from 'fs';
import { join } from 'path';
import { COUCH_APP_PACKAGE } from './appIdentity';

describe('app identity', () => {
  test('matches app.json android.package and ios.bundleIdentifier', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '..', '..', 'app.json'), 'utf8')) as {
      expo: { android?: { package?: string }; ios?: { bundleIdentifier?: string } };
    };
    expect(app.expo.android?.package).toBe(COUCH_APP_PACKAGE);
    expect(app.expo.ios?.bundleIdentifier).toBe(COUCH_APP_PACKAGE);
    expect(COUCH_APP_PACKAGE).toBe('com.jared797.couch');
  });
});
