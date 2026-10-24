import AVFoundation
import MediaPlayer
import UIKit

/// Live Lock Screen session (T135 continuous loop): a muted, user-started Now Playing item whose
/// artwork is the exported 3:4 loop, which the iOS 26 Lock Screen shows full screen.
///
/// - AVAudioSession `.playback` (no mixWithOthers, so Glaze is the Now Playing app) with an
///   AVAudioPlayer looping a silent WAV generated at runtime (no bundled audio asset).
/// - MPNowPlayingInfoCenter: title = loop name (or "Live Lock Screen"), artist = "Glaze", a 3:4
///   still artwork (the loop's first frame), and on iOS 26+ the 3:4 animated artwork
///   (MPNowPlayingInfoProperty3x4AnimatedArtwork) from the exported video (see makeAnimatedArtwork).
/// - MPRemoteCommandCenter: play / pause / toggle (the playback rate is updated so the Lock Screen
///   button flips), next (and previous) track for playlists.
/// - Interruptions (another app's audio, calls: we pause), route changes, media-services resets and
///   Low Power Mode (we stop, and refuse to start) are handled.
/// - The snapshot's `artwork` says what the Lock Screen got: "animated-3x4" or "static" (the key
///   isn't in supportedAnimatedArtworkKeys, the SDK has no animated artwork, or the preview isn't 3:4).
///   "animated-1x1" is reserved: a square export would need a second encode, so it isn't made.
///
/// Main-thread confined: every method is called on the main queue (the module runs its
/// functions on .main and the export task hops back with DispatchQueue.main.async).
final class NowPlayingController: @unchecked Sendable {
  enum State: String {
    case idle, preparing, playing, paused, stopped, error
  }

  /// Sends the current snapshot (see `snapshot(reason:)`) to JS as the onState event.
  var onState: (([String: Any]) -> Void)?

  private let exporter = LoopExporter()
  private var loops: [ExportedLoop] = []
  private var index = 0
  private var player: AVAudioPlayer?
  private var state: State = .idle
  private var progress: (done: Int, total: Int) = (0, 0)
  private var generation = 0
  private var observers: [NSObjectProtocol] = []
  private var commandTargets: [(MPRemoteCommand, Any)] = []
  /// What the current Now Playing item carries: "animated-3x4" | "animated-1x1" | "static".
  private var artworkMode = "static"

  // MARK: - Public (main thread)

  func start(_ payload: LivelockPayload, completion: @escaping (Error?) -> Void) {
    tearDown()
    generation += 1
    let gen = generation
    // Battery guard: Low Power Mode shows only a still anyway, and we stop when it turns on.
    if ProcessInfo.processInfo.isLowPowerModeEnabled {
      setState(.error, reason: "low-power")
      completion(LivelockError.lowPower)
      return
    }
    progress = (0, payload.projects.count)
    setState(.preparing)

    let exporter = self.exporter
    Task.detached(priority: .userInitiated) { [weak self] in
      var exported: [ExportedLoop] = []
      do {
        for project in payload.projects {
          let loop = try await exporter.export(project, settings: payload.export)
          exported.append(loop)
          let done = exported.count
          DispatchQueue.main.async {
            guard let self, gen == self.generation else { return }
            self.progress = (done, payload.projects.count)
            self.emit()
          }
        }
        let ready = exported // immutable copy for the main-queue closure
        DispatchQueue.main.async {
          guard let self else { return completion(nil) }
          guard gen == self.generation else { return completion(nil) } // stopped while preparing
          do {
            try self.begin(ready)
            // Prune only after the new item replaced the old one: a URL in nowPlayingInfo must
            // stay valid while the artwork is shown.
            exporter.prune(keeping: ready.map { $0.videoURL })
            completion(nil)
          } catch {
            self.tearDown()
            self.setState(.error, reason: String(describing: error))
            completion(error)
          }
        }
      } catch {
        DispatchQueue.main.async {
          guard let self, gen == self.generation else { return completion(error) }
          self.tearDown()
          self.setState(.error, reason: String(describing: error))
          completion(error)
        }
      }
    }
  }

  func stop(reason: String = "user") {
    generation += 1 // cancels a start that is still preparing
    let wasActive = state != .idle && state != .stopped
    tearDown()
    if wasActive { setState(.stopped, reason: reason) }
  }

