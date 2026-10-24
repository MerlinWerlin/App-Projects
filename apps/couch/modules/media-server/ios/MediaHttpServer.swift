import ExpoModulesCore
import Foundation
import Network
import Security

/**
 * media-server HTTP core: one NWListener per app process on an ephemeral TCP port (>= 1024) on all
 * interfaces, started lazily by the first serve(). Every piece of mutable state below is touched
 * ONLY on `queue` (a dedicated serial DispatchQueue); NWListener / NWConnection callbacks are
 * started on that same queue.
 *
 * Request handling: read the request head until CRLF CRLF (16 KiB cap, 15 s timeout), GET and
 * HEAD only (else 405), path `/<token>` or `/<token>.<ext>` (else 404), one byte range
 * (`bytes=a-b`, `a-`, `-n`) -> 206, unsatisfiable -> 416, several ranges -> full 200. The file is
 * streamed with FileHandle in 64 KiB chunks; the next chunk is read only after NWConnection has
 * processed the previous one, so a video is never loaded into memory. Every response carries
 * `Connection: close`.
 *
 * Nothing here logs tokens or file paths.
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested on a device or a TV.
 */

private let mediaHeadEnd = Data([13, 10, 13, 10])
private let mediaMaxHeadBytes = 16 * 1024
private let mediaChunkBytes = 64 * 1024
private let mediaMaxConnections = 64
private let mediaHeadTimeoutSeconds = 15.0

/// One registered file.
private struct MediaServedEntry {
  let id: String
  let token: String
  let path: String
  let mime: String
  let size: UInt64
  let streaming: Bool
}

/// A serve() call waiting for the listener to become ready.
private struct MediaPendingServe {
  let entry: MediaServedEntry
  let promise: Promise
}

/// Result of parsing a Range header against a file size.
private enum MediaRangeResult {
  case full
  case partial(start: UInt64, end: UInt64)
  case unsatisfiable
}

/// Per-connection state (reference type so @Sendable callbacks never capture a `var`).
private final class MediaHttpConnection: @unchecked Sendable {
  let number: Int
  let connection: NWConnection
  var head = Data()
  var headDone = false
  var closed = false
  var entryId: String?
  var file: FileHandle?
  var remaining: UInt64 = 0

  init(number: Int, connection: NWConnection) {
    self.number = number
    self.connection = connection
  }
}

final class MediaHttpServer: @unchecked Sendable {
  private let queue = DispatchQueue(label: "couch.media-server")

  // State below: `queue` only.
  private var listener: NWListener?
  private var generation = 0
  private var port: UInt16?
  private var pending: [MediaPendingServe] = []
  private var entries: [String: MediaServedEntry] = [:]   // by token
  private var tokensById: [String: String] = [:]
  private var connections: [Int: MediaHttpConnection] = [:]
  private var nextConnection = 0

  // MARK: - API (any thread)

  func serve(uri: String, mime: String, promise: Promise) {
    queue.async {
      self.serveOnQueue(uri: uri, mime: mime, promise: promise)
    }
  }

  func stop(id: String, completion: (() -> Void)?) {
    queue.async {
      self.stopOnQueue(id: id)
      completion?()
    }
  }

  func stopAll(completion: (() -> Void)?) {
    queue.async {
      self.stopAllOnQueue()
      completion?()
    }
  }

  // MARK: - serve / stop (queue)

  private func serveOnQueue(uri: String, mime: String, promise: Promise) {
    let lower = uri.lowercased()
    if lower.hasPrefix("ph://") || lower.hasPrefix("assets-library://") {
      promise.reject("ERR_MEDIA_SERVER_URI", "Photo library (ph://) URIs are not supported; pass a file:// copy.")
      return
    }
    var path: String? = nil
    if lower.hasPrefix("file://") {
      if let url = URL(string: uri), url.isFileURL {
        path = url.path
      }
    } else if uri.hasPrefix("/") {
      path = uri
    }
    guard let filePath = path, !filePath.isEmpty else {
      promise.reject("ERR_MEDIA_SERVER_URI", "Only file:// URIs can be served.")
      return
    }
    let fm = FileManager.default
    var isDir: ObjCBool = false
    guard fm.fileExists(atPath: filePath, isDirectory: &isDir), !isDir.boolValue,
          fm.isReadableFile(atPath: filePath) else {
      promise.reject("ERR_MEDIA_SERVER_URI", "The file is missing or not readable.")
      return
    }
    var size: UInt64 = 0
    if let attrs = try? fm.attributesOfItem(atPath: filePath),
       let n = attrs[FileAttributeKey.size] as? NSNumber {
      size = n.uint64Value
    } else {
      promise.reject("ERR_MEDIA_SERVER_URI", "The file size could not be read.")
      return
    }
    guard let token = mediaRandomToken() else {
      promise.reject("ERR_MEDIA_SERVER_START", "No secure random bytes available.")
      return
    }

    let contentType = mediaSafeMime(mime)
    let lowerMime = contentType.lowercased()
    let streaming = lowerMime.hasPrefix("video/") || lowerMime.hasPrefix("audio/")
    let entry = MediaServedEntry(
      id: UUID().uuidString,
      token: token,
      path: filePath,
      mime: contentType,
      size: size,
      streaming: streaming
    )
    entries[token] = entry
    tokensById[entry.id] = token

    if let readyPort = port {
      resolve(entry: entry, port: readyPort, promise: promise)
      return
    }
    pending.append(MediaPendingServe(entry: entry, promise: promise))
    if listener == nil {
      startListener()
    }
  }

