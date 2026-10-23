// English catalogue: prepare area. Keys are prefixed 'prepare.'.
// Preset, photo-kind and background ids come from src/core/outlinePresets.ts (looked up by id with tDynamic).
export const prepare = {
  'prepare.noImage': 'No image was chosen. Go back and pick a photo or a template.',
  'prepare.goBack': 'Go back',

  // Mode
  'prepare.mode.label': 'Image style',
  'prepare.mode.original': 'Original',
  'prepare.mode.originalHint': 'Trace the photo as it is',
  'prepare.mode.outline': 'Outline',
  'prepare.mode.outlineHint': 'Turn the photo into clean line art',

  // Preview and progress
  'prepare.preview.outline': 'Outline preview',
  'prepare.preview.image': 'Image preview',
  'prepare.progress.announce': 'Making outline, {percent}',
  'prepare.progress.refining': 'Refining… {percent}',
  'prepare.progress.refiningLabel': 'Refining outline',
  'prepare.progress.updating': 'Updating…',
  'prepare.progress.updatingLabel': 'Updating outline',
  'prepare.progress.making': 'Making outline… {percent}',
  'prepare.progress.makingLabel': 'Making outline',
  'prepare.progress.rotating': 'Rotating…',
  'prepare.progress.rotatingLabel': 'Rotating',

  // Errors
  'prepare.error.rotate': 'Couldn’t rotate this image.',
  'prepare.error.outline': 'Couldn’t make an outline from this image.',
  'prepare.error.withDetail': '{message} ({detail})',

  // Style presets
  'prepare.style': 'Style',
  'prepare.preset.best.name': 'Best match',
  'prepare.preset.best.description': 'Picks settings for this photo (portrait, drawing or object)',
  'prepare.preset.fine.name': 'Fine line art',
  'prepare.preset.fine.description': 'Thin, delicate lines with plenty of detail',
  'prepare.preset.portrait.name': 'Detailed portrait',
  'prepare.preset.portrait.description': 'Keeps eyes, brows, nose, lips and jaw; quiet background',
  'prepare.preset.clean.name': 'Clean outline',
  'prepare.preset.clean.description': 'Main shapes and clear inner lines, no clutter',
  'prepare.preset.bold.name': 'Bold outline',
  'prepare.preset.bold.description': 'Thick outer lines, thinner inner details',
  'prepare.preset.simple.name': 'Simplified',
  'prepare.preset.simple.description': 'Just the big shapes — easiest to trace',
  'prepare.preset.illustration.name': 'Detailed illustration',
  'prepare.preset.illustration.description': 'Lots of texture and folds, background included',
  // T49 line styles
  'prepare.preset.sketch.name': 'Sketch',
  'prepare.preset.sketch.description': 'Soft pencil-like lines; good for faces, pets and soft subjects',
  'prepare.preset.lineart.name': 'Line art',
  'prepare.preset.lineart.description': 'Crisp, exact edges; good for objects, buildings and lettering',
  'prepare.preset.boldlines.name': 'Bold lines',
  'prepare.preset.boldlines.description': 'Only the main edges, drawn thick and easy to see',
  'prepare.preset.custom': 'Custom',
  'prepare.preset.customHint': 'Your own settings',
  'prepare.preset.customDescription': 'Custom settings — tap a style to start again from it.',
  'prepare.found': 'Found: {kind}',
  'prepare.foundFaces': { one: 'Found: {kind}, {count} face', other: 'Found: {kind}, {count} faces' },
  'prepare.descriptionFound': '{description} · {found}',

  // Sliders
  'prepare.detail': 'Detail',
  'prepare.detailHint': 'Low keeps the main shapes; high adds hair, folds and texture',
  'prepare.thickness': 'Line thickness',
  'prepare.thicknessHint': 'Thicker lines are found at a coarser scale so features stay separate',
  'prepare.thickness.value': '{px} px · {name}',
  'prepare.thickness.hairline': 'Hairline',
  'prepare.thickness.fine': 'Fine',
  'prepare.thickness.medium': 'Medium',
  'prepare.thickness.bold': 'Bold',
  'prepare.thickness.extraBold': 'Extra bold',

  // Background
  'prepare.background': 'Background',
  'prepare.background.option': '{name}: {hint}',
  'prepare.background.subject.name': 'Subject only',
  'prepare.background.subject.hint': 'Removes most background lines',
  'prepare.background.soft.name': 'Soft',
  'prepare.background.soft.hint': 'Keeps only strong background lines',
  'prepare.background.all.name': 'Everything',
  'prepare.background.all.hint': 'Traces the whole picture',

  // Photo type
  'prepare.kind': 'Photo type',
  'prepare.kind.auto': 'Auto',
  'prepare.kind.auto.hint': 'Let Linework decide (finds faces and drawings)',
  'prepare.kind.autoDetected': 'Auto · {kind}',
  'prepare.kind.portrait': 'Portrait',
  'prepare.kind.portrait.hint': 'Process as a portrait',
  'prepare.kind.pet': 'Pet',
  'prepare.kind.pet.hint': 'Process as a pet',
  'prepare.kind.object': 'Object',
  'prepare.kind.object.hint': 'Process as an object',
  'prepare.kind.landscape': 'Landscape',
  'prepare.kind.landscape.hint': 'Process as a landscape',
  'prepare.kind.drawing': 'Drawing',
  'prepare.kind.drawing.hint': 'Process as a drawing',

  // White lines
  'prepare.invert': 'White lines',
  'prepare.invertSub': 'For dark paper',
  'prepare.invertLabel': 'White lines, for dark paper',

  // Actions
  'prepare.rotate': 'Rotate 90°',
  'prepare.rotateLabel': 'Rotate 90 degrees clockwise',
  'prepare.start': 'Start tracing',
  'prepare.startHint': 'Opens the camera with this image on top',
  'prepare.startWait': 'Wait until the image is ready',
  'prepare.outlineLocked': "Outline mode is part of Linework Plus",
} as const;