  func next() {
    guard !loops.isEmpty else { return }
    index = (index + 1) % loops.count
    updateNowPlaying()
    emit()
  }

  func previous() {
    guard !loops.isEmpty else { return }
    index = (index - 1 + loops.count) % loops.count
    updateNowPlaying()
    emit()
  }

  func snapshot(reason: String? = nil) -> [String: Any] {
    var body: [String: Any] = [
      "state": state.rawValue,
      "index": index,
      "count": loops.count,
      "prepared": progress.done,
      "total": progress.total,
    ]
    if let reason { body["reason"] = reason }
    if index < loops.count {
      body["projectId"] = loops[index].projectID
      body["artwork"] = artworkMode
    }
    return body
  }

  // MARK: - Session

  private func begin(_ exported: [ExportedLoop]) throws {
    guard !exported.isEmpty else { throw LivelockError.badPayload("nothing exported") }
    loops = exported
    index = 0
    try activateAudio()
    installRemoteCommands()
    installObservers()
    updateNowPlaying()
    setState(.playing)
  }

  private func activateAudio() throws {
    let session = AVAudioSession.sharedInstance()
    do {
      // No .mixWithOthers: a mixable session cannot become the Now Playing app.
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true)
      let p = try AVAudioPlayer(contentsOf: SilentAudio.fileURL())
      p.numberOfLoops = -1
      p.volume = 1 // the samples are silent; a non-zero volume keeps playback "real"
      p.prepareToPlay()
      guard p.play() else { throw LivelockError.audio("play() returned false") }
      player = p
    } catch let error as LivelockError {
      throw error
    } catch {
      throw LivelockError.audio(String(describing: error))
    }
  }

  private func resume() -> Bool {
    guard let player, !loops.isEmpty else { return false }
    do {
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      return false
    }
    guard player.play() else { return false }
    updatePlaybackRate()
    setState(.playing)
    return true
  }

  private func pause(reason: String? = nil) {
    guard let player else { return }
    player.pause()
    updatePlaybackRate()
    setState(.paused, reason: reason)
  }

  private func tearDown() {
    player?.stop()
    player = nil
    removeRemoteCommands()
    removeObservers()
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    loops = []
    index = 0
    progress = (0, 0)
    artworkMode = "static"
  }

  // MARK: - Now Playing

  private func updateNowPlaying() {
    guard index < loops.count else {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      return
    }
    let loop = loops[index]
    let preview = loop.preview
    let playing = player?.isPlaying ?? false
    let title = loop.name.trimmingCharacters(in: .whitespacesAndNewlines)
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: title.isEmpty ? "Live Lock Screen" : title,
      MPMediaItemPropertyArtist: "Glaze",
      // An endless loop: present it as live so there is no scrubber to fake.
      MPNowPlayingInfoPropertyIsLiveStream: true,
      MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
      MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
      MPNowPlayingInfoPropertyPlaybackQueueIndex: index,
      MPNowPlayingInfoPropertyPlaybackQueueCount: loops.count,
      // Static artwork: the same 3:4 first frame (shown when the system won't animate).
      MPMediaItemPropertyArtwork: MPMediaItemArtwork(boundsSize: preview.size) { _ in preview },
    ]
    artworkMode = "static"
    if #available(iOS 26.0, *),
       let animated = makeAnimatedArtwork(
         // Unique per export: the file name carries the hash of every export input.
         artworkID: loop.videoURL.lastPathComponent,
         videoURL: loop.videoURL,
         preview: preview
       ) {
      info[animated.key] = animated.artwork
      artworkMode = animated.mode
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  /// Play/pause only changes the rate: keep the rest of the item (and its artwork) as it is, so
  /// the Lock Screen's play/pause button flips without reloading the artwork.
  private func updatePlaybackRate() {
    let center = MPNowPlayingInfoCenter.default()
    guard var info = center.nowPlayingInfo, !info.isEmpty else {
      updateNowPlaying()
      return
    }
    let playing = player?.isPlaying ?? false
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    center.nowPlayingInfo = info
  }

  // MARK: - Remote commands

  private func installRemoteCommands() {
    removeRemoteCommands()
    let center = MPRemoteCommandCenter.shared()
    let multi = loops.count > 1
    add(center.playCommand, enabled: true) { [weak self] in
      self?.resume() == true ? .success : .commandFailed
    }
    add(center.pauseCommand, enabled: true) { [weak self] in
      self?.pause()
      return .success
    }
    add(center.togglePlayPauseCommand, enabled: true) { [weak self] in
      guard let self else { return .commandFailed }
      if self.player?.isPlaying == true {
        self.pause()
        return .success
      }
      return self.resume() ? .success : .commandFailed
    }
    add(center.nextTrackCommand, enabled: multi) { [weak self] in
      self?.next()
      return .success
    }
    add(center.previousTrackCommand, enabled: multi) { [weak self] in
      self?.previous()
      return .success
    }
    // Nothing to seek or skip within a loop.
    center.changePlaybackPositionCommand.isEnabled = false
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false
    center.seekForwardCommand.isEnabled = false
    center.seekBackwardCommand.isEnabled = false
  }

  private func add(
    _ command: MPRemoteCommand,
    enabled: Bool,
    _ handler: @escaping () -> MPRemoteCommandHandlerStatus
  ) {
    command.isEnabled = enabled
    guard enabled else { return }
    // MediaPlayer calls handlers on the main thread.
    let target = command.addTarget { _ in handler() }
    commandTargets.append((command, target))
  }

  private func removeRemoteCommands() {
    for (command, target) in commandTargets {
      command.removeTarget(target)
      command.isEnabled = false
    }
    commandTargets = []
  }

  // MARK: - Interruptions, routes, resets, Low Power Mode

  private func installObservers() {
    removeObservers()
    let nc = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()
    observers.append(nc.addObserver(
      forName: AVAudioSession.interruptionNotification, object: session, queue: .main
    ) { [weak self] note in self?.handleInterruption(note) })
    observers.append(nc.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
    ) { [weak self] note in self?.handleRouteChange(note) })
    observers.append(nc.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main
    ) { [weak self] _ in self?.handleMediaServicesReset() })
    observers.append(nc.addObserver(
      forName: Notification.Name.NSProcessInfoPowerStateDidChange, object: nil, queue: .main
    ) { [weak self] _ in
      // Battery guard: Low Power Mode switches Live Lock Screen off (docs/LIVELOCK.md).
      if ProcessInfo.processInfo.isLowPowerModeEnabled { self?.stop(reason: "low-power") }
    })
  }

  private func removeObservers() {
    for o in observers { NotificationCenter.default.removeObserver(o) }
    observers = []
  }

  private func handleInterruption(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    switch type {
    case .began:
      // The system already paused our player (a call, another app's audio, Siri...). The other
      // app becomes the Now Playing app, so the loop leaves the Lock Screen until play is tapped.
      updatePlaybackRate()
      setState(.paused, reason: "interrupted")
    case .ended:
      let optRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      if AVAudioSession.InterruptionOptions(rawValue: optRaw).contains(.shouldResume) {
        _ = resume()
      }
    @unknown default:
      break
    }
  }

  private func handleRouteChange(_ note: Notification) {
    // The loop is silent, so a lost route (headphones unplugged) changes nothing audible.
    // Refresh Now Playing so the Lock Screen reflects the real player state.
    guard player != nil else { return }
    updateNowPlaying()
    emit()
  }

  private func handleMediaServicesReset() {
    // All audio objects are invalid after a reset: rebuild them if we were running.
    guard state == .playing || state == .paused, !loops.isEmpty else { return }
    let wasPlaying = state == .playing
    player = nil
    do {
      try activateAudio()
      if !wasPlaying { player?.pause() }
      installRemoteCommands()
      updateNowPlaying()
      setState(wasPlaying ? .playing : .paused, reason: "media-reset")
    } catch {
      stop(reason: "media-reset")
    }
  }

  // MARK: - State

  private func setState(_ next: State, reason: String? = nil) {
    state = next
    emit(reason: reason)
  }

  private func emit(reason: String? = nil) {
    onState?(snapshot(reason: reason))
  }
}

