import ExpoModulesCore
import Foundation

/**
 * lan-wss fetch: one HTTP(S) request to a TV on the home network (URLSession dataTask).
 *
 * A self-signed server certificate is accepted ONLY when the caller asked for it
 * (allowSelfSignedLan) AND the URL is https:// AND its host is a literal RFC 1918 IPv4 address AND
 * the trust challenge is for that exact host. Relaxed tasks never follow redirects. Everything else
 * gets default certificate validation. Same rule as LanWssModule.swift / src/core/lanHost.ts.
 *
 * The session has no credential store, cache or cookies, so a 401 (e.g. Philips Digest) is handed
 * back to JS with its WWW-Authenticate header instead of being answered by the system.
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.
 */
/// Holds the task id for the completion handler (a captured `var` is an error in @Sendable closures).
private final class LanFetchTaskId {
  var value = -1
}

private final class LanFetchTaskInfo {
  /// Host the relaxed trust rule may apply to; nil unless allowed (see file comment).
  let relaxedTrustHost: String?
  init(relaxedTrustHost: String?) {
    self.relaxedTrustHost = relaxedTrustHost
  }
}

final class LanFetchClient: NSObject, URLSessionTaskDelegate {
  private let lock = NSLock()
  private var byTask: [Int: LanFetchTaskInfo] = [:]
  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.urlCredentialStorage = nil
    config.urlCache = nil
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.httpCookieStorage = nil
    config.httpShouldSetCookies = false
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: config, delegate: self, delegateQueue: queue)
  }()

  func fetch(
    urlString: String,
    method: String,
    headersJson: String,
    body: String?,
    timeoutMs: Double,
    allowSelfSignedLan: Bool,
    promise: Promise
  ) {
    guard let url = URL(string: urlString),
          let scheme = url.scheme?.lowercased(),
          scheme == "http" || scheme == "https",
          let host = url.host else {
      promise.reject("ERR_LAN_FETCH_URL", "Invalid HTTP URL.")
      return
    }

    var relaxedHost: String? = nil
    if allowSelfSignedLan && scheme == "https" && lanWssIsRfc1918Host(host) {
      relaxedHost = host
    }

    var request = URLRequest(url: url)
    request.httpMethod = method.isEmpty ? "GET" : method.uppercased()
    request.timeoutInterval = timeoutMs > 0 ? timeoutMs / 1000.0 : 10.0
    if let data = headersJson.data(using: .utf8),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      for (name, value) in obj {
        if let v = value as? String { request.setValue(v, forHTTPHeaderField: name) }
      }
    }
    if let body = body {
      request.httpBody = body.data(using: .utf8)
    }

    let taskId = LanFetchTaskId()
    let task = session.dataTask(with: request) { [weak self] data, response, error in
      self?.forget(taskId.value)
      if let error = error {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorTimedOut {
          promise.reject("ERR_LAN_FETCH_TIMEOUT", "The request timed out.")
        } else {
          promise.reject("ERR_LAN_FETCH", error.localizedDescription)
        }
        return
      }
      guard let http = response as? HTTPURLResponse else {
        promise.reject("ERR_LAN_FETCH", "No HTTP response.")
        return
      }
      var headers: [String: String] = [:]
      for (k, v) in http.allHeaderFields {
        headers[String(describing: k).lowercased()] = String(describing: v)
      }
      let headersOut = (try? JSONSerialization.data(withJSONObject: headers))
        .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
      let bytes = data ?? Data()
      let text = String(data: bytes, encoding: .utf8) ?? String(decoding: bytes, as: UTF8.self)
      let result: [String: Any] = ["status": http.statusCode, "headersJson": headersOut, "body": text]
      promise.resolve(result)
    }
    taskId.value = task.taskIdentifier

    lock.lock()
    byTask[task.taskIdentifier] = LanFetchTaskInfo(relaxedTrustHost: relaxedHost)
    lock.unlock()
    task.resume()
  }

  func cancelAll() {
    session.invalidateAndCancel()
  }

  private func info(for task: URLSessionTask) -> LanFetchTaskInfo? {
    lock.lock()
    defer { lock.unlock() }
    return byTask[task.taskIdentifier]
  }

  private func forget(_ taskId: Int) {
    lock.lock()
    byTask.removeValue(forKey: taskId)
    lock.unlock()
  }

  // MARK: - URLSessionTaskDelegate

  // Relaxed-trust tasks never follow redirects (the TV APIs do not redirect).
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    if info(for: task)?.relaxedTrustHost != nil {
      completionHandler(nil)
    } else {
      completionHandler(request)
    }
  }

  // Task-level trust challenge (no session-level method, so URLSession routes server trust here).
  // Non-server-trust challenges (HTTP Basic/Digest) get default handling; with no credential
  // storage the 401 response is delivered to JS.
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          let trust = space.serverTrust,
          let taskInfo = info(for: task),
          let allowedHost = taskInfo.relaxedTrustHost,      // only set when allowSelfSignedLan was requested
          let urlHost = task.originalRequest?.url?.host,
          space.host == allowedHost,
          urlHost == allowedHost,
          lanWssIsRfc1918Host(space.host) else {
      completionHandler(.performDefaultHandling, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }
}
