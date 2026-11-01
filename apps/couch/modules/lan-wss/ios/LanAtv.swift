import ExpoModulesCore
import Foundation
import Network
import Security

#if COUCH_NO_ANDROIDTV_TLS
// Google TV remote switched off: src/core/drivers/androidtv/switch.ts has ANDROIDTV_NATIVE_ON = false,
// so LanWss.podspec sets COUCH_NO_ANDROIDTV_TLS and only this stub compiles. The JS side never calls
// it then (src/native/androidTvTls.ts checks the same switch); if it did, every call fails cleanly.
final class LanAtvClient {
  init(module: LanWssModule) {}

  func key(promise: Promise) {
    promise.reject("ERR_ATV_OFF", "The Google TV remote is switched off in this build.")
  }

  func sign(dataBase64: String, promise: Promise) {
    promise.reject("ERR_ATV_OFF", "The Google TV remote is switched off in this build.")
  }

  func setCertificate(certBase64: String, promise: Promise) {
    promise.reject("ERR_ATV_OFF", "The Google TV remote is switched off in this build.")
  }

  func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) {
    promise.reject("ERR_ATV_OFF", "The Google TV remote is switched off in this build.")
  }

  func write(id: String, base64: String) -> Bool {
    return false
  }

  func close(id: String) {}

  func closeAll() {}
}
#else

/**
 * lan-wss Google TV remote (Android TV Remote v2): this phone's client identity and a mutual-TLS
 * socket that presents it (pairing on :6467, remote on :6466).
 *
 * Identity: an RSA-2048 key pair generated once with SecKeyCreateRandomKey and kept in the Keychain
 * (permanent, tag "app.couch.atv.client.key", this device only). The private key never leaves the
 * Keychain. The self-signed X.509 certificate is built by JS (src/core/drivers/androidtv/x509.ts);
 * atvSign signs its TBSCertificate here, and atvSetCertificate stores the finished certificate under
 * the label "Couch Android TV client", which lets the Keychain pair it with the key as a SecIdentity.
 *
 * Socket: connects ONLY to literal RFC 1918 IPv4 hosts (lanWssIsRfc1918Host, same rule as
 * src/core/lanHost.ts); any other host is rejected before a connection is attempted. The TV
 * presents a self-signed certificate, so the TLS verify block accepts it, only after checking again
 * that the host is RFC 1918 (trust comes from the pairing hash, not the chain). The verify block
 * also records the TV certificate's RSA public key (PKCS#1 DER) for the pairing hash; atvConnect
 * resolves with it. Bytes cross to JS as base64 on the shared events onTlsData { id, base64 } and
 * onTlsClose { id, message } (ids are unique per socket).
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.
 */

private let atvKeyTag = Data("app.couch.atv.client.key".utf8)
private let atvKeyLabel = "Couch Android TV key"
private let atvCertLabel = "Couch Android TV client"

/// TLS alerts that mean "the TV did not accept our client certificate" during the handshake:
/// errSSLPeerHandshakeFail, BadCert, UnsupportedCert, CertRevoked, CertExpired, CertUnknown,
/// UnknownCA, AccessDenied, and errSSLCertificateRequired (TLS 1.3).
private let atvAuthStatuses: Set<Int32> = [-9824, -9825, -9826, -9827, -9828, -9829, -9831, -9832, -9863]

private struct AtvError: Error {
  let message: String
}

private func atvErrorText(_ error: Unmanaged<CFError>?, _ fallback: String) -> String {
  guard let e = error?.takeRetainedValue() else { return fallback }
  return CFErrorCopyDescription(e) as String
}

// MARK: - Keychain

private func atvLoadPrivateKey() -> SecKey? {
  let query: [String: Any] = [
    kSecClass as String: kSecClassKey,
    kSecAttrApplicationTag as String: atvKeyTag,
    kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
    kSecAttrKeyClass as String: kSecAttrKeyClassPrivate,
    kSecReturnRef as String: true,
  ]
  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)
  guard status == errSecSuccess, let found = item else { return nil }
  return (found as! SecKey)
}

