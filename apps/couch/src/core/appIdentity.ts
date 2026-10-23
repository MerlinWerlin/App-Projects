/**
 * owner-1016 T54: the app's real bundle id / package name, as set in app.json (android.package and
 * ios.bundleIdentifier, T45). Drivers whose protocol identifies the app to the TV by a package-like
 * id use this one constant; src/core/appIdentity.test.ts checks it against app.json so they never
 * drift. Device names shown on the TV ("Couch Remote") are separate and stay as they are.
 */
export const COUCH_APP_PACKAGE = 'com.jared797.couch';
