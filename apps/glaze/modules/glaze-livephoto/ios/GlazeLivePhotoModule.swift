// GlazeLivePhoto: turn a loop (video + trim + crop + speed) into a Live Photo and save it
// to the photo library. See docs/LIVEPHOTO.md for the approach and metadata keys.
//
// NOT YET TESTED ON A DEVICE. Symbols or behaviour we could not check without Xcode are
// marked `// VERIFY`.
//
// Pairing checklist (T127, guarded by src/core/t127LiveLock.test.ts and t153LiveWallpaper.test.ts):
//  - still (HEIC, JPEG fallback): Apple MakerNote (kCGImagePropertyMakerAppleDictionary) key "17" = identifier
//  - video .mov (HEVC, no audio, 1080 x 1920): top-level QuickTime metadata
//    mdta/com.apple.quicktime.content.identifier = the same identifier
//  - video: a timed metadata track mdta/com.apple.quicktime.still-image-time (int8 value -1;
//    0 in the T127 fallback) over one frame at the still's time
//  - saved with one PHAssetCreationRequest: .photo + .pairedVideo resources
//  - output at most 3 s (JS clamps to LIVE_PHOTO_MAX_MS; maxDuration below is the safety net)
//
// Wallpaper recipe (T153, run 120; docs/LIVEPHOTO.md "Wallpaper recipe (run 120)"). Sources:
//   [LP]  LivePaper (MIT), docs/FINDINGS.md: https://github.com/Yuyang16Z/LivePaper/blob/main/docs/FINDINGS.md
//   [OWE] open-wallpaper-engine-mac PR #288: https://github.com/deepratna-awale/open-wallpaper-engine-mac/pull/288
//   [MR]  MacRumors thread: https://forums.macrumors.com/threads/ios-17-live-photos-motion-not-available-lock-screen.2403161/page-3
// No code was copied from them; only the facts they report.
//  - video 1080 x 1920 (long side <= 1920 px; 1440x2560 failed) [LP][OWE][MR]
//  - HEVC paired video (H.264 always failed) [LP][OWE][MR]; Main profile, no frame reordering,
//    a key frame every second [OWE]
//  - 30 fps [OWE] (frame rate not checked [LP]); 1 to 3 s [OWE] (<= 5 s passed [LP])
//  - key photo = a frame of the video, not at 0 s, >= 0.5 s [LP][OWE][MR]; HEIC still [LP][OWE]
//  - still-image-time value -1 (0xFF) [LP][OWE], sample in the 600 timescale [LP][OWE], in the
//    same sample as live-photo-still-image-transform = identity 3x3 [LP][OWE]
//  - metadata track references the video track (cdsc) [OWE]
//  - NOT DONE: the per-frame mdta/com.apple.quicktime.live-photo-info track. [LP] found it must
//    carry the iPhone camera's own values (zeroed or made-up payloads failed), and we have no
//    such record to ship. This is the most likely reason a wallpaper may still not move.
//  - Not added: movie-level vitality-score (camera files carry it, but it is not required and
//    1.0 changed nothing [LP]).
// If the wallpaper recipe fails to write on some device, the export retries without the
// still-image-transform item and, last, with the T127 recipe (H.264, JPEG, value 0) so saving a
// Live Photo keeps working.
//
// JS side: src/native/livephoto.ts (adapter) -> NativeModule "GlazeLivePhoto".save(json).
// Payload is built and validated by src/core/livephoto.ts:
//   { sourceUri, trim: {startMs, endMs}, crop: {x, y, width, height}, source: {width, height},
//     speed, width, height, fps, bitrate, durationMs, stillTimeMs }
// Returns "saved" or "denied"; throws (rejects) on any other failure.

import AVFoundation
import CoreMedia
import ExpoModulesCore
import ImageIO
import Photos
import UniformTypeIdentifiers
import VideoToolbox