// MARK: - Animated artwork (iOS 26)

// VERIFIED against Apple's "Providing animated artwork for media items" (MediaPlayer, fetched
// 24 Oct 2026; the init/key/supportedAnimatedArtworkKeys calls below compiled on EAS with the
// iOS 26 SDK before T135):
//   - class MPMediaItemAnimatedArtwork (iOS 26.0+),
//     init(artworkID:previewImageRequestHandler:videoAssetFileURLRequestHandler:); Apple's sample
//     passes `{ _ in image }` and `{ _ in url }` (async closures receiving a CGSize).
//   - keys MPNowPlayingInfoProperty3x4AnimatedArtwork (tall 3:4) and
//     MPNowPlayingInfoProperty1x1AnimatedArtwork (square); MPNowPlayingInfoCenter
//     .supportedAnimatedArtworkKeys lists the keys this platform uses, others are ignored.
//   - "If you return a preview image with an incorrect aspect ratio ... the system will ignore your
//     animated artwork and display your static artwork." The video must match the key's aspect too.
//     ROOT CAUSE of the owner's "small player" (pre-T135): the loop was exported at the screen
//     aspect (~9:19.5), so iOS dropped the animated artwork. Now the export is 1080x1440 and the
//     preview is that file's first frame; we also refuse to register a non-3:4 preview.
//   - The preview should match the video's first frame and be returned quickly (we return a
//     UIImage already in memory). The video: a local file URL, playable by AVPlayerLayer, <= 60 fps,
//     a short seamless loop; the URL stays valid while the item is shown (pruned only after a new
//     start replaced it); artworkID identifies the artwork (the export file name, which hashes
//     every input, so it changes whenever the loop changes).
//   - The system shows only the preview in Low Power Mode, Low Data Mode, high thermal state, with
//     Reduce Motion on, or with Auto-Play Animated Images off.
// `#if compiler(>=6.2)` keeps the file building with pre-iOS 26 SDKs (Xcode 26 ships Swift 6.2);
// there the feature reports "not-built".
@available(iOS 26.0, *)
func makeAnimatedArtwork(artworkID: String, videoURL: URL, preview: UIImage) -> (key: String, artwork: Any, mode: String)? {
  #if compiler(>=6.2)
  // A wrong-aspect preview makes the system ignore the animated artwork: report "static" instead.
  let size = preview.size
  guard size.width > 0, size.height > 0, abs(size.width / size.height - 0.75) < 0.01 else { return nil }
  let key = MPNowPlayingInfoProperty3x4AnimatedArtwork
  guard MPNowPlayingInfoCenter.supportedAnimatedArtworkKeys.contains(key) else { return nil }
  let artwork = MPMediaItemAnimatedArtwork(
    artworkID: artworkID,
    previewImageRequestHandler: { _ in preview },
    videoAssetFileURLRequestHandler: { _ in videoURL }
  )
  return (key, artwork, "animated-3x4")
  #else
  return nil
  #endif
}

