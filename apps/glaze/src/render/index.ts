// Icon rendering public API.
export { IconCanvas, type IconCanvasProps, type IconDrawSpec } from './IconCanvas';
export { IconTile, type IconTileProps } from './IconTile';
export { iconAccessibilityLabel, colourName } from './a11y';
export {
  captureIcon,
  nextFrames,
  pointsForPixels,
  stripDataPrefix,
  CAPTURE_SIZES,
  type CaptureSize,
} from './capture';
export {
  OffscreenIconRenderer,
  useIconBatchRenderer,
  RenderCancelledError,
  isRenderCancelled,
  type BatchSpec,
  type RenderCancelToken,
  type OffscreenIconRendererHandle,
  type OffscreenIconRendererProps,
  type RenderedIcon,
  type RenderProgress,
} from './OffscreenRenderer';
export { FeatherGlyphOverlay, InhouseSvgGlyph, type FeatherGlyphName } from './glyphs';
export { INHOUSE_GLYPH_PATHS, INHOUSE_VIEWBOX, inhouseGlyph, type InhouseGlyph } from './inhouse';
export {
  resolveGlyph,
  allGlyphNames,
  isKnownGlyph,
  FEATHER_GLYPHS,
  INHOUSE_GLYPHS,
  FALLBACK_GLYPH,
  INHOUSE_SET,
  FEATHER_SET,
  type ResolvedGlyph,
} from '../core/glyphnames';
export { SHAPES, shapePath, gradientVector, glyphBox } from '../core/shapes';
