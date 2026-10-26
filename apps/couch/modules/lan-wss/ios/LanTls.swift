import ExpoModulesCore
import Foundation
import Network
import Security

#if COUCH_NO_GOOGLE_CAST
// Google Cast switched off (oversight D147-1): src/core/cast/googleCast/switch.ts has
// GOOGLE_CAST_ON = false, so LanWss.podspec sets COUCH_NO_GOOGLE_CAST and only this stub compiles.
// The JS side never calls it then; if it did, connect rejects and the Cast tab uses DLNA/AirPlay/demo.
final class LanTlsClient {
  init(module: LanWssModule) {}

  func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) {
    promise.reject("ERR_LAN_TLS_OFF", "Google Cast is switched off in this build.")
  }

  func write(id: String, base64: String) -> Bool {
    return false
  }

  func close(id: String) {}

  func closeAll() {}
}
#else

/**
 * lan-wss TLS socket (T106): a raw TCP + TLS connection for Google Cast (CASTV2 on port 8009).
 *
 * Connects ONLY to literal RFC 1918 IPv4 hosts (lanWssIsRfc1918Host, same rule as
 * src/core/lanHost.ts); any other host is rejected before a connection is attempted. Cast devices
 * present a self-signed certificate, so the TLS verify block accepts the server's certificate, and
 * it does so only after checking again that the host is RFC 1918. Bytes cross to JS as base64
 * (events onTlsData { id, base64 } and onTlsClose { id, message }).
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.
 */
private final class LanTlsConnection {
  let id: String
  let connection: NWConnection
  var connectPromise: Promise?
  var opened = false
  var finished = false

  init(id: String, connection: NWConnection, connectPromise: Promise) {
    self.id = id
    self.connection = connection
    self.connectPromise = connectPromise
  }
}

final class LanTlsClient {
  private weak var module: LanWssModule?
  private let lock = NSLock()
  private var byId: [String: LanTlsConnection] = [:]
  private let queue = DispatchQueue(label: "couch.lanwss.tls")

  init(module: LanWssModule) {
    self.module = module
  }

  // MARK: - API

  func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) {
    // Only literal RFC 1918 IPv4 hosts: the relaxed certificate rule below depends on it.
    guard lanWssIsRfc1918Host(host) else {
      promise.reject("ERR_LAN_TLS_HOST", "Only local network IPv4 addresses are allowed.")
      return
    }
    guard port > 0, port <= 65535, let nwPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
      promise.reject("ERR_LAN_TLS_PORT", "Invalid port.")
      return
    }

    let allowedHost = host
    let tlsOptions = NWProtocolTLS.Options()
    sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions, { _, _, complete in
      // Self-signed device certificate: accepted only because the host is a literal RFC 1918
      // address (checked again here). No other host ever reaches this socket.
      complete(lanWssIsRfc1918Host(allowedHost))
    }, queue)

    let tcpOptions = NWProtocolTCP.Options()
    tcpOptions.connectionTimeout = max(1, Int((timeoutMs / 1000.0).rounded(.up)))
    let params = NWParameters(tls: tlsOptions, tcp: tcpOptions)
    let connection = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: params)
    let conn = LanTlsConnection(id: id, connection: connection, connectPromise: promise)

    lock.lock()
    if byId[id] != nil {
      lock.unlock()
      promise.reject("ERR_LAN_TLS_ID", "A socket with this id already exists.")
      return
    }
    byId[id] = conn
    lock.unlock()

    connection.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        self.markOpen(conn)
      case .waiting(let error):
        // Refused / unreachable: fail instead of waiting for the path to change.
        self.fail(conn, message: error.localizedDescription, code: "ERR_LAN_TLS_CONNECT")
      case .failed(let error):
        self.fail(conn, message: error.localizedDescription, code: "ERR_LAN_TLS_CONNECT")
      case .cancelled:
        self.fail(conn, message: "", code: "ERR_LAN_TLS_CONNECT")
      default:
        break
      }
    }
    connection.start(queue: queue)

    let ms = max(1, Int(timeoutMs))
    queue.asyncAfter(deadline: .now() + .milliseconds(ms)) { [weak self] in
      self?.timeoutIfPending(conn)
    }
  }

  func write(id: String, base64: String) -> Bool {
    lock.lock()
    let conn = byId[id]
    let usable = conn != nil && conn!.opened && !conn!.finished
    lock.unlock()
    guard usable, let c = conn, let data = Data(base64Encoded: base64) else { return false }
    c.connection.send(content: data, completion: .contentProcessed({ [weak self] error in
      if let error = error {
        self?.fail(c, message: error.localizedDescription, code: "ERR_LAN_TLS_CONNECT")
      }
    }))
    return true
  }

  func close(id: String) {
    lock.lock()
    let conn = byId[id]
    lock.unlock()
    if let c = conn {
      fail(c, message: "", code: "ERR_LAN_TLS_CONNECT")
    }
  }

  func closeAll() {
    lock.lock()
    let all = Array(byId.values)
    lock.unlock()
    for c in all { fail(c, message: "", code: "ERR_LAN_TLS_CONNECT") }
  }

  // MARK: - Internals

  private func markOpen(_ conn: LanTlsConnection) {
    lock.lock()
    if conn.finished || conn.opened {
      lock.unlock()
      return
    }
    conn.opened = true
    let pending = conn.connectPromise
    conn.connectPromise = nil
    lock.unlock()
    pending?.resolve(nil)
    receiveLoop(conn)
  }

  private func timeoutIfPending(_ conn: LanTlsConnection) {
    lock.lock()
    let pending = !conn.opened && !conn.finished
    lock.unlock()
    if pending {
      fail(conn, message: "The connection timed out.", code: "ERR_LAN_TLS_TIMEOUT")
    }
  }

  private func receiveLoop(_ conn: LanTlsConnection) {
    conn.connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
      guard let self = self else { return }
      if let data = data, !data.isEmpty {
        self.module?.emit("onTlsData", ["id": conn.id, "base64": data.base64EncodedString()])
      }
      if let error = error {
        self.fail(conn, message: error.localizedDescription, code: "ERR_LAN_TLS_CONNECT")
        return
      }
      if isComplete {
        self.fail(conn, message: "", code: "ERR_LAN_TLS_CONNECT")
        return
      }
      self.receiveLoop(conn)
    }
  }

  /// Rejects connect if still pending; otherwise emits onTlsClose (once). Cancels the connection.
  private func fail(_ conn: LanTlsConnection, message: String, code: String) {
    lock.lock()
    if conn.finished {
      lock.unlock()
      return
    }
    conn.finished = true
    let pending = conn.connectPromise
    conn.connectPromise = nil
    let wasOpen = conn.opened
    byId.removeValue(forKey: conn.id)
    lock.unlock()

    conn.connection.stateUpdateHandler = nil
    conn.connection.cancel()
    if !wasOpen {
      pending?.reject(code, message.isEmpty ? "The connection closed before it opened." : message)
      return
    }
    module?.emit("onTlsClose", ["id": conn.id, "message": message])
  }
}
#endif
