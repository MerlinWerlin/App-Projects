# Google TV / Android TV fixtures

`frames.json` holds frames of the Android TV Remote v2 protocol as hex (`varint(length)` followed
by the protobuf message; spaces are only for reading). They were **hand-computed from public
knowledge of the protocol** (pairing on :6467, remote on :6466), not captured from hardware. Names
("Living Room TV", "TestTV", "Example") and the secret_ack bytes are made up.

- `pairing_server` — what the TV sends during pairing: pairing_request_ack (server name), options
  (HEXADECIMAL x6, role INPUT), configuration_ack, secret_ack, and error replies with status 402
  (bad secret) and 401 (bad configuration).
- `pairing_client` — what Couch must send: pairing_request (service "atvremote", client
  "Couch Remote"), options, configuration, and the fixed prefix of the secret frame (the 32 secret
  bytes follow).
- `remote_server` — TV → phone on :6466: remote_configure (code1 622 + device_info),
  remote_set_active (empty), remote_start on / off, remote_ping_request (val1 7, val2 9),
  remote_error, and a remote_ime_key_inject the driver does not model (must be ignored).
- `remote_client` — phone → TV: remote_configure with Couch's device_info (package_name
  `com.jared797.couch`, the app.json bundle id; T54), remote_set_active 622,
  ping response, and key injects (DPAD_UP short, POWER short, DPAD_CENTER long press start/end).

The byte-exact tests in `src/core/drivers/androidtv/proto.test.ts` check the encoder against these,
and `driver.test.ts` replays the server frames through a fake TLS socket.
