# Glaze artwork review — 15 November 2026

All 24 required rows and all 11 optional themes are complete. The complete gallery review additionally replaced two similar mineral pieces in Dunesilk and Saltveil. There are 47 new 1024-square WebPs across 37 themes: 35 R2 additions and 12 bundled additions. Every one of the 144 final gallery themes selects five distinct artwork images.

The 141-pack R2 build changes 34 packs once, retains 107 manifests unchanged and preserves all 2,158 previous asset files byte for byte. Selected older duplicate/cropped options retain their id, image and every other field except kind (`photo`), keeping them outside the pure-artwork selection. The live R2 catalogue has not been changed.

The three built-in themes retain their original art and add four compact WebPs each (about 1.77 MB total). Glaze is version 1.0.40. Data loading for previews and automatic composition uses the same generated artwork list; no Widgets tab layout changes are included. PR313 owns version 1.0.39 and its separate flow changes.

Validation: 1,989 app tests; 46 pack tests with no skips; standard core and Node typechecks; UI source typecheck with `--skipLibCheck` (the standalone UI config also includes conflicting dependency declaration stubs); iOS Expo/Hermes JavaScript and assets export; full decoding of 246 content-distinct source/bundled WebPs; complete preservation audit; staged coverage check. Native simulator/device execution remains for the app build review.

## Requested rows

| Row | Theme | New subject(s) |
| --- | --- | --- |
| 1 | agate-apricot | agate-pendant |
| 2 | bellbat-bloom | felt-luna-moth |
| 3 | carbon-velocity | carbon-steering-wheel |
| 4 | cloudwash | cloud-soap-dish |
| 5 | copper-circuit | copper-vacuum-tube |
| 6 | glacier-quiet | glacial-cave-arch |
| 7 | kingfisher-blue | reed-bed-dragonfly |
| 8 | lotus-drift | pond-paper-boat |
| 9 | manta-silk | silken-manta-ray |
| 10 | meadowglow | meadow-harvest-mouse |
| 11 | moonpatch | stitched-satellite |
| 12 | mosswick | mushroom-mailbox |
| 13 | ochre-bend | billabong-lizard |
| 14 | pebblekin-grove | pebble-owl |
| 15 | summit-line | alpine-mountain-hut |
| 16 | wisteria-hush | wisteria-carpenter-bee |
| 17 | bluewing | sapphire-stag-beetle |
| 18 | ginkgo-hour | pressed-ginkgo-bookmark |
| 19 | juniper-mist | juniper-mortar-pestle |
| 20 | peachskin | peach-blossom-teapot, peach-orchard-butterfly |
| 21 | phosphor-amber | amber-cassette-tape |
| 22 | deep-sea | luminous-nautilus, glowing-anglerfish, bioluminescent-coral-fan, abyssal-diving-helmet |
| 23 | starry-night | ringed-planet, copper-telescope, ember-comet, spiral-galaxy |
| 24 | sunset-dunes | desert-camel, desert-rose-mineral, dusk-lantern, date-palm |
| 25 | brass-afterhours | brass-ribbon-microphone |
| 26 | curlfin-cove | quilled-sea-turtle |
| 27 | fern-and-brass | brass-garden-trowel |
| 28 | jellylight | opal-seahorse |
| 29 | labradorite-hush | labradorite-owl |
| 30 | midnight-conservatory | moonlit-garden-shears |
| 31 | peach-puddle | peach-paper-pinwheel |
| 32 | prism-orchard | opal-orchard-rabbit |
| 33 | silver-orchard | silver-orchard-key |
| 34 | stellar-cradle | stellar-ringed-world |
| 35 | sundew-ember | ruby-garden-beetle |
| 36 | dunesilk | sandstone-fennec |
| 37 | saltveil | rose-glass-sailboat |

## Complete gallery review

Reviewed all 720 selected tiles by eye against their theme wallpaper, checking subject variety, style, framing and no text/time overlays in the new artwork. These contact sheets use the exact app-selected files from the staged manifests and bundled data.

![Gallery themes 1–8](review/gallery-01.jpg)

![Gallery themes 9–16](review/gallery-02.jpg)

![Gallery themes 17–24](review/gallery-03.jpg)

![Gallery themes 25–32](review/gallery-04.jpg)

![Gallery themes 33–40](review/gallery-05.jpg)

![Gallery themes 41–48](review/gallery-06.jpg)

![Gallery themes 49–56](review/gallery-07.jpg)

![Gallery themes 57–64](review/gallery-08.jpg)

![Gallery themes 65–72](review/gallery-09.jpg)

![Gallery themes 73–80](review/gallery-10.jpg)

![Gallery themes 81–88](review/gallery-11.jpg)

![Gallery themes 89–96](review/gallery-12.jpg)

![Gallery themes 97–104](review/gallery-13.jpg)

![Gallery themes 105–112](review/gallery-14.jpg)

![Gallery themes 113–120](review/gallery-15.jpg)

![Gallery themes 121–128](review/gallery-16.jpg)

![Gallery themes 129–136](review/gallery-17.jpg)

![Gallery themes 137–144](review/gallery-18.jpg)

## Publication

One PR contains all source work. R2 publication requires Jared’s separate OK; `glaze-publish-r2.yml` was not dispatched and no upload command was run. The review can be reproduced with the pinned baseline and the complete add-art build.
