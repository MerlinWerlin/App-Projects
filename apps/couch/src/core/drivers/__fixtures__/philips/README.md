# Philips JointSpace v6 fixtures

**Reconstructed, not captured.** `replies.json` holds one reply per key, shaped after public
descriptions of JointSpace API v6 (ha-philipsjs / pylips behaviour, jointspace community docs):
`/6/system` (unauthenticated), pair request / grant replies incl. `CONCURRENT_PAIRING` and
`INVALID_PIN`, power state, audio volume, the `/6/applications` list (incl. an entry without
an intent), `/6/sources` in both map and array forms, the current source, and a Digest
`WWW-Authenticate` challenge. Keys, nonces, encrypted fields and labels are made up. Every
field is UNVERIFIED.

Replace with real captures once hardware testing starts (`curl -k --digest -u <id>:<key>
https://<tv>:1926/6/applications`) and note model and firmware here.
