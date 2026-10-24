import Foundation

// Mirrors src/core/livelockPayload.ts (LivelockPayload). Keep both in step.

/// T135: always 3:4 (1080x1440) so it matches MPNowPlayingInfoProperty3x4AnimatedArtwork.
struct LivelockExportSettings: Decodable, Sendable {
  let width: Int
  let height: Int
  let fps: Int
  /// "hevc" or "h264".
  let codec: String
  /// Target average bitrate (bits/s). Used by the GIF writer; export presets choose their own.
  let bitrate: Int
  let maxDurationMs: Double
}

struct LivelockTrim: Decodable, Sendable {
  let startMs: Double
  let endMs: Double
}

struct LivelockRect: Decodable, Sendable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

struct LivelockProject: Decodable, Sendable {
  let id: String
  let name: String
  let sourceUri: String
  /// "video" or "gif".
  let kind: String
  /// Display-oriented source size the crop rect was computed against.
  let sourceWidth: Double
  let sourceHeight: Double
  /// endMs <= startMs means "unknown": use the whole clip, capped to the max loop length.
  let trim: LivelockTrim
  /// Pixel crop in display-oriented source coordinates, exactly 3:4 (same aspect as the export).
  let cropRect: LivelockRect
  /// 0.5, 1 or 1.5.
  let speed: Double
}

struct LivelockPayload: Decodable, Sendable {
  let version: Int
  let export: LivelockExportSettings
  let projects: [LivelockProject]

  static let supportedVersion = 1

  static func decode(_ json: String) throws -> LivelockPayload {
    guard let data = json.data(using: .utf8) else { throw LivelockError.badPayload("not UTF-8") }
    let payload: LivelockPayload
    do {
      payload = try JSONDecoder().decode(LivelockPayload.self, from: data)
    } catch {
      throw LivelockError.badPayload(String(describing: error))
    }
    guard payload.version == supportedVersion else { throw LivelockError.badPayload("version \(payload.version)") }
    guard !payload.projects.isEmpty else { throw LivelockError.badPayload("no projects") }
    guard payload.export.width > 0, payload.export.height > 0, payload.export.fps > 0 else {
      throw LivelockError.badPayload("export size")
    }
    // T135: the 3x4 animated artwork key needs a 3:4 video (and preview), or iOS ignores it and
    // shows the static artwork. src/core/livelockPayload.ts always sends 1080x1440.
    guard payload.export.width * 4 == payload.export.height * 3 else {
      throw LivelockError.badPayload("export size must be 3:4")
    }
    guard payload.export.fps <= 60 else { throw LivelockError.badPayload("fps above 60") }
    for p in payload.projects where !(p.speed > 0) {
      throw LivelockError.badPayload("speed for \(p.id)")
    }
    return payload
  }
}

enum LivelockError: Error, CustomStringConvertible {
  case badPayload(String)
  case badSource(String)
  case noVideoTrack(String)
  case exportFailed(String)
  case gifDecode(String)
  case audio(String)
  case lowPower

  var description: String {
    switch self {
    case .badPayload(let s): return "bad payload: \(s)"
    case .badSource(let s): return "source not readable: \(s)"
    case .noVideoTrack(let s): return "no video track: \(s)"
    case .exportFailed(let s): return "export failed: \(s)"
    case .gifDecode(let s): return "GIF could not be read: \(s)"
    case .audio(let s): return "audio session: \(s)"
    case .lowPower: return "low-power"
    }
  }
}
