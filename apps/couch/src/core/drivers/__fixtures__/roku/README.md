# Roku ECP fixtures

These files are **reconstructed from the public Roku External Control Protocol (ECP)
documentation** (developer.roku.com, "External Control Protocol"), not captured from
real hardware. Element names, attribute layout and value formats follow the documented
`GET /query/device-info` and `GET /query/apps` responses; identifiers, MACs and serials
are made up.

- `device-info.xml` — a Roku TV (`is-tv` true) on OS 14.1, powered on, with `&amp;` and
  numeric character references to exercise entity decoding.
- `device-info-player.xml` — a Roku streaming player (`is-tv` false, so no TV inputs),
  trimmed to the fields the driver reads plus a few neighbours.
- `apps.xml` — installed channels including `tvin` inputs and an app name with `&amp;`.

Replace or supplement with real captures (`curl http://<roku>:8060/query/device-info`)
once hardware testing starts (M2), and note the device model and OS version here.
