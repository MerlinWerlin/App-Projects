# Native config pieces

One JSON file per native feature, merged by app.config.ts only when GLAZE_NATIVE=1 (dev/production builds). Expo Go never reads these.
Shared ids: App Group `group.com.jared797.glaze` (theme JSON for widgets), bundle id + Android package com.jared797.glaze.
