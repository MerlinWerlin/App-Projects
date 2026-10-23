# Owner test, 22 Oct 2026 (fb-1022)

The owner retested the 20 Oct build in Expo Go: "Couch looks good", the app tiles look prettier, but they must be the actual applications (Netflix, YouTube and so on) with their real icons, not invented "Cinema" / "Music" tiles.

C1 (done, T84): tiles show the real official icons fetched at runtime. Source 1 is the icon the connected TV supplies; source 2 is the service's App Store artwork from Apple's public iTunes Search API (src/core/storeIcons.ts: 23 services, AU first then US, matched by app name/alias, seller-checked, cached for the session, failures retried after 2 minutes); the house tile shows only offline or for unknown apps. Demo mode (MockTv) lists 16 real services so the owner sees real apps without a TV. No logo files are bundled and none are redrawn. A line under the Apps grid says app names and icons belong to their owners and Couch is not affiliated (11 languages).

C2: store screenshots keep the invented apps and original art (SCREENSHOT_DEMO_APPS) until docs/MARKET.md records "owner approved logos in screenshots". Competitors do show real logos in their store shots; this is the owner's call.