public class GlazeLivePhotoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeLivePhoto")

    // VERIFY: async closure form of AsyncFunction (supported by ExpoModulesCore in SDK 54).
    AsyncFunction("save") { (json: String) async throws -> String in
      return try await LivePhotoExporter().save(json: json)
    }
  }
}

// MARK: - Payload

struct LivePhotoPayload: Decodable {
  struct Trim: Decodable { let startMs: Double; let endMs: Double }
  struct Rect: Decodable { let x: Double; let y: Double; let width: Double; let height: Double }
  struct Size: Decodable { let width: Double; let height: Double }

  let sourceUri: String
  let trim: Trim
  let crop: Rect
  let source: Size
  let speed: Double
  let width: Int
  let height: Int
  let fps: Int?
  let bitrate: Int?
  let durationMs: Double?
  let stillTimeMs: Double?

  /// Same payload with the output size and frame rate replaced (T153 wallpaper shape).
  func withSize(width: Int, height: Int, fps: Int) -> LivePhotoPayload {
    LivePhotoPayload(sourceUri: sourceUri, trim: trim, crop: crop, source: source, speed: speed,
                     width: width, height: height, fps: fps, bitrate: bitrate,
                     durationMs: durationMs, stillTimeMs: stillTimeMs)
  }
}

enum LivePhotoError: LocalizedError {
  case badPayload(String)
  case noVideoTrack
  case export(String)
  case still
  case jpeg

  var errorDescription: String? {
    switch self {
    case .badPayload(let why): return "Live Photo payload is invalid: \(why)"
    case .noVideoTrack: return "The video has no picture track."
    case .export(let why): return "Could not export the Live Photo video: \(why)"
    case .still: return "Could not grab the still frame."
    case .jpeg: return "Could not write the still photo."
    }
  }
}

// MARK: - Exporter

/// Live Photos are short; anything longer than this (output time) is cut. The JS side
/// already clamps to 3 s; this is a safety net.
private let maxDuration = CMTime(value: 3, timescale: 1)

/// T153: wallpaper-shaped video size. Long side <= 1920 px; 1080x1920 passed [LP][OWE].
private let wallpaperWidth = 1080
private let wallpaperHeight = 1920
/// T153: 30 fps like camera Live Photos [OWE]; 600 is QuickTime's usual movie timescale and the
/// still-image-time sample must use it, or it lands at 0 s [LP].
private let wallpaperFps: Int32 = 30
private let metadataTimescale: Int32 = 600
/// T153: the key photo never sits at 0 s; >= 0.5 s [OWE][MR].
private let stillEarliest = CMTime(value: 300, timescale: 600)

/// How the paired files are written. `wallpaper` is the T153 recipe; the others are fallbacks
/// used only if writing fails, so Save as Live Photo still works.
struct Recipe {
  let name: String
  let hevc: Bool
  let heic: Bool
  /// still-image-time int8 value: -1 for the wallpaper recipe [LP][OWE], 0 for T127.
  let stillValue: Int8
  let stillTransform: Bool
  let timescale600: Bool
  let referencesVideo: Bool

  static let wallpaper = Recipe(name: "wallpaper", hevc: true, heic: true, stillValue: -1,
                                stillTransform: true, timescale600: true, referencesVideo: true)
  /// Same shape, without the still-image-transform item (in case its data type is refused).
  static let wallpaperNoTransform = Recipe(name: "wallpaper-no-transform", hevc: true, heic: true, stillValue: -1,
                                           stillTransform: false, timescale600: true, referencesVideo: true)
  /// T127 recipe: known to save a Live Photo that plays in Photos.
  static let legacy = Recipe(name: "t127", hevc: false, heic: false, stillValue: 0,
                             stillTransform: false, timescale600: false, referencesVideo: false)
}

/// Only touched on the writer's serial queue.
private final class PumpState: @unchecked Sendable { var done = false }

