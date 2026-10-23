# App tile icons (T66, market-1018 M4)

App tiles show only the icon the TV itself supplies at runtime. Couch never bundles, draws,
recolours or name-matches a streaming service's logo. When the TV gives no icon, the tile is the
typographic house tile (the app's name in Couch type on a gradient picked from the app id;
`src/core/apps.ts`).

## Path

1. `driver.listApps()` loads the app list (and, inside the driver, each app's icon reference).
2. `driverIconFetch(driver)` (`src/core/appIconCache.ts`) returns the driver's `appIcon` only when
   the driver advertises the `appIcons` capability; otherwise there is no fetcher and every tile
   uses the house style without any request.
3. `AppIconCache.get(tvId, app, fetch)` dedupes, caches (LRU by count and characters, keyed by TV
   + app), remembers failures for 5 minutes and times out after 8 s. It accepts only a base64
   `data:image/...` URI or an `http(s)` URL (`isDisplayableIconUri`); anything else (file paths,
   `file:`, `javascript:`, non-image data:) is treated as "no icon".
4. Drivers that read URLs out of a TV reply return them only when `isTvSuppliedIcon` holds: the
   URL's host is the TV's own host or a literal RFC 1918 address. Cloud/CDN URLs are dropped, so an
   icon never causes a request outside the local network.
5. `AppTile` (`src/ui/apps/AppTile.tsx`) shows the image as served: 4:3 icons (Roku HD) full-bleed,
   other shapes contained on the tile backdrop at no more than 1.5 device pixels per image pixel,
   sizes snapped to device pixels. An image that fails to load is reported back to the cache
   (`markFailed`) and the tile falls back to the house style.

## Per platform

| Platform | Icon source | Form | Status |
| --- | --- | --- | --- |
| Roku (ECP) | `GET http://<tv>:8060/query/icon/<appId>` (documented ECP endpoint) | LAN URL | Fixture-tested (`roku.test.ts`, `appIcons.test.ts`) |
| LG webOS (SSAP) | `largeIcon` / `icon` / `mediumIcon` from `listLaunchPoints` (fallback `listApps`) | LAN URL (`http://<tv>:3000/resources/...`) | Fixture-tested; cloud URLs and bare paths dropped (`webos.test.ts`). UNVERIFIED: whether every firmware serves them without the session |
| Samsung Tizen | `ms.channel.emit ed.apps.icon {iconPath}` with the `icon` path from `ed.installedApp.get`; reply `imageBase64` | data: URI | Fixture-tested against reconstructed frames only (`samsung.test.ts`); shape from open-source clients, UNVERIFIED on hardware |
| Sony Bravia | `icon` from `appControl getApplicationList` | LAN URL (`http://<tv>/DIAL/icon/...`) | Fixture-tested; off-LAN URLs and relative paths dropped (`appIcons.test.ts`) |
| Fire TV (Fire OS) | `iconArtSmallUri` / `iconUri` / `icon` from `GET /v1/FireTV/apps` | LAN URL or data: URI only | Fixture-tested; the usual cloud icon URLs are dropped, so in practice tiles are typographic. `appIcons` is advertised only when the list carried a TV-supplied icon |
| Android TV / Google TV (Remote v2) | none: the protocol has no app list or icons | — | Typographic tile (`appIcons.test.ts`) |
| Vizio SmartCast | none: no installed-app list on the LAN (static launch table) | — | Typographic tile |
| Philips JointSpace v6 | `/6/applications/<id>/icon` exists but is binary behind Digest auth, which neither `Image` nor the text-only `FetchLike` can load | — | Typographic tile (possible later with a binary-capable authed fetch) |
| Infrared | none | — | No app list |
| Demo TV | original abstract demo art (`src/core/demo.ts`), never a TV icon | — | Demo only |

Nothing above has been confirmed on real hardware; every driver is tested against recorded or
reconstructed fixtures under `src/core/drivers/__fixtures__/`.