/// True when this binary was built with an SDK that has animated artwork.
let livelockSDKHasAnimatedArtwork: Bool = {
  #if compiler(>=6.2)
  return true
  #else
  return false
  #endif
}()

// MARK: - Silent audio

/// A short silent PCM WAV written at runtime, so no binary audio asset is bundled.
enum SilentAudio {
  static let sampleRate: UInt32 = 8_000
  static let seconds: UInt32 = 10

  static func fileURL() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("glaze-livelock-silence.wav")
    if FileManager.default.fileExists(atPath: url.path) { return url }
    try wavData().write(to: url, options: .atomic)
    return url
  }

  /// 16-bit mono PCM, all zero samples.
  static func wavData() -> Data {
    let channels: UInt16 = 1
    let bitsPerSample: UInt16 = 16
    let blockAlign = channels * bitsPerSample / 8
    let byteRate = sampleRate * UInt32(blockAlign)
    let dataSize = sampleRate * seconds * UInt32(blockAlign)
    var d = Data()
    func le<T: FixedWidthInteger>(_ v: T) {
      withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) }
    }
    d.append(contentsOf: Array("RIFF".utf8)); le(UInt32(36) + dataSize)
    d.append(contentsOf: Array("WAVE".utf8))
    d.append(contentsOf: Array("fmt ".utf8)); le(UInt32(16))
    le(UInt16(1)) // PCM
    le(channels)
    le(sampleRate)
    le(byteRate)
    le(blockAlign)
    le(bitsPerSample)
    d.append(contentsOf: Array("data".utf8)); le(dataSize)
    d.append(Data(count: Int(dataSize)))
    return d
  }
}
