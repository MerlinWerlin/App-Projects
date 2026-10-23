# Vizio SmartCast fixtures

**Reconstructed, not captured.** `replies.json` holds one reply per key, shaped after public
descriptions of the SmartCast API (pyvizio behaviour and community API notes): the
`{STATUS:{RESULT,DETAIL}, ITEM | ITEMS}` envelope, pairing start/pair/cancel, power mode,
volume, current input and the `name_input` list (incl. a read-only CAST entry and inputs with
and without user labels). Hash values, tokens and labels are made up. Every field and result
string is UNVERIFIED.

Replace with real captures once hardware testing starts (`curl -k -H 'AUTH: <token>'
https://<tv>:7345/menu_native/dynamic/tv_settings/devices/name_input`) and note model and
firmware here.