  private func resolve(entry: MediaServedEntry, port: UInt16, promise: Promise) {
    let result: [String: Any] = ["id": entry.id, "port": Int(port), "token": entry.token]
    promise.resolve(result)
  }

  private func stopOnQueue(id: String) {
    guard let token = tokensById.removeValue(forKey: id) else { return }
    entries.removeValue(forKey: token)
    let open = Array(connections.values)
    for c in open where c.entryId == id {
      drop(c)
    }
  }

  private func stopAllOnQueue() {
    generation += 1
    let oldListener = listener
    listener = nil
    port = nil
    oldListener?.cancel()
    let waiting = pending
    pending = []
    for p in waiting {
      p.promise.reject("ERR_MEDIA_SERVER_START", "The media server was stopped.")
    }
    entries.removeAll()
    tokensById.removeAll()
    let open = Array(connections.values)
    for c in open {
      drop(c)
    }
    connections.removeAll()
  }

  // MARK: - listener (queue)

  private func startListener() {
    generation += 1
    let gen = generation
    let params = NWParameters.tcp
    params.allowLocalEndpointReuse = true
    let newListener: NWListener
    do {
      newListener = try NWListener(using: params, on: NWEndpoint.Port.any)
    } catch {
      failPending(message: "The media server could not start.")
      return
    }
    newListener.stateUpdateHandler = { [weak self] state in
      self?.listenerStateChanged(state, generation: gen)
    }
    newListener.newConnectionHandler = { [weak self] conn in
      self?.accept(conn, generation: gen)
    }
    listener = newListener
    newListener.start(queue: queue)
  }

  private func listenerStateChanged(_ state: NWListener.State, generation gen: Int) {
    guard gen == generation, let current = listener else { return }
    switch state {
    case .ready:
      guard let raw = current.port?.rawValue, raw >= 1024 else {
        current.cancel()
        listener = nil
        failPending(message: "The media server got no usable port.")
        return
      }
      port = raw
      let waiting = pending
      pending = []
      for p in waiting {
        if entries[p.entry.token] != nil {
          resolve(entry: p.entry, port: raw, promise: p.promise)
        } else {
          p.promise.reject("ERR_MEDIA_SERVER_START", "The media server was stopped.")
        }
      }
    case .failed(_), .waiting(_):
      current.cancel()
      listener = nil
      port = nil
      failPending(message: "The media server could not listen on the network.")
    case .cancelled:
      listener = nil
      port = nil
      failPending(message: "The media server was stopped.")
    default:
      break
    }
  }

  /// Rejects every waiting serve() and forgets its entry.
  private func failPending(message: String) {
    let waiting = pending
    pending = []
    for p in waiting {
      entries.removeValue(forKey: p.entry.token)
      tokensById.removeValue(forKey: p.entry.id)
      p.promise.reject("ERR_MEDIA_SERVER_START", message)
    }
  }

  // MARK: - connections (queue)

  private func accept(_ conn: NWConnection, generation gen: Int) {
    guard gen == generation, connections.count < mediaMaxConnections else {
      conn.cancel()
      return
    }
    nextConnection += 1
    let c = MediaHttpConnection(number: nextConnection, connection: conn)
    connections[c.number] = c
    conn.stateUpdateHandler = { [weak self] state in
      switch state {
      case .failed(_), .cancelled:
        self?.drop(c)
      default:
        break
      }
    }
    conn.start(queue: queue)
    queue.asyncAfter(deadline: .now() + mediaHeadTimeoutSeconds) { [weak self] in
      if !c.headDone {
        self?.drop(c)
      }
    }
    receiveHead(c)
  }

