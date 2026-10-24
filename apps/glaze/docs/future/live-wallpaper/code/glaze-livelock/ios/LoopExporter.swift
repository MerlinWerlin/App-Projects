import AVFoundation
import CoreVideo
import ImageIO
import UIKit

/// One loop ready for the Lock Screen: a 3:4 portrait, silent .mov in Caches plus a still preview
/// that is the first frame of that same 3:4 render (T135: Apple ignores animated artwork whose
/// preview or video doesn't match the key's aspect ratio, and wants the preview to match the
/// video's first frame).
struct ExportedLoop: @unchecked Sendable {
  let projectID: String
  let name: String
  let videoURL: URL
  let preview: UIImage
  let durationSeconds: Double
}

/// Turns a LivelockProject into a portrait video at the export size (1080x1440, 3:4, T135):
/// crop (display-oriented pixel rect) + trim + speed, video track only (no audio), H.264 or HEVC.
/// Results are cached in Caches/GlazeLivelock keyed by every input, so restarting the same
/// playlist does not re-encode.
final class LoopExporter: @unchecked Sendable {
  static let folderName = "GlazeLivelock"

  func export(_ project: LivelockProject, settings: LivelockExportSettings) async throws -> ExportedLoop {
    let fm = FileManager.default
    let dir = try Self.cacheDirectory()
    let out = dir.appendingPathComponent("loop-\(Self.cacheKey(project, settings)).mov")
    if !fm.fileExists(atPath: out.path) {
      let source = try Self.sourceURL(project.sourceUri)
      guard fm.isReadableFile(atPath: source.path) else { throw LivelockError.badSource(project.id) }
      let tmp = dir.appendingPathComponent("tmp-\(UUID().uuidString).mov")
      defer { try? fm.removeItem(at: tmp) }
      if project.kind == "gif" {
        try await exportGIF(project, source: source, settings: settings, to: tmp)
      } else {
        try await exportVideo(project, source: source, settings: settings, to: tmp)
      }
      if fm.fileExists(atPath: out.path) { try? fm.removeItem(at: out) }
      try fm.moveItem(at: tmp, to: out)
    }
    let asset = AVURLAsset(url: out)
    let duration = try await asset.load(.duration).seconds
    // The preview is the exported file's own first frame, so it has the export's 3:4 size and
    // matches what the video starts with.
    let preview = try await Self.previewImage(asset)
    return ExportedLoop(
      projectID: project.id,
      name: project.name,
      videoURL: out,
      preview: preview,
      durationSeconds: duration.isFinite ? duration : 0
    )
  }

