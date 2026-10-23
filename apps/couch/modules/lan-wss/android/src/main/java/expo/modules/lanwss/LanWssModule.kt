package expo.modules.lanwss

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.io.IOException
import java.io.InterruptedIOException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * lan-wss: a minimal WebSocket client for TVs on the home network (OkHttp).
 *
 * A self-signed server certificate is accepted ONLY when the caller asked for it
 * (allowSelfSignedLan) AND the URL is wss:// AND its host is a literal RFC 1918 IPv4 address.
 * Such a connection gets its own client whose trust manager accepts the presented chain and whose
 * HostnameVerifier passes only that exact host, with redirects disabled. Every other URL uses the
 * default client (normal certificate validation). The RFC 1918 rule mirrors src/core/lanHost.ts
 * (isRfc1918Host); keep them in sync.
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.
 */
class LanWssModule : Module() {
  private class Conn(val id: String) {
    @Volatile var ws: WebSocket? = null
    @Volatile var opened = false
    val finished = AtomicBoolean(false)
  }

  private val sockets = ConcurrentHashMap<String, Conn>()
  private val calls = ConcurrentHashMap<Call, Boolean>()

  private val defaultClient: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .build()
  }

  override fun definition() = ModuleDefinition {
    Name("LanWss")

    Events("onMessage", "onClose", "onError")

    AsyncFunction("connect") { id: String, url: String, allowSelfSignedLan: Boolean, promise: Promise ->
      connect(id, url, allowSelfSignedLan, promise)
    }

    Function("send") { id: String, data: String ->
      val conn = sockets[id]
      val ws = conn?.ws
      if (conn == null || ws == null || !conn.opened || conn.finished.get()) false else ws.send(data)
    }

    Function("close") { id: String ->
      sockets[id]?.ws?.close(1000, null)
      Unit
    }

    // One HTTP(S) request; same RFC 1918-only relaxed client rule as connect (https:// only).
    AsyncFunction("fetch") { url: String, method: String, headersJson: String, body: String?, timeoutMs: Double, allowSelfSignedLan: Boolean, promise: Promise ->
      fetch(url, method, headersJson, body, timeoutMs, allowSelfSignedLan, promise)
    }

    OnDestroy {
      for (call in calls.keys) call.cancel()
      calls.clear()
      for (conn in sockets.values) conn.ws?.cancel()
      sockets.clear()
    }
  }

  private fun connect(id: String, url: String, allowSelfSignedLan: Boolean, promise: Promise) {
    val request = try {
      Request.Builder().url(url).build() // OkHttp maps ws:// / wss:// to http:// / https://
    } catch (e: IllegalArgumentException) {
      promise.reject("ERR_LAN_WSS_URL", "Invalid WebSocket URL.", e)
      return
    }
    val isWss = url.regionMatches(0, "wss://", 0, 6, ignoreCase = true)
    val rawHost = rawUrlHost(url)
    val parsedHost = request.url.host

    // Relaxed trust only when explicitly requested, over wss, and the literal host is RFC 1918.
    val relaxedHost: String? =
      if (allowSelfSignedLan && isWss && rawHost != null && rawHost == parsedHost && isRfc1918Host(rawHost)) {
        rawHost
      } else {
        null
      }
    val client = if (relaxedHost != null) relaxedClient(relaxedHost) else defaultClient

    val conn = Conn(id)
    if (sockets.putIfAbsent(id, conn) != null) {
      promise.reject("ERR_LAN_WSS_ID", "A socket with this id already exists.", null)
      return
    }

    val listener = object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        conn.opened = true
        promise.resolve(null)
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        sendEvent("onMessage", mapOf("id" to id, "data" to text))
      }

      override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
        // Binary frames are forwarded only when they are valid UTF-8.
        val text = decodeUtf8OrNull(bytes.toByteArray()) ?: return
        sendEvent("onMessage", mapOf("id" to id, "data" to text))
      }

      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(code, null)
      }

      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        if (!conn.finished.compareAndSet(false, true)) return
        sockets.remove(id, conn)
        if (!conn.opened) {
          promise.reject("ERR_LAN_WSS_CONNECT", "The connection closed before it opened.", null)
          return
        }
        sendEvent("onClose", mapOf("id" to id, "code" to code, "reason" to reason))
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        if (!conn.finished.compareAndSet(false, true)) return
        sockets.remove(id, conn)
        val message = t.message ?: "WebSocket connection failed."
        if (!conn.opened) {
          promise.reject("ERR_LAN_WSS_CONNECT", message, t)
          return
        }
        sendEvent("onError", mapOf("id" to id, "message" to message))
        sendEvent("onClose", mapOf("id" to id, "code" to 1006, "reason" to message))
      }
    }

    conn.ws = client.newWebSocket(request, listener)
  }

  private fun fetch(
    url: String,
    method: String,
    headersJson: String,
    body: String?,
    timeoutMs: Double,
    allowSelfSignedLan: Boolean,
    promise: Promise
  ) {
    val verb = if (method.isEmpty()) "GET" else method.uppercase()
    val builder = try {
      Request.Builder().url(url)
    } catch (e: IllegalArgumentException) {
      promise.reject("ERR_LAN_FETCH_URL", "Invalid HTTP URL.", e)
      return
    }
    var contentType: String? = null
    try {
      val obj = JSONObject(headersJson)
      for (name in obj.keys()) {
        val value = obj.optString(name, "")
        if (name.equals("Content-Type", ignoreCase = true)) contentType = value
        builder.header(name, value)
      }
    } catch (e: Exception) {
      // No / malformed headers: send none.
    }
    val requestBody: RequestBody? = when {
      body != null -> body.toRequestBody(contentType?.toMediaTypeOrNull())
      verb == "POST" || verb == "PUT" || verb == "PATCH" -> ByteArray(0).toRequestBody(null)
      else -> null
    }
    val request = try {
      builder.method(verb, requestBody).build()
    } catch (e: IllegalArgumentException) {
      promise.reject("ERR_LAN_FETCH", e.message ?: "Invalid request.", e)
      return
    }

    val isHttps = url.regionMatches(0, "https://", 0, 8, ignoreCase = true)
    val rawHost = rawUrlHost(url)
    val parsedHost = request.url.host

    // Relaxed trust only when explicitly requested, over https, and the literal host is RFC 1918.
    val relaxedHost: String? =
      if (allowSelfSignedLan && isHttps && rawHost != null && rawHost == parsedHost && isRfc1918Host(rawHost)) {
        rawHost
      } else {
        null
      }
    val base = if (relaxedHost != null) relaxedClient(relaxedHost) else defaultClient
    val ms = if (timeoutMs > 0) timeoutMs.toLong() else 10_000L
    val client = base.newBuilder()
      .callTimeout(ms, TimeUnit.MILLISECONDS)
      .readTimeout(ms, TimeUnit.MILLISECONDS)
      .build()

    val call = client.newCall(request)
    calls[call] = true
    call.enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        calls.remove(call)
        if (e is InterruptedIOException) {
          promise.reject("ERR_LAN_FETCH_TIMEOUT", "The request timed out.", e)
        } else {
          promise.reject("ERR_LAN_FETCH", e.message ?: "HTTP request failed.", e)
        }
      }

      override fun onResponse(call: Call, response: Response) {
        calls.remove(call)
        try {
          response.use { res ->
            val headers = JSONObject()
            for (name in res.headers.names()) {
              headers.put(name.lowercase(), res.headers(name).joinToString(", "))
            }
            val text = res.body?.string() ?: ""
            promise.resolve(mapOf("status" to res.code, "headersJson" to headers.toString(), "body" to text))
          }
        } catch (e: Exception) {
          promise.reject("ERR_LAN_FETCH", e.message ?: "Could not read the HTTP response.", e)
        }
      }
    })
  }

  /** Per-connection client for one RFC 1918 host: accepts the presented chain, verifies only that host. */
  private fun relaxedClient(host: String): OkHttpClient {
    val trustPresentedChain = object : X509TrustManager {
      override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        throw CertificateException("Client certificates are not supported.")
      }

      override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        if (chain == null || chain.isEmpty()) throw CertificateException("Empty certificate chain.")
      }

      override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }
    val ssl = SSLContext.getInstance("TLS")
    ssl.init(null, arrayOf(trustPresentedChain), SecureRandom())
    return defaultClient.newBuilder()
      .sslSocketFactory(ssl.socketFactory, trustPresentedChain)
      .hostnameVerifier { requested, _ -> requested == host }
      .followRedirects(false)
      .followSslRedirects(false)
      .build()
  }

  companion object {
    private val HOST_RE = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#:@]+)(?::\\d+)?(?:[/?#]|$)")
    private val OCTET_RE = Regex("^(0|[1-9][0-9]{0,2})$")

    /** Host part of the URL as written (IPv4 / hostname only, no userinfo or brackets), or null. */
    fun rawUrlHost(url: String): String? = HOST_RE.find(url)?.groupValues?.get(1)

    /** Strict dotted-quad IPv4 (no leading zeros, 0-255 per octet) in 10/8, 172.16/12 or 192.168/16. */
    fun isRfc1918Host(host: String): Boolean {
      val parts = host.split(".")
      if (parts.size != 4) return false
      val octets = IntArray(4)
      for ((i, p) in parts.withIndex()) {
        if (!OCTET_RE.matches(p)) return false
        val n = p.toInt()
        if (n > 255) return false
        octets[i] = n
      }
      val a = octets[0]
      val b = octets[1]
      if (a == 10) return true
      if (a == 172 && b in 16..31) return true
      if (a == 192 && b == 168) return true
      return false
    }

    fun decodeUtf8OrNull(bytes: ByteArray): String? = try {
      Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString()
    } catch (e: Exception) {
      null
    }
  }
}
