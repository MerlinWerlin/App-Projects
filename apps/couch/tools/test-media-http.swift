import Foundation
import Dispatch
// Only Expo promise plumbing is stubbed; the production Network/FileHandle server is compiled unchanged.
final class Promise {
  let callback: (Any?) -> Void
  init(_ callback: @escaping (Any?) -> Void) { self.callback = callback }
  func resolve(_ value: Any?) { callback(value) }
  func reject(_ code: String, _ message: String) { fatalError("Server rejected: \(code)") }
}
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}
let server = MediaHttpServer()
let ready = DispatchSemaphore(value: 0)
var served: [String: Any] = [:]
let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let file = directory.appendingPathComponent("movie sample.mp4")
let bytes = Data((0..<200013).map { UInt8($0 % 251) })
try bytes.write(to: file)
server.serve(uri: file.absoluteString, mime: "video/mp4", promise: Promise { value in
  served = value as! [String: Any]; ready.signal()
})
check(ready.wait(timeout: .now() + 15) == .success, "listener timeout")
let base = "http://127.0.0.1:\(served["port"] as! Int)"
let resource = "/\(served["token"] as! String).mp4"
let origin = "https://www.gstatic.com"
let config = URLSessionConfiguration.ephemeral
config.timeoutIntervalForRequest = 10
let session = URLSession(configuration: config)
func request(_ path: String, _ method: String = "GET", _ headers: [String: String] = [:]) -> (HTTPURLResponse, Data) {
  var req = URLRequest(url: URL(string: base + path)!); req.httpMethod = method
  req.setValue(origin, forHTTPHeaderField: "Origin")
  for (k,v) in headers { req.setValue(v, forHTTPHeaderField: k) }
  let done = DispatchSemaphore(value: 0)
  var result: (HTTPURLResponse, Data)?
  session.dataTask(with: req) { data, response, error in
    if let error = error as NSError? { fatalError("HTTP \(method) transport code \(error.code)") }
    result = (response as! HTTPURLResponse, data ?? Data()); done.signal()
  }.resume()
  check(done.wait(timeout: .now() + 15) == .success, "HTTP timeout")
  print("HTTP \(method) status \(result!.0.statusCode), bytes \(result!.1.count)"); fflush(stdout)
  return result!
}
let preflight = request(resource, "OPTIONS", ["Access-Control-Request-Method":"GET", "Access-Control-Request-Headers":"range", "Access-Control-Request-Private-Network":"true"])
check(preflight.0.statusCode == 204 && preflight.1.isEmpty, "preflight rejected")
check(preflight.0.value(forHTTPHeaderField:"Access-Control-Allow-Origin") == origin, "origin not echoed")
check(preflight.0.value(forHTTPHeaderField:"Access-Control-Allow-Private-Network") == "true", "private network preflight missing")
check(preflight.0.value(forHTTPHeaderField:"Access-Control-Allow-Headers")!.contains("Range"), "range permission missing")
let full = request(resource)
check(full.0.statusCode == 200 && full.1 == bytes, "full GET lost file bytes")
check(full.0.value(forHTTPHeaderField:"Access-Control-Allow-Origin") == origin, "GET CORS missing")
check(full.0.value(forHTTPHeaderField:"Content-Type") == "video/mp4", "MIME incorrect")
let partial = request(resource, "GET", ["Range":"bytes=65530-65550"])
check(partial.0.statusCode == 206 && partial.1 == bytes.subdata(in:65530..<65551), "range body incorrect")
check(partial.0.value(forHTTPHeaderField:"Content-Range") == "bytes 65530-65550/200013", "range header incorrect")
check(partial.0.value(forHTTPHeaderField:"Access-Control-Expose-Headers")!.contains("Content-Range"), "range header not exposed")
let head = request(resource,"HEAD")
check(head.0.statusCode == 200 && head.1.isEmpty, "HEAD returned body")
check(head.0.value(forHTTPHeaderField:"Content-Length") == String(bytes.count), "HEAD size incorrect")
let bad = request(resource,"GET",["Range":"bytes=999999-"])
check(bad.0.statusCode == 416, "invalid range not rejected")
check(bad.0.value(forHTTPHeaderField:"Access-Control-Allow-Origin") == origin, "range error CORS missing")
check(request("/not-a-token","OPTIONS").0.statusCode == 404, "preflight bypassed token")
check(request(resource,"POST").0.statusCode == 405, "write accepted")
let stopped = DispatchSemaphore(value:0)
server.stop(id:served["id"] as! String) { stopped.signal() }
check(stopped.wait(timeout:.now()+10) == .success, "stop timeout")
check(request(resource).0.statusCode == 404, "revoked file still served")
server.stopAll(completion:nil); session.invalidateAndCancel()
try FileManager.default.removeItem(at:directory)
print("PASS production Swift HTTP: preflight,CORS,full multi-chunk bytes,Range,HEAD,token checks andrevocation")