private func atvCreatePrivateKey() throws -> SecKey {
  let privateAttrs: [String: Any] = [
    kSecAttrIsPermanent as String: true,
    kSecAttrApplicationTag as String: atvKeyTag,
    kSecAttrLabel as String: atvKeyLabel,
    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
  ]
  let attrs: [String: Any] = [
    kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
    kSecAttrKeySizeInBits as String: 2048,
    kSecPrivateKeyAttrs as String: privateAttrs,
  ]
  var error: Unmanaged<CFError>?
  guard let key = SecKeyCreateRandomKey(attrs as CFDictionary, &error) else {
    throw AtvError(message: atvErrorText(error, "Could not create the key."))
  }
  return key
}

/// PKCS#1 RSAPublicKey DER of a key's public half.
private func atvPublicKeyData(_ key: SecKey) -> Data? {
  guard let pub = SecKeyCopyPublicKey(key) else { return nil }
  var error: Unmanaged<CFError>?
  guard let data = SecKeyCopyExternalRepresentation(pub, &error) as Data? else { return nil }
  return data
}

private func atvLoadCertificateData() -> Data? {
  let query: [String: Any] = [
    kSecClass as String: kSecClassCertificate,
    kSecAttrLabel as String: atvCertLabel,
    kSecReturnData as String: true,
  ]
  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)
  guard status == errSecSuccess, let data = item as? Data else { return nil }
  return data
}

/// The Keychain identity whose certificate is exactly our stored client certificate.
private func atvLoadIdentity() -> SecIdentity? {
  guard let certData = atvLoadCertificateData() else { return nil }
  let query: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecReturnRef as String: true,
    kSecMatchLimit as String: kSecMatchLimitAll,
  ]
  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)
  guard status == errSecSuccess, let found = item else { return nil }
  var identities: [SecIdentity] = []
  if let list = found as? [SecIdentity] {
    identities = list
  } else if CFGetTypeID(found) == SecIdentityGetTypeID() {
    identities = [found as! SecIdentity]
  }
  for identity in identities {
    var cert: SecCertificate?
    guard SecIdentityCopyCertificate(identity, &cert) == errSecSuccess, let c = cert else { continue }
    if (SecCertificateCopyData(c) as Data) == certData { return identity }
  }
  return nil
}

/// RSA public key (PKCS#1 DER) of the leaf certificate the TV presented.
private func atvPeerKeyData(_ trust: sec_trust_t) -> Data? {
  let secTrust = sec_trust_copy_ref(trust).takeRetainedValue()
  guard let chain = SecTrustCopyCertificateChain(secTrust) as? [SecCertificate], let leaf = chain.first else { return nil }
  guard let key = SecCertificateCopyKey(leaf) else { return nil }
  var error: Unmanaged<CFError>?
  guard let data = SecKeyCopyExternalRepresentation(key, &error) as Data? else { return nil }
  return data
}

// MARK: - Sockets

/// Written by the TLS verify block (on the socket queue), read when the connection is ready.
private final class AtvPeerBox {
  var keyData: Data?
}

private final class LanAtvConnection {
  let id: String
  let connection: NWConnection
  let peer: AtvPeerBox
  var connectPromise: Promise?
  var opened = false
  var finished = false

  init(id: String, connection: NWConnection, peer: AtvPeerBox, connectPromise: Promise) {
    self.id = id
    self.connection = connection
    self.peer = peer
    self.connectPromise = connectPromise
  }
}

final class LanAtvClient {
  private weak var module: LanWssModule?
  private let lock = NSLock()
  private var byId: [String: LanAtvConnection] = [:]
  private let queue = DispatchQueue(label: "couch.lanwss.atv")
  /// Serialises Keychain work so two first calls never create two keys.
  private let keychainQueue = DispatchQueue(label: "couch.lanwss.atv.keychain")

  init(module: LanWssModule) {
    self.module = module
  }

  // MARK: - Identity API

