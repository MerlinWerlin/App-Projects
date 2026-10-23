// GlazeLivePhoto: turn a loop (video + trim + crop + speed) into a Live Photo and save it
// to the photo library. See docs/LIVEPHOTO.md for the approach and metadata keys.
//
// NOT YET TESTED ON A DEVICE. Symbols or behaviour we could not check without Xcode are
// marked `// VERIFY`.
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

    // 3. One content identifier ties the photo and the video together.
    let identifier = UUID().uuidString
    let tmp = FileManager.default.temporaryDirectory
    let jpgURL = tmp.appendingPathComponent("glaze-livephoto-\(identifier).jpg")
    let movURL = tmp.appendingPathComponent("glaze-livephoto-\(identifier).mov")
    defer {
      // Photos moves the files on success (shouldMoveFile); clean up anything left.
      try? FileManager.default.removeItem(at: jpgURL)
      try? FileManager.default.removeItem(at: movURL)
    }

    // 4. Build the trimmed, sped-up, cropped composition.
    let built = try await Self.composition(url: url, payload: p)

    // Still frame: middle of the output clip.
    let half = CMTimeMultiplyByFloat64(built.composition.duration, multiplier: 0.5)
    var stillTime = half
    if let ms = p.stillTimeMs, ms >= 0 {
      stillTime = CMTimeMinimum(CMTime(value: CMTimeValue(ms.rounded()), timescale: 1000), half)
    }

    // 5. Still JPEG with the Apple MakerNote content identifier.
    let still = try Self.stillImage(built: built, at: stillTime)
    try Self.writeJPEG(still, to: jpgURL, identifier: identifier)

    // 6. MOV with the QuickTime content identifier + still-image-time timed metadata.
    try await Self.writeMOV(built: built, payload: p, to: movURL, identifier: identifier, stillTime: stillTime)

    // 7. Save as one Live Photo asset.
    try await PHPhotoLibrary.shared().performChanges {
      let request = PHAssetCreationRequest.forAsset()
      let photoOptions = PHAssetResourceCreationOptions()
      photoOptions.shouldMoveFile = true
      request.addResource(with: .photo, fileURL: jpgURL, options: photoOptions)
      let videoOptions = PHAssetResourceCreationOptions()
      videoOptions.shouldMoveFile = true
      request.addResource(with: .pairedVideo, fileURL: movURL, options: videoOptions)
    }
    return "saved"
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

  static func writeJPEG(_ image: CGImage, to url: URL, identifier: String) throws {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
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

  static func stillImageTimeFormat() throws -> CMFormatDescription {
    let spec: [String: Any] = [
      kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String:
        "mdta/com.apple.quicktime.still-image-time",
      kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String:
        kCMMetadataBaseDataType_SInt8 as String,
    ]
    var desc: CMFormatDescription?
    let status = CMMetadataFormatDescriptionCreateWithMetadataSpecifications(
      allocator: kCFAllocatorDefault,
      metadataType: kCMMetadataFormatType_Boxed,
      metadataSpecifications: [spec] as CFArray,
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
    stillTime: CMTime
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

    var compression: [String: Any] = [:]
    if let bitrate = p.bitrate, bitrate > 0 { compression[AVVideoAverageBitRateKey] = bitrate }
    // H.264 for broad compatibility as a paired video.
    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: p.width,
      AVVideoHeightKey: p.height,
      AVVideoCompressionPropertiesKey: compression,
    ])
    videoInput.expectsMediaDataInRealTime = false
    guard writer.canAdd(videoInput) else { throw LivePhotoError.export("video input") }
    writer.add(videoInput)

    // Timed metadata track: com.apple.quicktime.still-image-time marks the key photo frame.
    let metadataInput = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil,
                                           sourceFormatHint: try stillImageTimeFormat())
    let adaptor = AVAssetWriterInputMetadataAdaptor(assetWriterInput: metadataInput)
    guard writer.canAdd(metadataInput) else { throw LivePhotoError.export("metadata input") }
    writer.add(metadataInput)

    guard reader.startReading() else { throw LivePhotoError.export(reader.error?.localizedDescription ?? "reader") }
    guard writer.startWriting() else { throw LivePhotoError.export(writer.error?.localizedDescription ?? "writer") }
    writer.startSession(atSourceTime: .zero)

    let stillItem = AVMutableMetadataItem()
    stillItem.keySpace = .quickTimeMetadata
    stillItem.key = "com.apple.quicktime.still-image-time" as NSString
    // VERIFY: int8 0xFF (-1) is what the widely documented samples write; some write 0.
    stillItem.value = NSNumber(value: Int8(-1))
    stillItem.dataType = kCMMetadataBaseDataType_SInt8 as String
    let frame = CMTime(value: 1, timescale: Int32(max(1, min(60, p.fps ?? 30))))
    let group = AVTimedMetadataGroup(items: [stillItem], timeRange: CMTimeRange(start: stillTime, duration: frame))
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
