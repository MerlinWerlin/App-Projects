# SSDP / probe fixtures

These payloads are **reconstructed** from public protocol documentation and widely published
captures (Roku ECP docs, samsungtvws / aiowebostv / pybravia issue threads). They were not captured
from hardware by this project. Addresses, serials and UUIDs are made up.

- `roku.txt`, `samsung.txt`, `lg.txt`, `sony.txt`: M-SEARCH responses (CRLF framing) for each search target.
- `router.txt`: a non-TV reply (UPnP gateway) that the parser must ignore.
- `roku-device-info.xml`: `GET http://<ip>:8060/query/device-info` body used by the unicast probe.
- `samsung-api-v2.json`: `GET http://<ip>:8001/api/v2/` body used by the unicast probe.

Replace with real captures when hardware testing starts; keep the file names so tests keep working.