  /// { publicKeyBase64 (PKCS#1 DER), certBase64 (DER, or "" when no certificate is stored or the
  /// Keychain does not pair it with the key as an identity: JS then makes and stores a new one) }.
  func key(promise: Promise) {
    keychainQueue.async {
      do {
        let privateKey: SecKey
        if let existing = atvLoadPrivateKey() {
          privateKey = existing
        } else {
          privateKey = try atvCreatePrivateKey()
        }
        guard let pub = atvPublicKeyData(privateKey) else {
          promise.reject("ERR_ATV_KEY", "Could not read the public key.")
          return
        }
        let usable = atvLoadIdentity() != nil
        let cert = usable ? (atvLoadCertificateData()?.base64EncodedString() ?? "") : ""
        promise.resolve(["publicKeyBase64": pub.base64EncodedString(), "certBase64": cert])
      } catch let e as AtvError {
        promise.reject("ERR_ATV_KEY", e.message)
      } catch {
        promise.reject("ERR_ATV_KEY", error.localizedDescription)
      }
    }
  }

  /// RSA PKCS#1 v1.5 + SHA-256 signature of the bytes, base64.
  func sign(dataBase64: String, promise: Promise) {
    keychainQueue.async {
      guard let data = Data(base64Encoded: dataBase64) else {
        promise.reject("ERR_ATV_SIGN", "Invalid data.")
        return
      }
      guard let privateKey = atvLoadPrivateKey() else {
        promise.reject("ERR_ATV_SIGN", "No key yet.")
        return
      }
      var error: Unmanaged<CFError>?
      guard let signature = SecKeyCreateSignature(privateKey, .rsaSignatureMessagePKCS1v15SHA256, data as CFData, &error) as Data? else {
        promise.reject("ERR_ATV_SIGN", atvErrorText(error, "Could not sign."))
        return
      }
      promise.resolve(signature.base64EncodedString())
    }
  }

  /// Stores the certificate (must be for our key), replacing an older one. Resolves whether the
  /// Keychain now forms the identity.
  func setCertificate(certBase64: String, promise: Promise) {
    keychainQueue.async {
      guard let data = Data(base64Encoded: certBase64),
            let cert = SecCertificateCreateWithData(nil, data as CFData) else {
        promise.reject("ERR_ATV_CERT", "Invalid certificate.")
        return
      }
      guard let privateKey = atvLoadPrivateKey(), let ours = atvPublicKeyData(privateKey) else {
        promise.reject("ERR_ATV_CERT", "No key yet.")
        return
      }
      var keyError: Unmanaged<CFError>?
      guard let certKey = SecCertificateCopyKey(cert),
            let certKeyData = SecKeyCopyExternalRepresentation(certKey, &keyError) as Data?,
            certKeyData == ours else {
        promise.reject("ERR_ATV_CERT", "The certificate is not for this key.")
        return
      }
      let old: [String: Any] = [
        kSecClass as String: kSecClassCertificate,
        kSecAttrLabel as String: atvCertLabel,
      ]
      SecItemDelete(old as CFDictionary)
      let add: [String: Any] = [
        kSecClass as String: kSecClassCertificate,
        kSecValueRef as String: cert,
        kSecAttrLabel as String: atvCertLabel,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      ]
      let status = SecItemAdd(add as CFDictionary, nil)
      guard status == errSecSuccess || status == errSecDuplicateItem else {
        promise.reject("ERR_ATV_CERT", "Could not store the certificate (\(status)).")
        return
      }
      promise.resolve(atvLoadIdentity() != nil)
    }
  }

  // MARK: - Socket API

  func connect(id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) {
    // Only literal RFC 1918 IPv4 hosts: the relaxed certificate rule below depends on it.
    guard lanWssIsRfc1918Host(host) else {
      promise.reject("ERR_ATV_TLS_HOST", "Only local network IPv4 addresses are allowed.")
      return
    }
    guard port > 0, port <= 65535, let nwPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
      promise.reject("ERR_ATV_TLS_PORT", "Invalid port.")
      return
    }
    let identity: SecIdentity? = keychainQueue.sync { atvLoadIdentity() }
    guard let secIdentity = identity, let localIdentity = sec_identity_create(secIdentity) else {
      promise.reject("ERR_ATV_TLS_IDENTITY", "This phone has no Google TV pairing identity yet.")
      return
    }

