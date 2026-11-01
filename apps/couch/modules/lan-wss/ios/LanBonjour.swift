import ExpoModulesCore
import Foundation
import Network

#if COUCH_NO_BONJOUR
// Bonjour switched off: src/core/bonjour/switch.ts has BONJOUR_NATIVE_ON = false, so LanWss.podspec
// sets COUCH_NO_BONJOUR and only this stub compiles. The JS side never calls it then
// (src/native/bonjour.ts checks the same switch); if it did, browse starts nothing and resolve is null.
final class LanBonjourClient {
  init(module: LanWssModule) {}

  func browse(id: String, types: [String], timeoutMs: Double) -> Bool {
    return false
  }

  func stop(id: String) {}

  func resolve(type: String, name: String, timeoutMs: Double, promise: Promise) {
    promise.resolve(nil)
  }

  func stopAll() {}
}
#else
// Bonjour (DNS-SD) browsing with Network.framework. iOS allows NWBrowser without the multicast
// entitlement for service types listed in NSBonjourServices (app.json); the local-network prompt
// (NSLocalNetworkUsageDescription) gates it. All state lives on one private serial queue.
//
// UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.

private let lanBonjourMaxTypes = 16
private let lanBonjourMaxTxtEntries = 64
private let lanBonjourMaxTxtKey = 64
private let lanBonjourMaxTxtValue = 512

/// "_googlecast._tcp" (optionally with a trailing "." or ".local."), or nil for anything else.
func lanBonjourNormaliseType(_ raw: String) -> String? {
  var t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
  while t.hasSuffix(".") { t.removeLast() }
  if t.lowercased().hasSuffix(".local") { t = String(t.dropLast(6)) }
  while t.hasSuffix(".") { t.removeLast() }
  let parts = t.split(separator: ".", omittingEmptySubsequences: false)
  guard parts.count == 2 else { return nil }
  let service = parts[0]
  let proto = parts[1].lowercased()
  guard service.hasPrefix("_"), service.count >= 2, service.count <= 64 else { return nil }
  guard service.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }) else { return nil }
  guard proto == "_tcp" || proto == "_udp" else { return nil }
  return "\(service).\(proto)"
}

/// Copies TXT entries into a bounded [String: String]; never throws on odd data.
private func lanBonjourTxt(_ metadata: NWBrowser.Result.Metadata) -> [String: String] {
  var out: [String: String] = [:]
  guard case let .bonjour(record) = metadata else { return out }
  for (key, value) in record.dictionary {
    if out.count >= lanBonjourMaxTxtEntries { break }
    if key.isEmpty || key.count > lanBonjourMaxTxtKey { continue }
    out[key] = value.count > lanBonjourMaxTxtValue ? String(value.prefix(lanBonjourMaxTxtValue)) : value
  }
  return out
}

/// Dotted quad from the 4 raw bytes (no interface scope suffix).
private func lanBonjourIpv4String(_ address: IPv4Address) -> String? {
  let bytes = [UInt8](address.rawValue)
  guard bytes.count == 4 else { return nil }
  return bytes.map { String($0) }.joined(separator: ".")
}

private final class LanBonjourSession {
  let id: String
  var browsers: [NWBrowser] = []
  /// "type\nname" -> TXT last emitted, so each service is emitted once (again only if its TXT changes).
  var emitted: [String: [String: String]] = [:]

  init(id: String) {
    self.id = id
  }
}

private final class LanBonjourResolve {
  let promise: Promise
  var connection: NWConnection?
  var done = false

  init(promise: Promise) {
    self.promise = promise
  }
}

final class LanBonjourClient {
  private weak var module: LanWssModule?
  private let queue = DispatchQueue(label: "couch.lanwss.bonjour")
  private var sessions: [String: LanBonjourSession] = [:]

  init(module: LanWssModule) {
    self.module = module
  }

  // MARK: - Browse

