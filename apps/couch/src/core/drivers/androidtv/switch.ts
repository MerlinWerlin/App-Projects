/**
 * Google TV remote (Android TV Remote v2) native on/off switch. The mutual-TLS socket and the
 * Keychain client identity (modules/lan-wss/ios/LanAtv.swift) have never compiled. Set this to false
 * and: the app never loads that native code (src/native/androidTvTls.ts returns null), so Google TVs
 * stay "cast only"; and the iOS build compiles only a stub of LanAtv.swift (LanWss.podspec reads
 * this exact line). Keep it a single line of this exact form (tests/androidtv-native.test.ts).
 */
export const ANDROIDTV_NATIVE_ON = true;