  private func receiveHead(_ c: MediaHttpConnection) {
    c.connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
      guard let self = self, !c.closed, !c.headDone else { return }
      if let data = data, !data.isEmpty {
        c.head.append(data)
      }
      if let end = c.head.range(of: mediaHeadEnd) {
        c.headDone = true
        let headData = c.head.subdata(in: c.head.startIndex..<end.lowerBound)
        c.head = Data()
        self.handleRequest(c, headData: headData)
      } else if c.head.count > mediaMaxHeadBytes {
        c.headDone = true
        self.sendEmpty(c, status: 431, reason: "Request Header Fields Too Large", extra: [])
      } else if isComplete || error != nil {
        self.drop(c)
      } else {
        self.receiveHead(c)
      }
    }
  }

  private func handleRequest(_ c: MediaHttpConnection, headData: Data) {
    let text = String(decoding: headData, as: UTF8.self)
    let lines = text.components(separatedBy: "\r\n")
    let requestLine = lines.first ?? ""
    let parts = requestLine.split(separator: " ", omittingEmptySubsequences: true)
    guard parts.count >= 2 else {
      sendEmpty(c, status: 400, reason: "Bad Request", extra: [])
      return
    }
    let method = String(parts[0]).uppercased()
    let target = String(parts[1])

    var rangeHeader: String? = nil
    for line in lines.dropFirst() {
      guard let colon = line.firstIndex(of: ":") else { continue }
      let name = line[line.startIndex..<colon].trimmingCharacters(in: .whitespaces).lowercased()
      if name == "range" && rangeHeader == nil {
        rangeHeader = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      }
    }

    if method != "GET" && method != "HEAD" {
      let allow: [(String, String)] = [("Allow", "GET, HEAD")]
      sendEmpty(c, status: 405, reason: "Method Not Allowed", extra: allow)
      return
    }
    guard let token = mediaTokenFromTarget(target), let entry = entries[token] else {
      sendEmpty(c, status: 404, reason: "Not Found", extra: [])
      return
    }
    c.entryId = entry.id

    let size = entry.size
    var range = MediaRangeResult.full
    if let value = rangeHeader {
      range = mediaParseRange(value, size: size)
    }

    var status = 200
    var reason = "OK"
    var start: UInt64 = 0
    var length: UInt64 = size
    var headers: [(String, String)] = []
    switch range {
    case .unsatisfiable:
      let extra: [(String, String)] = [("Content-Range", "bytes */\(size)")]
      sendEmpty(c, status: 416, reason: "Range Not Satisfiable", extra: extra)
      return
    case .partial(let s, let e):
      status = 206
      reason = "Partial Content"
      start = s
      length = e - s + 1
      headers.append(("Content-Range", "bytes \(s)-\(e)/\(size)"))
    case .full:
      break
    }

    headers.append(("Content-Type", entry.mime))
    headers.append(("Content-Length", String(length)))
    headers.append(("Accept-Ranges", "bytes"))
    headers.append(("Cache-Control", "no-store"))
    headers.append(("Connection", "close"))
    headers.append(contentsOf: mediaDlnaHeaders(streaming: entry.streaming))

    let head = mediaResponseHead(status: status, reason: reason, headers: headers)
    if method == "HEAD" || length == 0 {
      sendFinal(c, data: head)
      return
    }

    guard let handle = FileHandle(forReadingAtPath: entry.path) else {
      sendEmpty(c, status: 500, reason: "Internal Server Error", extra: [])
      return
    }
    do {
      try handle.seek(toOffset: start)
    } catch {
      try? handle.close()
      sendEmpty(c, status: 500, reason: "Internal Server Error", extra: [])
      return
    }
    c.file = handle
    c.remaining = length
    c.connection.send(content: head, contentContext: .defaultMessage, isComplete: false, completion: .contentProcessed { [weak self] error in
      guard let self = self else { return }
      if error != nil {
        self.drop(c)
      } else {
        self.sendNextChunk(c)
      }
    })
  }

  private func sendNextChunk(_ c: MediaHttpConnection) {
    guard !c.closed, let handle = c.file else { return }
    if c.remaining == 0 {
      drop(c)
      return
    }
    let want = Int(min(UInt64(mediaChunkBytes), c.remaining))
    let chunk: Data
    do {
      chunk = try handle.read(upToCount: want) ?? Data()
    } catch {
      drop(c)
      return
    }
    if chunk.isEmpty {
      // The file shrank under us; Content-Length can no longer be honoured.
      drop(c)
      return
    }
    let count = UInt64(chunk.count)
    c.remaining = count >= c.remaining ? 0 : c.remaining - count
    let last = c.remaining == 0
    let context: NWConnection.ContentContext = last ? .finalMessage : .defaultMessage
    c.connection.send(content: chunk, contentContext: context, isComplete: last, completion: .contentProcessed { [weak self] error in
      guard let self = self else { return }
      if error != nil || last {
        self.drop(c)
      } else {
        self.sendNextChunk(c)
      }
    })
  }

  /// Response with no body, then close.
  private func sendEmpty(_ c: MediaHttpConnection, status: Int, reason: String, extra: [(String, String)]) {
    var headers: [(String, String)] = extra
    headers.append(("Content-Length", "0"))
    headers.append(("Connection", "close"))
    sendFinal(c, data: mediaResponseHead(status: status, reason: reason, headers: headers))
  }

  /// Sends `data` as the whole rest of the response (FIN after it), then cancels.
  private func sendFinal(_ c: MediaHttpConnection, data: Data) {
    guard !c.closed else { return }
    c.connection.send(content: data, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed { [weak self] _ in
      self?.drop(c)
    })
  }

  private func drop(_ c: MediaHttpConnection) {
    if c.closed { return }
    c.closed = true
    c.headDone = true
    if let handle = c.file {
      try? handle.close()
    }
    c.file = nil
    c.remaining = 0
    connections.removeValue(forKey: c.number)
    c.connection.cancel()
  }
}