final class LivePhotoExporter {
  func save(json: String) async throws -> String {
    // 1. Add-only permission: we never read the library.
    let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
    guard status == .authorized || status == .limited else { return "denied" }

    // 2. Parse.
    guard let data = json.data(using: .utf8) else { throw LivePhotoError.badPayload("not UTF-8") }
    let p: LivePhotoPayload
    do {
      p = try JSONDecoder().decode(LivePhotoPayload.self, from: data)
    } catch {
      throw LivePhotoError.badPayload(error.localizedDescription)
    }
    guard p.width >= 2, p.height >= 2, p.speed > 0, p.trim.endMs > p.trim.startMs else {
      throw LivePhotoError.badPayload("size, speed or trim out of range")
    }
    guard let url = Self.fileURL(p.sourceUri) else { throw LivePhotoError.badPayload("sourceUri must be a file URL") }

    // T153: always wallpaper-shaped, whatever the payload says: 1080 x 1920, 30 fps [LP][OWE].
    // The JS side (src/core/livephoto.ts) already sends this size and a 9:16 crop.
    let shaped = p.withSize(width: wallpaperWidth, height: wallpaperHeight, fps: Int(wallpaperFps))

    // Wallpaper recipe first; if writing fails, the fallbacks keep Save as Live Photo working.
    var lastError: Error = LivePhotoError.export("no recipe ran")
    for recipe in [Recipe.wallpaper, Recipe.wallpaperNoTransform, Recipe.legacy] {
      do {
        try await Self.export(source: url, payload: shaped, recipe: recipe)
        return "saved"
      } catch {
        lastError = error
        NSLog("GlazeLivePhoto: recipe %@ failed: %@", recipe.name, error.localizedDescription)
      }
    }
    throw lastError
  }

  static func export(source url: URL, payload p: LivePhotoPayload, recipe: Recipe) async throws {
    // 3. One content identifier ties the photo and the video together.
    let identifier = UUID().uuidString
    let tmp = FileManager.default.temporaryDirectory
    let movURL = tmp.appendingPathComponent("glaze-livephoto-\(identifier).mov")
    let heicURL = tmp.appendingPathComponent("glaze-livephoto-\(identifier).heic")
    let jpgURL = tmp.appendingPathComponent("glaze-livephoto-\(identifier).jpg")
    defer {
      // Photos moves the files on success (shouldMoveFile); clean up anything left.
      try? FileManager.default.removeItem(at: heicURL)
      try? FileManager.default.removeItem(at: jpgURL)
      try? FileManager.default.removeItem(at: movURL)
    }

    // 4. Build the trimmed, sped-up, cropped composition.
    let built = try await Self.composition(url: url, payload: p)

    // Still frame (the Live Photo's key photo): middle of the output clip, like a camera Live
    // Photo, never before 0.5 s [OWE][MR], snapped to a frame so the key photo IS a video frame
    // [LP]. The still is grabbed at exactly this time and the video's still-image-time metadata
    // points at it, so the key photo and the paused frame match.
    let stillTime = Self.keyPhotoTime(payload: p, duration: built.composition.duration)

    // 5. Still (HEIC for the wallpaper recipe [LP][OWE], JPEG fallback) with the MakerApple id.
    let still = try Self.stillImage(built: built, at: stillTime)
    let photoURL = try Self.writeStill(still, heicURL: recipe.heic ? heicURL : nil, jpgURL: jpgURL, identifier: identifier)

    // 6. MOV with the QuickTime content identifier + still-image-time timed metadata.
    try await Self.writeMOV(built: built, payload: p, to: movURL, identifier: identifier,
                            stillTime: stillTime, recipe: recipe)

    // 7. Save as one Live Photo asset.
    try await PHPhotoLibrary.shared().performChanges {
      let request = PHAssetCreationRequest.forAsset()
      let photoOptions = PHAssetResourceCreationOptions()
      photoOptions.shouldMoveFile = true
      request.addResource(with: .photo, fileURL: photoURL, options: photoOptions)
      let videoOptions = PHAssetResourceCreationOptions()
      videoOptions.shouldMoveFile = true
      request.addResource(with: .pairedVideo, fileURL: movURL, options: videoOptions)
    }
  }