  /// Starts one NWBrowser per valid type; false when no type is valid. Stops itself after timeoutMs.
  func browse(id: String, types: [String], timeoutMs: Double) -> Bool {
    var valid: [String] = []
    for raw in types {
      if valid.count >= lanBonjourMaxTypes { break }
      if let t = lanBonjourNormaliseType(raw), !valid.contains(t) { valid.append(t) }
    }
    guard !id.isEmpty, !valid.isEmpty else { return false }
    let ms = timeoutMs.isFinite ? Int(max(500, min(60000, timeoutMs))) : 10000

    queue.async {
      self.stopOnQueue(id: id)
      let session = LanBonjourSession(id: id)
      self.sessions[id] = session
      for type in valid {
        let descriptor = NWBrowser.Descriptor.bonjourWithTXTRecord(type: type, domain: "local.")
        let params = NWParameters()
        params.includePeerToPeer = false
        let browser = NWBrowser(for: descriptor, using: params)
        // .waiting (e.g. local network access not granted yet) keeps going; .failed ends this browser.
        browser.stateUpdateHandler = { [weak browser] state in
          if case .failed(_) = state {
            browser?.cancel()
          }
        }
        browser.browseResultsChangedHandler = { [weak self] results, _ in
          self?.handle(sessionId: id, type: type, results: results)
        }
        session.browsers.append(browser)
        browser.start(queue: self.queue)
      }
      self.queue.asyncAfter(deadline: .now() + .milliseconds(ms)) { [weak self, weak session] in
        guard let self = self, let session = session else { return }
        // Only stop the session this timer was set for (the id may have been reused since).
        if self.sessions[id] === session { self.stopOnQueue(id: id) }
      }
    }
    return true
  }

  func stop(id: String) {
    queue.async { self.stopOnQueue(id: id) }
  }

  func stopAll() {
    queue.async {
      for id in Array(self.sessions.keys) { self.stopOnQueue(id: id) }
    }
  }

  private func stopOnQueue(id: String) {
    guard let session = sessions.removeValue(forKey: id) else { return }
    for browser in session.browsers {
      browser.browseResultsChangedHandler = nil
      browser.stateUpdateHandler = nil
      browser.cancel()
    }
    session.browsers.removeAll()
  }

  /// Runs on `queue` (the browsers were started on it).
  private func handle(sessionId: String, type: String, results: Set<NWBrowser.Result>) {
    guard let session = sessions[sessionId] else { return }
    for result in results {
      guard case let .service(name, _, _, _) = result.endpoint else { continue }
      if name.isEmpty || name.count > 255 { continue }
      let txt = lanBonjourTxt(result.metadata)
      let key = type + "\n" + name
      if let previous = session.emitted[key], previous == txt { continue }
      session.emitted[key] = txt
      module?.emit("onBonjourService", ["id": sessionId, "type": type, "name": name, "txt": txt])
    }
  }

  // MARK: - Resolve

  /// Resolves a service to {host, port} with an IPv4 host, or nil on timeout / failure / IPv6 only.
  func resolve(type: String, name: String, timeoutMs: Double, promise: Promise) {
    guard let t = lanBonjourNormaliseType(type), !name.isEmpty, name.count <= 255 else {
      promise.resolve(nil)
      return
    }
    let ms = timeoutMs.isFinite ? Int(max(250, min(15000, timeoutMs))) : 3000

    queue.async {
      let job = LanBonjourResolve(promise: promise)
      let endpoint = NWEndpoint.service(name: name, type: t, domain: "local.", interface: nil)
      let params = NWParameters.tcp
      params.includePeerToPeer = false
      if let ip = params.defaultProtocolStack.internetProtocol as? NWProtocolIP.Options {
        ip.version = .v4
      }
      let connection = NWConnection(to: endpoint, using: params)
      job.connection = connection
      connection.stateUpdateHandler = { [weak self, weak connection] state in
        guard let self = self else { return }
        switch state {
        case .ready:
          var found: [String: Any]? = nil
          if let remote = connection?.currentPath?.remoteEndpoint,
             case let .hostPort(host, port) = remote,
             case let .ipv4(address) = host,
             let text = lanBonjourIpv4String(address) {
            found = ["host": text, "port": Int(port.rawValue)]
          }
          self.finish(job, found)
        case .failed(_), .cancelled:
          self.finish(job, nil)
        default:
          break
        }
      }
      connection.start(queue: self.queue)
      self.queue.asyncAfter(deadline: .now() + .milliseconds(ms)) { [weak self] in
        self?.finish(job, nil)
      }
    }
  }

  /// Runs on `queue`. Resolves the promise once and cancels the probe connection.
  private func finish(_ job: LanBonjourResolve, _ found: [String: Any]?) {
    if job.done { return }
    job.done = true
    let connection = job.connection
    job.connection = nil
    connection?.stateUpdateHandler = nil
    connection?.cancel()
    job.promise.resolve(found)
  }
}
#endif
