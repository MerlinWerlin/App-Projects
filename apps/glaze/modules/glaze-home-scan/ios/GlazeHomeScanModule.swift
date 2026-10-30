// GlazeHomeScan (T171 "Scan my Home Screen"): reads the text in a Home Screen screenshot with
// Apple's on-device Vision text recogniser so Glaze can find the app names under the icons.
//
// NOT YET TESTED ON A DEVICE. Anything we could not check without Xcode is marked `// VERIFY`.
//
// Privacy: the image is a local file the system photo picker handed to the app (expo-image-picker
// copies it into the app's cache). It is read here, on the phone, and never uploaded. This module
// does no networking and does not touch the photo library itself.
//
// JS side: src/native/homeScan.ts (adapter) -> NativeModule "GlazeHomeScan".recognizeText(fileUri)
// -> [{ text, confidence, x, y, w, h }] with boxes normalised 0..1 and a TOP-LEFT origin (Vision
// reports bottom-left; flipped here). src/core/homeScan.ts cleans and matches the lines.

import ExpoModulesCore
import ImageIO
import UIKit
import Vision

public class GlazeHomeScanModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeHomeScan")

    // Synchronous closure: ExpoModulesCore runs AsyncFunction bodies off the main thread, and
    // VNImageRequestHandler.perform is itself synchronous. Throws reject the JS promise.
    AsyncFunction("recognizeText") { (fileUri: String) throws -> [[String: Any]] in
      return try HomeScanReader.recognize(fileUri: fileUri)
    }
  }
}

enum HomeScanError: LocalizedError {
  case unreadable(String)
  case vision(String)

  var errorDescription: String? {
    switch self {
    case .unreadable(let why): return "The screenshot could not be read: \(why)"
    case .vision(let why): return "Text recognition failed: \(why)"
    }
  }
}

enum HomeScanReader {
  /// Most lines returned per screenshot (a Home Screen has ~30 labels plus widget text).
  static let maxLines = 400

  static func recognize(fileUri: String) throws -> [[String: Any]] {
    let path: String
    if fileUri.hasPrefix("file://") {
      guard let url = URL(string: fileUri) else { throw HomeScanError.unreadable("bad file URI") }
      path = url.path
    } else {
      path = fileUri
    }
    guard let image = UIImage(contentsOfFile: path) else { throw HomeScanError.unreadable("not an image file") }
    guard let cgImage = image.cgImage else { throw HomeScanError.unreadable("no bitmap") }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // App names are proper nouns; language correction "fixes" them into dictionary words.
    request.usesLanguageCorrection = false
    if #available(iOS 16.0, *) {
      request.automaticallyDetectsLanguage = true // VERIFY: iOS 16 API name
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: cgOrientation(image.imageOrientation), options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw HomeScanError.vision(error.localizedDescription)
    }

    var out: [[String: Any]] = []
    for observation in request.results ?? [] {
      guard let best = observation.topCandidates(1).first else { continue }
      let text = best.string.trimmingCharacters(in: .whitespacesAndNewlines)
      if text.isEmpty { continue }
      let box = observation.boundingBox // normalised, origin bottom-left
      out.append([
        "text": text,
        "confidence": Double(best.confidence),
        "x": Double(box.minX),
        "y": Double(1 - box.maxY),
        "w": Double(box.width),
        "h": Double(box.height),
      ])
      if out.count >= maxLines { break }
    }
    return out
  }

  /// UIImage orientation -> the EXIF orientation Vision expects. Screenshots are normally .up.
  static func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