  /// Key photo time in the 600 timescale, on a frame boundary, >= 0.5 s, before the last frame.
  static func keyPhotoTime(payload p: LivePhotoPayload, duration: CMTime) -> CMTime {
    let fps = Double(max(1, min(60, p.fps ?? Int(wallpaperFps))))
    let total = max(0, CMTimeGetSeconds(duration))
    var seconds = total / 2
    if let ms = p.stillTimeMs, ms >= 0 { seconds = min(ms / 1000, seconds) }
    seconds = max(seconds, CMTimeGetSeconds(stillEarliest))
    let lastFrame = max(0, floor(total * fps) - 1)
    let frame = min(floor(seconds * fps), lastFrame)
    return CMTime(value: CMTimeValue((frame * Double(metadataTimescale) / fps).rounded()), timescale: metadataTimescale)
  }

  // MARK: Source

  static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("/") { return URL(fileURLWithPath: uri) }
    guard let url = URL(string: uri), url.isFileURL else { return nil } // ph:// etc. not supported
    return url
  }

  struct Built {
    let composition: AVMutableComposition
    let videoComposition: AVMutableVideoComposition
  }

  static func loadTrack(_ asset: AVURLAsset) async throws -> (AVAssetTrack, CMTime, CGSize, CGAffineTransform) {
    if #available(iOS 16.0, *) {
      guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw LivePhotoError.noVideoTrack }
      let duration = try await asset.load(.duration)
      let (size, transform) = try await track.load(.naturalSize, .preferredTransform)
      return (track, duration, size, transform)
    } else {
      guard let track = asset.tracks(withMediaType: .video).first else { throw LivePhotoError.noVideoTrack }
      return (track, asset.duration, track.naturalSize, track.preferredTransform)
    }
  }

  static func composition(url: URL, payload p: LivePhotoPayload) async throws -> Built {
    let asset = AVURLAsset(url: url)
    let (srcTrack, assetDuration, naturalSize, transform) = try await loadTrack(asset)

    // Source range: trim start, at most 3 s of OUTPUT (so 3 s * speed of source).
    let start = CMTime(value: CMTimeValue(p.trim.startMs.rounded()), timescale: 1000)
    var end = CMTimeMinimum(CMTime(value: CMTimeValue(p.trim.endMs.rounded()), timescale: 1000), assetDuration)
    end = CMTimeMinimum(end, CMTimeAdd(start, CMTimeMultiplyByFloat64(maxDuration, multiplier: p.speed)))
    guard CMTimeCompare(end, start) > 0 else { throw LivePhotoError.badPayload("trim is outside the video") }
    let sourceRange = CMTimeRange(start: start, end: end)

    let comp = AVMutableComposition()
    guard let compTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      throw LivePhotoError.export("could not add a composition track")
    }
    try compTrack.insertTimeRange(sourceRange, of: srcTrack, at: .zero)
    compTrack.preferredTransform = transform
    if p.speed != 1 {
      let scaled = CMTimeMultiplyByFloat64(sourceRange.duration, multiplier: 1.0 / p.speed)
      comp.scaleTimeRange(CMTimeRange(start: .zero, duration: sourceRange.duration), toDuration: scaled)
    }

    // Orientation: draw the track upright with its top-left at (0, 0).
    let orientedRect = CGRect(origin: .zero, size: naturalSize).applying(transform)
    let oriented = CGSize(width: abs(orientedRect.width), height: abs(orientedRect.height))
    let upright = transform.concatenating(CGAffineTransform(translationX: -orientedRect.minX, y: -orientedRect.minY))

    // Crop: JS measured it against `source` (display orientation). Rescale to the decoded size;
    // if the orientation disagrees, fall back to a centred aspect-fill crop.
    let outW = CGFloat(p.width), outH = CGFloat(p.height)
    var crop: CGRect
    let sourcePortrait = p.source.height >= p.source.width
    let decodedPortrait = oriented.height >= oriented.width
    if p.source.width > 0, p.source.height > 0, sourcePortrait == decodedPortrait {
      let kx = oriented.width / CGFloat(p.source.width)
      let ky = oriented.height / CGFloat(p.source.height)
      crop = CGRect(x: CGFloat(p.crop.x) * kx, y: CGFloat(p.crop.y) * ky,
                    width: CGFloat(p.crop.width) * kx, height: CGFloat(p.crop.height) * ky)
    } else {
      let aspect = outW / outH
      if oriented.width / oriented.height > aspect {
        let w = oriented.height * aspect
        crop = CGRect(x: (oriented.width - w) / 2, y: 0, width: w, height: oriented.height)
      } else {
        let h = oriented.width / aspect
        crop = CGRect(x: 0, y: (oriented.height - h) / 2, width: oriented.width, height: h)
      }
    }
    crop = crop.intersection(CGRect(origin: .zero, size: oriented))
    guard crop.width > 0, crop.height > 0 else { throw LivePhotoError.badPayload("crop is empty") }

    let place = upright
      .concatenating(CGAffineTransform(translationX: -crop.minX, y: -crop.minY))
      .concatenating(CGAffineTransform(scaleX: outW / crop.width, y: outH / crop.height))

    let fps = Int32(max(1, min(60, p.fps ?? 30)))
    let vc = AVMutableVideoComposition()
    vc.renderSize = CGSize(width: outW, height: outH)
    vc.frameDuration = CMTime(value: 1, timescale: fps)
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: comp.duration)
    let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: compTrack)
    layer.setTransform(place, at: .zero)
    instruction.layerInstructions = [layer]
    vc.instructions = [instruction]

    return Built(composition: comp, videoComposition: vc)
  }

  // MARK: Still

  static func stillImage(built: Built, at time: CMTime) throws -> CGImage {
    let generator = AVAssetImageGenerator(asset: built.composition)
    generator.videoComposition = built.videoComposition
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    // copyCGImage is deprecated on iOS 16+ but is the iOS 15-compatible call.
    do {
      return try generator.copyCGImage(at: time, actualTime: nil)
    } catch {
      throw LivePhotoError.still
    }
  }

  /// Writes the still and returns the URL actually written. HEIC first when asked [LP][OWE];
  /// falls back to JPEG (same MakerApple id) if this device cannot encode HEIC.
  static func writeStill(_ image: CGImage, heicURL: URL?, jpgURL: URL, identifier: String) throws -> URL {
    if let heicURL {
      do {
        try writeImage(image, to: heicURL, type: UTType.heic, identifier: identifier)
        return heicURL
      } catch {
        try? FileManager.default.removeItem(at: heicURL)
      }
    }
    try writeImage(image, to: jpgURL, type: UTType.jpeg, identifier: identifier)
    return jpgURL
  }

  static func writeImage(_ image: CGImage, to url: URL, type: UTType, identifier: String) throws {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
      throw LivePhotoError.jpeg
    }
    // The Apple MakerNote key "17" carries the content identifier that pairs the photo with
    // the video's com.apple.quicktime.content.identifier.
    // VERIFY: kCGImagePropertyMakerAppleDictionary is honoured for writing by ImageIO.
    let makerApple: [String: Any] = ["17": identifier]
    let props: [CFString: Any] = [
      kCGImagePropertyMakerAppleDictionary: makerApple,
      kCGImageDestinationLossyCompressionQuality: 0.92,
    ]
    CGImageDestinationAddImage(dest, image, props as CFDictionary)
    guard CGImageDestinationFinalize(dest) else { throw LivePhotoError.jpeg }
  }

  // MARK: Video

  static let stillTransformKey = "com.apple.quicktime.live-photo-still-image-transform"

  static func stillImageTimeFormat(transform: Bool) throws -> CMFormatDescription {
    var specs: [[String: Any]] = [[
      kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String:
        "mdta/com.apple.quicktime.still-image-time",
      kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String:
        kCMMetadataBaseDataType_SInt8 as String,
    ]]
    if transform {
      // [LP][OWE]: the key-photo sample also carries live-photo-still-image-transform, a 3x3
      // Float64 identity matrix (9 x Float64 big-endian = 72 bytes [LP]). VERIFY: AffineTransformF64
      // is the data type iOS writes for it.
      specs.append([
        kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String: "mdta/\(stillTransformKey)",
        kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String:
          kCMMetadataBaseDataType_AffineTransformF64 as String,
      ])
    }
    var desc: CMFormatDescription?
    let status = CMMetadataFormatDescriptionCreateWithMetadataSpecifications(
      allocator: kCFAllocatorDefault,
      metadataType: kCMMetadataFormatType_Boxed,
      metadataSpecifications: specs as CFArray,
      formatDescriptionOut: &desc
    )
    guard status == noErr, let d = desc else { throw LivePhotoError.export("metadata format \(status)") }
    return d
  }

  static func writeMOV(
    built: Built,
    payload p: LivePhotoPayload,
    to url: URL,
    identifier: String,
    stillTime: CMTime,
    recipe: Recipe
  ) async throws {
    let comp = built.composition
    let reader = try AVAssetReader(asset: comp)
    let output = AVAssetReaderVideoCompositionOutput(
      videoTracks: comp.tracks(withMediaType: .video),
      videoSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    )
    output.videoComposition = built.videoComposition
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw LivePhotoError.export("reader output") }
    reader.add(output)

    let writer = try AVAssetWriter(outputURL: url, fileType: .mov)

    // Top-level: com.apple.quicktime.content.identifier = the same UUID as the JPEG.
    let idItem = AVMutableMetadataItem()
    idItem.keySpace = .quickTimeMetadata // "mdta"
    idItem.key = "com.apple.quicktime.content.identifier" as NSString
    idItem.value = identifier as NSString
    idItem.dataType = kCMMetadataBaseDataType_UTF8 as String
    writer.metadata = [idItem]

    let fpsValue = Int32(max(1, min(60, p.fps ?? Int(wallpaperFps))))
    var compression: [String: Any] = [:]
    if let bitrate = p.bitrate, bitrate > 0 { compression[AVVideoAverageBitRateKey] = bitrate }
    let codec: AVVideoCodecType
    if recipe.hevc {
      // T153: HEVC paired video; H.264 never passed as a wallpaper [LP][OWE][MR]. Main profile,
      // no frame reordering, a key frame every second [OWE].
      codec = AVVideoCodecType.hevc
      compression[AVVideoProfileLevelKey] = kVTProfileLevel_HEVC_Main_AutoLevel as String
      compression[AVVideoAllowFrameReorderingKey] = false
      compression[AVVideoMaxKeyFrameIntervalKey] = Int(fpsValue)
      compression[AVVideoExpectedSourceFrameRateKey] = Int(fpsValue)
    } else {
      // T127 fallback: H.264, plays in Photos.
      codec = AVVideoCodecType.h264
    }
    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: codec,
      AVVideoWidthKey: p.width,
      AVVideoHeightKey: p.height,
      AVVideoCompressionPropertiesKey: compression,
    ])
    videoInput.expectsMediaDataInRealTime = false
    if recipe.timescale600 { videoInput.mediaTimeScale = metadataTimescale }
    guard writer.canAdd(videoInput) else { throw LivePhotoError.export("video input") }
    writer.add(videoInput)

    // Timed metadata track: com.apple.quicktime.still-image-time marks the key photo frame.
    let metadataInput = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil,
                                           sourceFormatHint: try stillImageTimeFormat(transform: recipe.stillTransform))
    // [LP]: the still-image-time sample must use the 600 timescale, or the writer adds no empty
    // edit and the sample moves to 0 s. VERIFY: mediaTimeScale is honoured on a metadata input.
    if recipe.timescale600 { metadataInput.mediaTimeScale = metadataTimescale }
    let adaptor = AVAssetWriterInputMetadataAdaptor(assetWriterInput: metadataInput)
    guard writer.canAdd(metadataInput) else { throw LivePhotoError.export("metadata input") }
    writer.add(metadataInput)
    // [OWE]: the metadata track describes the video track (a 'cdsc' track reference).
    let cdsc = AVAssetTrack.AssociationType.metadataReferent.rawValue
    if recipe.referencesVideo, metadataInput.canAddTrackAssociation(withTrackOf: videoInput, type: cdsc) {
      metadataInput.addTrackAssociation(withTrackOf: videoInput, type: cdsc)
    }

    guard reader.startReading() else { throw LivePhotoError.export(reader.error?.localizedDescription ?? "reader") }
    guard writer.startWriting() else { throw LivePhotoError.export(writer.error?.localizedDescription ?? "writer") }
    writer.startSession(atSourceTime: .zero)

    let stillItem = AVMutableMetadataItem()
    stillItem.keySpace = .quickTimeMetadata
    stillItem.key = "com.apple.quicktime.still-image-time" as NSString
    // T153: value -1 (int8 0xFF) as iPhone camera files write it [LP][OWE]; the T127 fallback
    // keeps 0. The time range starts at the still frame (the same `stillTime` the still was
    // grabbed at, 600 timescale) and lasts one frame.
    stillItem.value = NSNumber(value: recipe.stillValue)
    stillItem.dataType = kCMMetadataBaseDataType_SInt8 as String
    var items: [AVMetadataItem] = [stillItem]
    if recipe.stillTransform {
      let transformItem = AVMutableMetadataItem()
      transformItem.keySpace = .quickTimeMetadata
      transformItem.key = stillTransformKey as NSString
      // Identity 3x3 [LP][OWE]. VERIFY: AVFoundation takes an NSValue(CGAffineTransform) for
      // the AffineTransformF64 data type.
      transformItem.value = NSValue(cgAffineTransform: .identity)
      transformItem.dataType = kCMMetadataBaseDataType_AffineTransformF64 as String
      items.append(transformItem)
    }
    let frame = CMTime(value: CMTimeValue(metadataTimescale / fpsValue), timescale: metadataTimescale)
    let start = CMTimeConvertScale(stillTime, timescale: metadataTimescale, method: .roundHalfAwayFromZero)
    let group = AVTimedMetadataGroup(items: items, timeRange: CMTimeRange(start: start, duration: frame))
    if !adaptor.append(group) {
      reader.cancelReading()
      writer.cancelWriting()
      throw LivePhotoError.export(writer.error?.localizedDescription ?? "still-image-time")
    }
    metadataInput.markAsFinished()

    // Pump frames.
    let queue = DispatchQueue(label: "com.jared797.glaze.livephoto.write")
    let ok: Bool = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
      let state = PumpState() // reference box: the block may be @Sendable, so no captured var
      videoInput.requestMediaDataWhenReady(on: queue) {
        guard !state.done else { return }
        while videoInput.isReadyForMoreMediaData {
          if let buffer = output.copyNextSampleBuffer() {
            if !videoInput.append(buffer) {
              state.done = true
              reader.cancelReading()
              videoInput.markAsFinished()
              cont.resume(returning: false)
              return
            }
          } else {
            state.done = true
            videoInput.markAsFinished()
            cont.resume(returning: reader.status == .completed)
            return
          }
        }
      }
    }
    guard ok else {
      writer.cancelWriting()
      throw LivePhotoError.export(writer.error?.localizedDescription ?? reader.error?.localizedDescription ?? "frames")
    }
    await writer.finishWriting()
    guard writer.status == .completed else {
      throw LivePhotoError.export(writer.error?.localizedDescription ?? "finish")
    }
  }
}
