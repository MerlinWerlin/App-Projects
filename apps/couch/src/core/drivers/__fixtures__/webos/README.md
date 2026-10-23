# LG webOS fixtures

These frames are **reconstructed from public knowledge of the webOS SSAP protocol** (the JSON
socket on `wss://<tv>:3001` / legacy `ws://<tv>:3000`, as described by aiowebostv (Apache-2.0)
and the LG Connect SDK), not captured from real hardware. IPs, client-keys, resource hashes and
icon URLs are made up; the icon URLs point at nothing real.

`frames.json` holds incoming SSAP frames. Request/response frames carry `"id": "<id>"`; tests
substitute the id of the request they answer. Register frames use the fixed id `register_0`.

- `registerPrompt` — first reply to `register` without a client-key: the Allow prompt is showing.
- `registered` — the user chose Allow (or the stored client-key was accepted); carries `client-key`.
- `registerDenied` / `registerCancelled` — user chose Deny / the prompt was dismissed.
- `hello` — an unrelated frame some firmware sends; must be ignored.
- `pointerSocket` / `pointerSocketLegacy` — `getPointerInputSocket` replies with a `wss://` and a
  `ws://` socketPath.
- `ok`, `insufficientPermissions` (401), `noSuchService` (404), `returnValueFalse` — generic
  replies and failures.
- `launchPoints` — `listLaunchPoints` reply with `icon` / `largeIcon` URLs, an app with an empty
  icon, an entry without an id and a duplicate launch point for one app.
- `launchPointsOffLan` — launch points whose icons are a cloud URL, a TV URL and a bare file path;
  only the TV URL may reach a tile (T66).
- `apps` — `listApps` reply (fallback shape).
- `inputList` — `getExternalInputList` reply (`devices[]` with `id`, `label`, `appId`), including
  a renamed input and an entry without an id.
- `foregroundHdmi2` — `getForegroundAppInfo` while HDMI 2 is showing.
- `volumeLegacy` / `volumeStatus` — `getVolume` on older firmware (`volume` at top level) and on
  webOS 5+ (`volumeStatus.volume`). The second shape is UNVERIFIED.

Pointer-socket frames are outgoing text only (`type:button\nname:UP\n\n`); there is nothing
incoming to record for them.

Replace or supplement with real captures once hardware testing starts, and note the TV model and
webOS version here.