  /// Delete cached loops that are not in `keep` (keeps Caches from growing with old edits).
  func prune(keeping keep: [URL]) {
    let fm = FileManager.default
    guard let dir = try? Self.cacheDirectory(),
          let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return }
    let keepNames = Set(keep.map { $0.lastPathComponent })
    for file in files where file.lastPathComponent.hasPrefix("loop-") && !keepNames.contains(file.lastPathComponent) {
      try? fm.removeItem(at: file)
    }
  }

  // MARK: - Video (AVAssetExportSession + AVMutableVideoComposition)

  private func exportVideo(
    _ p: LivelockProject,
    source: URL,
    settings s: LivelockExportSettings,
    to out: URL
  ) async throws {
    let asset = AVURLAsset(url: source)
    guard let track = try await asset.loadTracks(withMediaType: .video).first else {
      throw LivelockError.noVideoTrack(p.id)
    }
    let (natural, transform, trackRange) = try await track.load(.naturalSize, .preferredTransform, .timeRange)
    let box = CGRect(origin: .zero, size: natural).applying(transform)
    let display = CGSize(width: abs(box.width), height: abs(box.height))
    guard display.width >= 2, display.height >= 2 else { throw LivelockError.noVideoTrack(p.id) }

    // Trim (source seconds), capped so the finished loop is at most maxDurationMs.
    let speed = p.speed > 0 ? p.speed : 1
    let trackEnd = trackRange.end.seconds
    guard trackEnd.isFinite, trackEnd > 0 else { throw LivelockError.noVideoTrack(p.id) }
    var start = min(max(0, p.trim.startMs / 1000), trackEnd)
    var end = p.trim.endMs > p.trim.startMs ? min(p.trim.endMs / 1000, trackEnd) : trackEnd
    if end - start < 0.1 {
      start = 0
      end = trackEnd
    }
    end = min(end, start + (s.maxDurationMs / 1000) * speed)

    let timescale: CMTimeScale = 600
    let sourceRange = CMTimeRange(
      start: CMTime(seconds: start, preferredTimescale: timescale),
      end: CMTime(seconds: end, preferredTimescale: timescale)
    )

    // Video track only: the composition never gets an audio track.
    let composition = AVMutableComposition()
    guard let compTrack = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      throw LivelockError.exportFailed("composition track")
    }
    try compTrack.insertTimeRange(sourceRange, of: track, at: .zero)
    var outDuration = sourceRange.duration
    if abs(speed - 1) > 0.001 {
      outDuration = CMTimeMultiplyByFloat64(sourceRange.duration, multiplier: 1 / speed)
      compTrack.scaleTimeRange(CMTimeRange(start: .zero, duration: sourceRange.duration), toDuration: outDuration)
    }

    // Orientation + crop + scale into the portrait render size.
    let render = CGSize(width: s.width, height: s.height)
    let crop = Self.cropInDisplay(p, display: display, render: render)
    let toDisplay = transform.concatenating(CGAffineTransform(translationX: -box.minX, y: -box.minY))
    let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: compTrack)
    layer.setTransform(toDisplay.concatenating(Self.cropToRender(crop, render: render)), at: .zero)
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: outDuration)
    instruction.layerInstructions = [layer]
    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = render
    videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(max(1, s.fps)))
    videoComposition.instructions = [instruction]

    guard let session = AVAssetExportSession(asset: composition, presetName: Self.preset(codec: s.codec)) else {
      throw LivelockError.exportFailed("no export session")
    }
    session.videoComposition = videoComposition
    session.shouldOptimizeForNetworkUse = false
    session.timeRange = CMTimeRange(start: .zero, duration: outDuration)
    try await Self.run(session, to: out)
  }

  /// HEVC when asked for and available, else H.264. Presets size the bitrate themselves;
  /// settings.bitrate only applies to the GIF writer.
  static func preset(codec: String) -> String {
    if codec == "hevc", AVAssetExportSession.allExportPresets().contains(AVAssetExportPresetHEVCHighestQuality) {
      return AVAssetExportPresetHEVCHighestQuality
    }
    return AVAssetExportPresetHighestQuality
  }

  static func run(_ session: AVAssetExportSession, to out: URL) async throws {
    if #available(iOS 18.0, *) {
      do {
        try await session.export(to: out, as: .mov)
      } catch {
        throw LivelockError.exportFailed(String(describing: error))
      }
    } else {
      session.outputURL = out
      session.outputFileType = .mov
      await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
        session.exportAsynchronously { cont.resume() }
      }
      guard session.status == .completed else {
        throw LivelockError.exportFailed(session.error.map { String(describing: $0) } ?? "status \(session.status.rawValue)")
      }
    }
  }

  // MARK: - GIF (ImageIO frames -> AVAssetWriter)

  private func exportGIF(
    _ p: LivelockProject,
    source: URL,
    settings s: LivelockExportSettings,
    to out: URL
  ) async throws {
    guard let src = CGImageSourceCreateWithURL(source as CFURL, nil) else { throw LivelockError.gifDecode(p.id) }
    let count = CGImageSourceGetCount(src)
    guard count > 0 else { throw LivelockError.gifDecode(p.id) }
    let speed = p.speed > 0 ? p.speed : 1
    let maxSeconds = s.maxDurationMs / 1000
    let render = CGSize(width: s.width, height: s.height)

    let writer = try AVAssetWriter(outputURL: out, fileType: .mov)
    let codec: AVVideoCodecType = s.codec == "hevc" ? .hevc : .h264
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: codec,
      AVVideoWidthKey: s.width,
      AVVideoHeightKey: s.height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: s.bitrate,
        AVVideoExpectedSourceFrameRateKey: s.fps,
      ],
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: s.width,
      kCVPixelBufferHeightKey as String: s.height,
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ])
    guard writer.canAdd(input) else { throw LivelockError.exportFailed("writer input") }
    writer.add(input)
    guard writer.startWriting() else {
      throw LivelockError.exportFailed(writer.error.map { String(describing: $0) } ?? "startWriting")
    }
    writer.startSession(atSourceTime: .zero)

    var t = 0.0
    var crop: CGRect?
    var frames = 0
    for i in 0..<count {
      if t >= maxSeconds { break }
      guard let image = CGImageSourceCreateImageAtIndex(src, i, nil) else { continue }
      let frameCrop = crop ?? Self.cropInDisplay(p, display: CGSize(width: image.width, height: image.height), render: render)
      crop = frameCrop
      while !input.isReadyForMoreMediaData {
        try await Task.sleep(nanoseconds: 5_000_000)
      }
      guard let pool = adaptor.pixelBufferPool else { throw LivelockError.exportFailed("pixel buffer pool") }
      var buffer: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
      guard let buffer else { throw LivelockError.exportFailed("pixel buffer") }
      Self.draw(image, crop: frameCrop, render: render, into: buffer)
      guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: t, preferredTimescale: 600)) else {
        throw LivelockError.exportFailed(writer.error.map { String(describing: $0) } ?? "append")
      }
      frames += 1
      t += Self.gifDelay(src, index: i) / speed
    }
    guard frames > 0 else {
      writer.cancelWriting()
      throw LivelockError.gifDecode(p.id)
    }
    input.markAsFinished()
    writer.endSession(atSourceTime: CMTime(seconds: min(t, maxSeconds), preferredTimescale: 600))
    await writer.finishWriting()
    guard writer.status == .completed else {
      throw LivelockError.exportFailed(writer.error.map { String(describing: $0) } ?? "finishWriting")
    }
  }

  /// Frame delay in seconds; tiny delays are treated as 0.1 s like browsers do.
  static func gifDelay(_ src: CGImageSource, index: Int) -> Double {
    guard let props = CGImageSourceCopyPropertiesAtIndex(src, index, nil) as? [String: Any],
          let gif = props[kCGImagePropertyGIFDictionary as String] as? [String: Any] else { return 0.1 }
    let d = (gif[kCGImagePropertyGIFUnclampedDelayTime as String] as? Double)
      ?? (gif[kCGImagePropertyGIFDelayTime as String] as? Double)
      ?? 0.1
    return d < 0.02 ? 0.1 : d
  }

  /// Draw `image` so `crop` (y-down image pixels) fills the render size.
  static func draw(_ image: CGImage, crop: CGRect, render: CGSize, into buffer: CVPixelBuffer) {
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: CVPixelBufferGetWidth(buffer),
            height: CVPixelBufferGetHeight(buffer),
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: space,
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
          ) else { return }
    ctx.setFillColor(CGColor(gray: 0, alpha: 1))
    ctx.fill(CGRect(origin: .zero, size: render))
    ctx.interpolationQuality = .high
    let t = cropToRender(crop, render: render)
    let w = CGFloat(image.width) * t.a
    let h = CGFloat(image.height) * t.d
    // t is y-down; CGContext is y-up, so flip the destination rect's y.
    ctx.draw(image, in: CGRect(x: t.tx, y: render.height - (t.ty + h), width: w, height: h))
  }

  // MARK: - Geometry

  /// The payload's crop rect, rescaled to the real display-oriented size (the picker's size
  /// can differ from the decoded one). Falls back to a centred aspect-fill crop.
  static func cropInDisplay(_ p: LivelockProject, display: CGSize, render: CGSize) -> CGRect {
    let full = CGRect(origin: .zero, size: display)
    let sx = p.sourceWidth > 0 ? display.width / p.sourceWidth : 1
    let sy = p.sourceHeight > 0 ? display.height / p.sourceHeight : 1
    let r = p.cropRect
    let crop = CGRect(x: r.x * sx, y: r.y * sy, width: r.width * sx, height: r.height * sy).intersection(full)
    if !crop.isNull, crop.width >= 2, crop.height >= 2 { return crop }
    let aspect = render.width / render.height
    if display.width / display.height > aspect {
      let w = display.height * aspect
      return CGRect(x: (display.width - w) / 2, y: 0, width: w, height: display.height)
    }
    let h = display.width / aspect
    return CGRect(x: 0, y: (display.height - h) / 2, width: display.width, height: h)
  }

  /// y-down transform mapping `crop` onto the render rect (aspect-fill, centred).
  static func cropToRender(_ crop: CGRect, render: CGSize) -> CGAffineTransform {
    let scale = max(render.width / crop.width, render.height / crop.height)
    let tx = (render.width - crop.width * scale) / 2 - crop.minX * scale
    let ty = (render.height - crop.height * scale) / 2 - crop.minY * scale
    return CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: tx, ty: ty)
  }

  // MARK: - Files

  static func cacheDirectory() throws -> URL {
    let base = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let dir = base.appendingPathComponent(folderName, isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  static func sourceURL(_ uri: String) throws -> URL {
    if uri.hasPrefix("file://"), let url = URL(string: uri) { return url }
    if uri.hasPrefix("/") { return URL(fileURLWithPath: uri) }
    throw LivelockError.badSource(uri)
  }

  /// FNV-1a over every input that changes the output (stable across launches, unlike Hasher).
  static func cacheKey(_ p: LivelockProject, _ s: LivelockExportSettings) -> String {
    let r = p.cropRect
    let text = [
      "v2-3x4", p.sourceUri, p.kind, // v2: 3:4 artwork export (T135); never reuse a v1 screen-aspect file
      "\(p.trim.startMs)-\(p.trim.endMs)",
      "\(r.x),\(r.y),\(r.width),\(r.height)",
      "\(p.sourceWidth)x\(p.sourceHeight)",
      "\(p.speed)",
      "\(s.width)x\(s.height)@\(s.fps)", s.codec, "\(s.bitrate)", "\(s.maxDurationMs)",
    ].joined(separator: "|")
    var hash: UInt64 = 0xcbf2_9ce4_8422_2325
    for byte in text.utf8 {
      hash ^= UInt64(byte)
      hash = hash &* 0x0000_0100_0000_01b3
    }
    return String(hash, radix: 16)
  }

  /// First frame (time zero, no tolerance) of the exported 3:4 loop, at full export size.
  static func previewImage(_ asset: AVURLAsset) async throws -> UIImage {
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    if #available(iOS 16.0, *) {
      let (cg, _) = try await generator.image(at: .zero)
      return UIImage(cgImage: cg)
    }
    let cg = try generator.copyCGImage(at: .zero, actualTime: nil)
    return UIImage(cgImage: cg)
  }
}
