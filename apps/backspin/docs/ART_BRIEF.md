# Backspin artwork

Jared supplied and requested this purple speech-bubble mascot on 26 October 2026. It replaces the old vinyl-record icon brief; the in-app disc remains an audio/playback control.

- `assets/icon.png`: opaque square, cream full-bleed background, lavender mascot, no text or baked corner mask. Also used on the public support/marketing site at `docs/backspin/img/icon.png`.
- `assets/adaptive-icon.png`: transparent padded foreground; cream adaptive background in app.json.
- `assets/splash-icon.png`: same transparent mascot. Launch screen is cream in light mode and Booth dark in dark mode.
- Generated originals remain in the Codex image library; runtime assets are committed here. No file outside the repository is needed by the build.

Mode: built-in ImageGen, edit of Jared's supplied image. The opaque master is 1254 pixels square, already above the 1024-pixel store icon size; no additional resolution increase is claimed. Expo produces platform-specific sizes during the native build.

Final opaque prompt: Preserve the exact lavender floating speech-bubble character, lower-left point, asymmetrical eyes, dark-purple smiling mouth and pink tongue, four purple motion strokes and grounding shadow. Improve edge clarity and smooth shading without changing the expression, proportions, palette or placement. Extend the warm cream background to all four square corners; remove the baked white rounded outside corners. Entire canvas opaque, no lettering, border, new objects or redesign.

Final transparent prompt: Exact character extraction and adaptive-icon packaging. Square transparent PNG, complete mascot including all four motion marks and shadow small and centered, roughly the central 58% of the canvas with generous empty transparent borders. Preserve original design and relative placement. Remove only the cream background, keep clean alpha edges, no stray dots, colored noise, lettering or new objects.