// MARK: - Helpers (pure)

/// 18 bytes from SecRandomCopyBytes (144 bits) as base64url without padding: 24 characters.
private func mediaRandomToken() -> String? {
  var bytes = [UInt8](repeating: 0, count: 18)
  let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
  guard status == errSecSuccess else { return nil }
  let b64 = Data(bytes).base64EncodedString()
  return b64
    .replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
}

/// The caller's mime type, or application/octet-stream when empty or unsafe for a header line.
private func mediaSafeMime(_ mime: String) -> String {
  let trimmed = mime.trimmingCharacters(in: .whitespaces)
  if trimmed.isEmpty || trimmed.count > 100 { return "application/octet-stream" }
  for scalar in trimmed.unicodeScalars {
    if scalar.value < 0x20 || scalar.value > 0x7E { return "application/octet-stream" }
  }
  return trimmed
}

/// `/<token>` or `/<token>.<ext>` (query string ignored) -> token, else nil.
private func mediaTokenFromTarget(_ target: String) -> String? {
  var path = target
  if let q = path.firstIndex(of: "?") {
    path = String(path[path.startIndex..<q])
  }
  guard path.hasPrefix("/") else { return nil }
  path.removeFirst()
  var token = path
  if let dot = path.firstIndex(of: ".") {
    token = String(path[path.startIndex..<dot])
    let ext = path[path.index(after: dot)...]
    guard !ext.isEmpty, ext.count <= 5, ext.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) else { return nil }
  }
  guard token.count >= 22, token.count <= 128 else { return nil }
  for scalar in token.unicodeScalars {
    if !mediaIsTokenScalar(scalar.value) { return nil }
  }
  return token
}

/// [A-Za-z0-9_-]
private func mediaIsTokenScalar(_ v: UInt32) -> Bool {
  switch v {
  case 0x30...0x39, 0x41...0x5A, 0x61...0x7A, 0x2D, 0x5F:
    return true
  default:
    return false
  }
}

/// One `bytes=` range. Malformed or non-bytes values are ignored (full 200), as RFC 9110 allows;
/// several ranges also get the full file.
private func mediaParseRange(_ value: String, size: UInt64) -> MediaRangeResult {
  let v = value.trimmingCharacters(in: .whitespaces)
  guard v.lowercased().hasPrefix("bytes=") else { return .full }
  let spec = String(v.dropFirst(6)).trimmingCharacters(in: .whitespaces)
  if spec.contains(",") { return .full }
  let halves = spec.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
  guard halves.count == 2 else { return .full }
  let first = halves[0].trimmingCharacters(in: .whitespaces)
  let second = halves[1].trimmingCharacters(in: .whitespaces)
  if first.isEmpty {
    // Suffix range: the last n bytes.
    guard let n = UInt64(second) else { return .full }
    if n == 0 || size == 0 { return .unsatisfiable }
    let start = n >= size ? 0 : size - n
    return .partial(start: start, end: size - 1)
  }
  guard let start = UInt64(first) else { return .full }
  var end: UInt64 = size == 0 ? 0 : size - 1
  if !second.isEmpty {
    guard let e = UInt64(second) else { return .full }
    if e < start { return .full }
    end = e
  }
  if start >= size { return .unsatisfiable }
  if end > size - 1 { end = size - 1 }
  return .partial(start: start, end: end)
}

/// DLNA delivery headers. Unverified best practice for DLNA TVs (copied from common DLNA servers):
/// Streaming for video / audio, Interactive for images; OP=01 means byte seeking is supported.
private func mediaDlnaHeaders(streaming: Bool) -> [(String, String)] {
  let mode = streaming ? "Streaming" : "Interactive"
  let headers: [(String, String)] = [
    ("transferMode.dlna.org", mode),
    ("contentFeatures.dlna.org", "DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000"),
  ]
  return headers
}

private func mediaResponseHead(status: Int, reason: String, headers: [(String, String)]) -> Data {
  var text = "HTTP/1.1 \(status) \(reason)\r\n"
  for (name, value) in headers {
    text += "\(name): \(value)\r\n"
  }
  text += "\r\n"
  return Data(text.utf8)
}
