# Backspin artwork

Jared supplied and requested this purple speech-bubble mascot on 26 October 2026. It replaces the old vinyl-record icon brief; the in-app disc remains an audio/playback control.

- `assets/icon.png`: opaque square, cream full-bleed background, lavender mascot, no text or baked corner mask. Also used on the public support/marketing site at `docs/backspin/img/icon.png`.
- `assets/adaptive-icon.png`: transparent padded foreground; cream adaptive background in app.json.
- `assets/splash-icon.png`: same transparent mascot. Launch screen is cream in light mode and Booth dark in dark mode.
- Generated originals remain in the Codex image library; runtime assets are committed here. No file outside the repository is needed by the build.

Mode: built-in ImageGen, edit of Jared's supplied image. The opaque master is 1254 pixels square, already above the 1024-pixel store icon size; no additional resolution increase is claimed. Expo produces platform-specific sizes during the native build.

Final opaque prompt (built-in ImageGen):

> Use case: precise-object-edit. Asset type: final Backspin mobile app icon, high-resolution square master, ideally 2048x2048. Input image is the EDIT TARGET, not a loose inspiration. Upscale and clean the supplied artwork with extremely high fidelity: preserve exactly this lavender purple floating speech-bubble character, its silhouette and lower-left point, asymmetrically looking eyes with white sclera and dark purple pupils in their original positions, open smiling dark-purple mouth and pink tongue, four purple sound-wave strokes in their original positions, soft purple grounding shadow, the warm cream background and original composition. Improve edge clarity and smooth shading without changing the design, expression, proportions, palette, lighting or placement. The one required packaging correction: extend the existing warm cream background completely to all four square corners; remove the baked-in rounded-square white outside corners, since the operating system applies the icon mask. Entire canvas opaque. No lettering, no new objects, no border, no extra highlights, no redesign, no aggressive sharpening. Render as one clean high-resolution icon.

Final transparent prompt (built-in ImageGen, transparent_background=true):

> Edit target: supplied Backspin mascot app icon. Exact character extraction and adaptive-icon packaging. Return a square 1024x1024 transparent PNG. It is ESSENTIAL that the complete mascot including all four motion marks AND shadow is SMALL and centered, entirely within a 580x580 box from x=222 to802 and y=222 to802. Leave a wide totally empty transparent border, at least222 pixels wide on ALL four sides. The subject must occupy just over HALF of the canvas, NOT fill the image. Remove the cream background completely. Keep the exact same original lavender character, eye directions, speech-bubble point, happy mouth and pink tongue, proportions, palette, shading, purple four motion marks and soft shadow. Clean alpha edges, absolutely no stray dots or colored noise in the transparent region. No lettering, no new objects, no redesign.

Actual delivered files are 1254x1254, verified from their PNG headers. The transparent foreground's strong-alpha bounds are (277, 348)-(993, 999). The requested dimensions above describe the prompt, not a claim about the actual generated resolution.
