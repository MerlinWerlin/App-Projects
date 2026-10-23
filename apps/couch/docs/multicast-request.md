# Apple Multicast Networking Entitlement — request text

**Owner action.** Signed in at developer.apple.com, open the request form at
https://developer.apple.com/contact/request/networking-multicast (if Apple has moved it, search for
"multicast networking entitlement request"), enter the app name and bundle ID below and paste the
description and address list. Approval typically takes a few days to a couple of weeks.
The full step-by-step, including what to do after approval (enable the capability on the identifier, then
build with `COUCH_MULTICAST_ENTITLEMENT=1` so the config plugin adds
`com.apple.developer.networking.multicast`), is in `docs/RELEASING.md`, section (d).

---

**App name:** Couch

**Bundle ID:** com.jared797.couch

**Description of use (paste into the form):**

> Couch is a free universal remote control for smart TVs and streaming players on the user's home Wi-Fi network. To find the user's TV without asking them to type an IP address, the app sends SSDP (UPnP) M-SEARCH discovery requests to the multicast address 239.255.255.250 on UDP port 1900 and listens for unicast replies from TVs on the local network. Several major TV platforms advertise themselves only through SSDP, not Bonjour, so mDNS alone cannot discover them.
>
> Multicast is used only on the local network, only while the user is on the "Add a TV" screen or reconnecting to a TV they already saved, and only to send discovery requests and receive TV responses. No data is sent to any server; the app has no backend, no analytics and no tracking. All TV control traffic is unicast to the TV's local IP address.
>
> Without the entitlement, users must find and enter their TV's IP address manually, which is the main source of setup failure for remote apps in this category.

**Multicast addresses and ports used:**
- 239.255.255.250:1900 (SSDP M-SEARCH) — search targets: `roku:ecp`, `urn:samsung.com:device:RemoteControlReceiver:1`, `urn:lge-com:service:webos-second-screen:1`, `urn:schemas-sony-com:service:IRCC:1`, `urn:dial-multiscreen-org:service:dial:1`
- mDNS (224.0.0.251:5353) is handled through Bonjour (`NSBonjourServices` lists `_androidtvremote2._tcp`, `_amzn-wplay._tcp`, `_viziocast._tcp`) and does not need this entitlement.

**Fallback while waiting:** manual IP entry plus a unicast probe of the local /24 subnet
(`http://<ip>:8060/query/device-info`, `http://<ip>:8001/api/v2/`). This works without the entitlement but is slower.
