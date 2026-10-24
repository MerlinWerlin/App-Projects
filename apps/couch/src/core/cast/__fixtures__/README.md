# Casting fixtures (T76)

These payloads are **reconstructed** from the public UPnP Device Architecture 1.0, MediaRenderer:1,
AVTransport:1 and DIDL-Lite specifications. They were **not** captured from any TV, speaker or
other hardware by this project. Names, addresses and UUIDs are made up and deliberately generic
(no brand names).

- `ssdp-renderer-a.txt`, `ssdp-renderer-b.txt`: M-SEARCH replies for
  `urn:schemas-upnp-org:device:MediaRenderer:1` (CRLF framing; `b` uses lower-case header names).
- `ssdp-notify-alive.txt` / `ssdp-notify-byebye.txt`: NOTIFY announcements for renderer `a`.
- `ssdp-public-location.txt`: a reply whose LOCATION is a public address (must be ignored).
- `ssdp-media-server.txt`: a MediaServer reply (not a renderer; must be ignored).
- `description-urlbase.xml`: description with `<URLBase>` and a path-relative AVTransport controlURL.
- `description-relative.xml`: no URLBase, CDATA friendly name, services on an embedded device,
  a `../` AVTransport controlURL and an absolute RenderingControl controlURL.
- `description-no-avtransport.xml`: a MediaServer with only ContentDirectory.
- `description-offlan-control.xml`: an AVTransport controlURL on a public address (must be refused).
- `soap-*.xml`: AVTransport responses (SetAVTransportURI, Play, GetTransportInfo, GetPositionInfo)
  and a UPnPError fault (714 Illegal MIME-type).

Added for cast-1024 (T89), same rules (reconstructed, generic names):

- `soap-pause-response.xml`, `soap-seek-response.xml`, `soap-stop-response.xml`: empty action responses.
- `soap-get-transport-info-paused.xml` / `-stopped.xml`: PAUSED_PLAYBACK and STOPPED states.
- `description-probe-9197.xml`, `description-probe-52323.xml`: renderers served at the two
  well-known description URLs the direct probe tries (`:9197/dmr`, `:52323/dmr.xml`).
- `description-probe-unicast.xml` + `ssdp-unicast-reply.txt`: a unicast M-SEARCH reply and the
  description it points to; `ssdp-unicast-other-host.txt` points at a different host (must be ignored).
- Test doubles (fake CastTimer, recording fetch, fake renderer, fake UDP socket) live in `../__tests__/fakes.ts`.

Replace with real captures when hardware testing starts; keep the file names so tests keep working.