    let allowedHost = host
    let peer = AtvPeerBox()
    let tlsOptions = NWProtocolTLS.Options()
    sec_protocol_options_set_local_identity(tlsOptions.securityProtocolOptions, localIdentity)
    sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions, { _, trust, complete in
      // Keep the TV's public key for the pairing hash (runs on `queue`, before .ready).
      peer.keyData = atvPeerKeyData(trust)
      // Self-signed TV certificate: accepted only because the host is a literal RFC 1918
      // address (checked again here). No other host ever reaches this socket.
      complete(lanWssIsRfc1918Host(allowedHost))
    }, queue)

    let tcpOptions = NWProtocolTCP.Options()
    tcpOptions.connectionTimeout = max(1, Int((timeoutMs / 1000.0).rounded(.up)))
    let params = NWParameters(tls: tlsOptions, tcp: tcpOptions)
    let connection = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: params)
    let conn = LanAtvConnection(id: id, connection: connection, peer: peer, connectPromise: promise)

    lock.lock()
    if byId[id] != nil {
      lock.unlock()
      promise.reject("ERR_ATV_TLS_ID", "A socket with this id already exists.")
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
        self.fail(conn, message: error.localizedDescription, code: self.errorCode(error))
      case .failed(let error):
        self.fail(conn, message: error.localizedDescription, code: self.errorCode(error))
      case .cancelled:
        self.fail(conn, message: "", code: "ERR_ATV_TLS_CONNECT")
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
        self?.fail(c, message: error.localizedDescription, code: "ERR_ATV_TLS_CONNECT")
      }
    }))
    return true
  }

  func close(id: String) {
    lock.lock()
    let conn = byId[id]
    lock.unlock()
    if let c = conn {
      fail(c, message: "", code: "ERR_ATV_TLS_CONNECT")
    }
  }

  func closeAll() {
    lock.lock()
    let all = Array(byId.values)
    lock.unlock()
    for c in all { fail(c, message: "", code: "ERR_ATV_TLS_CONNECT") }
  }

  // MARK: - Internals

  private func errorCode(_ error: NWError) -> String {
    if case .tls(let status) = error, atvAuthStatuses.contains(Int32(status)) {
      return "ERR_ATV_TLS_AUTH"
    }
    return "ERR_ATV_TLS_CONNECT"
  }

  private func markOpen(_ conn: LanAtvConnection) {
    lock.lock()
    if conn.finished || conn.opened {
      lock.unlock()
      return
    }
    conn.opened = true
    let pending = conn.connectPromise
    conn.connectPromise = nil
    lock.unlock()
    // The verify block ran on `queue` before .ready (also on `queue`), so keyData is set by now.
    let peerKey = conn.peer.keyData?.base64EncodedString() ?? ""
    pending?.resolve(["peerKeyBase64": peerKey])
    receiveLoop(conn)
  }

  private func timeoutIfPending(_ conn: LanAtvConnection) {
    lock.lock()
    let pending = !conn.opened && !conn.finished
    lock.unlock()
    if pending {
      fail(conn, message: "The connection timed out.", code: "ERR_ATV_TLS_TIMEOUT")
    }
  }

  private func receiveLoop(_ conn: LanAtvConnection) {
    conn.connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
      guard let self = self else { return }
      if let data = data, !data.isEmpty {
        self.module?.emit("onTlsData", ["id": conn.id, "base64": data.base64EncodedString()])
      }
      if let error = error {
        self.fail(conn, message: error.localizedDescription, code: "ERR_ATV_TLS_CONNECT")
        return
      }
      if isComplete {
        self.fail(conn, message: "", code: "ERR_ATV_TLS_CONNECT")
        return
      }
      self.receiveLoop(conn)
    }
  }

  /// Rejects connect if still pending; otherwise emits onTlsClose (once). Cancels the connection.
  private func fail(_ conn: LanAtvConnection, message: String, code: String) {
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
