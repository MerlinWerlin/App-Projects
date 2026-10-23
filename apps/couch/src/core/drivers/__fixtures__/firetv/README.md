# Fire TV fixtures (BETA driver)

**Reconstructed, not captured.** `replies.json` holds one reply per key, shaped after public
Home Assistant community notes on the Fire TV remote protocol:

- `wake*` — body of `POST http://<tv>:8009/apps/FireTVRemote` (DIAL). A Fire OS TV answers 201
  with an empty body; `wakeVegaXml` is a guess at what a Vega OS device might say.
- `pinDisplay`, `pinVerify`, `pinVerifyWrong` — `POST https://<tv>:8080/v1/FireTV/pin/display` and
  `/pin/verify`; the client token is assumed to come back in `description`.
- `properties*` — `GET /v1/FireTV/properties`. Both the path and the `os` / `platform` fields are
  guesses; the driver tolerates a 404 here.
- `apps`, `appsLanIcons` — `GET /v1/FireTV/apps`, bare array or `{apps: [...]}`. Icon URLs on
  `*.example` stand in for Amazon CDN URLs (never fetched); the LAN icon in `appsLanIcons` is
  hypothetical, there to exercise the `appIcons` rule.

Tokens, models and names are made up. Every path, header value (`x-api-key`), field and action
name is UNVERIFIED. The `:8080` service uses a self-signed certificate, so captures need
`curl -k -H 'x-api-key: <key>' -H 'x-client-token: <token>' https://<tv>:8080/v1/FireTV/apps`.

Replace with real captures once hardware testing starts and note model and Fire OS version here,
plus a Vega OS device's wake/properties replies.
