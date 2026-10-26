/**
 * Google Cast on/off switch (oversight D147-1). Google Cast (T106) is native code that has never
 * compiled. Set this to false and: the app never loads the lan-wss TLS socket, so Cast uses
 * DLNA / AirPlay / demo only; and the iOS build compiles only a stub of LanTls.swift (LanWss.podspec
 * reads this exact line). Keep it a single line of this exact form (tests/google-cast-switch.test.ts).
 */
export const GOOGLE_CAST_ON = true;
