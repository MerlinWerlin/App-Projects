# Samsung Tizen fixtures

These files are **reconstructed from public knowledge of the Tizen remote-control protocol**
(the `samsung.remote.control` WebSocket channel on :8002 and the REST device info on
`:8001/api/v2/`), not captured from real hardware. Identifiers, MACs, tokens and timestamps are
made up.

- `device-info-on.json` — 2020 QLED answering `GET /api/v2/` while on (`PowerState: "on"`,
  `TokenAuthSupport` in `device`). Same as `../ssdp/samsung-api-v2.json`.
- `device-info-standby.json` — same TV in network standby (`PowerState: "standby"`).
- `device-info-2017.json` — older model: no `PowerState`, `TokenAuthSupport` only inside the
  `isSupport` JSON string, upper-case MAC, name without the `[TV]` prefix.
- `frames.json` — incoming WebSocket frames: `ms.channel.connect` with and without a token,
  `ms.channel.unauthorized` (user chose Deny), `ms.channel.timeOut` (Allow prompt expired),
  `ms.channel.clientConnect`, `ms.remote.imeStart` / `imeEnd`, and the
  `ed.installedApp.get` reply (including one malformed entry).
- `icon-frames.json` — UNVERIFIED reconstruction of `ed.apps.icon` replies (`data.iconPath` +
  base64 `imageBase64`): flat, nested one level with a line-wrapped body, empty image, and a reply
  for a different path. The image is a 1x1 solid-colour PNG generated for the test, not any app's
  icon.

Replace or supplement with real captures once hardware testing starts (M2), and note the TV
model and firmware here.
