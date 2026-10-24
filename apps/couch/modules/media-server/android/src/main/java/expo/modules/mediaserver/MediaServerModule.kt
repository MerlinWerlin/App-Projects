package expo.modules.mediaserver

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicInteger

/**
 * media-server: a tiny HTTP/1.1 file server so a TV on the home network can fetch one picked photo
 * or video (cast-1024 phase A).
 *
 * One java.net.ServerSocket per app process on an ephemeral port (>= 1024) on all interfaces,
 * started lazily by the first serve(). An accept thread hands every connection to its own thread
 * (cached thread pool). GET and HEAD only (else 405), path `/<token>` or `/<token>.<ext>` (else
 * 404), one byte range (`bytes=a-b`, `a-`, `-n`) -> 206, unsatisfiable -> 416, several ranges ->
 * full 200. Files are streamed in 64 KiB chunks. Every response carries `Connection: close`.
 *
 * Sources: file:// paths, and content:// URIs through ContentResolver (size from
 * openFileDescriptor / OpenableColumns.SIZE). ph:// is rejected.
 *
 * The server is stopped (every token forgotten, sockets closed) by stopAll(), when the activity
 * enters the background (OnActivityEntersBackground) and on OnDestroy.
 *
 * Nothing here logs tokens or file paths.
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested on a device or a TV.
 */
class MediaServerModule : Module() {
  private val server = MediaHttpServer { appContext.reactContext?.contentResolver }

  override fun definition() = ModuleDefinition {
    Name("MediaServer")

    AsyncFunction("serve") { uri: String, mime: String, promise: Promise ->
      server.serve(uri, mime, promise)
    }

    AsyncFunction("stop") { id: String, promise: Promise ->
      server.stop(id)
      promise.resolve(null)
    }

    AsyncFunction("stopAll") { promise: Promise ->
      server.stopAll()
      promise.resolve(null)
    }

    OnActivityEntersBackground {
      server.stopAll()
    }

    OnDestroy {
      server.stopAll()
    }
  }
}

private class ServedEntry(
  val id: String,
  val token: String,
  val file: File?,
  val contentUri: Uri?,
  val mime: String,
  val size: Long,
  val streaming: Boolean,
)

private sealed class RangeResult {
  object Full : RangeResult()
  class Partial(val start: Long, val end: Long) : RangeResult()
  object Unsatisfiable : RangeResult()
}

private class MediaHttpServer(private val resolverProvider: () -> ContentResolver?) {
  private val lock = Any()
  private val random = SecureRandom()
  private val entries = ConcurrentHashMap<String, ServedEntry>() // by token
  private val tokensById = ConcurrentHashMap<String, String>()
  private val sockets = ConcurrentHashMap<Socket, String>() // open connection -> entry id ("" before the head)

  // Guarded by `lock`.
  private var serverSocket: ServerSocket? = null
  private var pool: ExecutorService? = null

  fun serve(uri: String, mime: String, promise: Promise) {
    val lower = uri.lowercase()
    if (lower.startsWith("ph://") || lower.startsWith("assets-library://")) {
      promise.reject("ERR_MEDIA_SERVER_URI", "Photo library (ph://) URIs are not supported; pass a file:// copy.", null)
      return
    }
    var file: File? = null
    var contentUri: Uri? = null
    var size = -1L
    try {
      if (lower.startsWith("file://") || uri.startsWith("/")) {
        val path = if (uri.startsWith("/")) uri else Uri.parse(uri).path
        if (path != null && path.isNotEmpty()) {
          val f = File(path)
          if (f.isFile && f.canRead()) {
            file = f
            size = f.length()
          }
        }
      } else if (lower.startsWith("content://")) {
        val resolver = resolverProvider()
        if (resolver != null) {
          val parsed = Uri.parse(uri)
          size = contentSize(resolver, parsed)
          if (size >= 0) contentUri = parsed
        }
      } else {
        promise.reject("ERR_MEDIA_SERVER_URI", "Only file:// and content:// URIs can be served.", null)
        return
      }
    } catch (e: Exception) {
      file = null
      contentUri = null
    }
    if ((file == null && contentUri == null) || size < 0) {
      promise.reject("ERR_MEDIA_SERVER_URI", "The file is missing, not readable or of unknown size.", null)
      return
    }

    val token = randomToken()
    val contentType = safeMime(mime)
    val lowerMime = contentType.lowercase()
    val entry = ServedEntry(
      id = UUID.randomUUID().toString(),
      token = token,
      file = file,
      contentUri = contentUri,
      mime = contentType,
      size = size,
      streaming = lowerMime.startsWith("video/") || lowerMime.startsWith("audio/"),
    )

    val port = try {
      ensureStarted()
    } catch (e: Exception) {
      promise.reject("ERR_MEDIA_SERVER_START", "The media server could not start.", null)
      return
    }
    entries[token] = entry
    tokensById[entry.id] = token
    promise.resolve(mapOf("id" to entry.id, "port" to port, "token" to token))
  }

  fun stop(id: String) {
    val token = tokensById.remove(id) ?: return
    entries.remove(token)
    for ((socket, entryId) in sockets) {
      if (entryId == id) closeQuietly(socket)
    }
  }

  fun stopAll() {
    val old: Pair<ServerSocket?, ExecutorService?> = synchronized(lock) {
      val s = serverSocket
      val p = pool
      serverSocket = null
      pool = null
      Pair(s, p)
    }
    val oldServer = old.first
    val oldPool = old.second
    entries.clear()
    tokensById.clear()
    if (oldServer != null) {
      try {
        oldServer.close()
      } catch (e: IOException) {
        // ignore
      }
    }
    for (socket in sockets.keys) closeQuietly(socket)
    sockets.clear()
    oldPool?.shutdownNow()
  }

  /** Starts the listener once; returns its port. */
  private fun ensureStarted(): Int {
    return synchronized(lock) {
      val existing = serverSocket
      if (existing != null && !existing.isClosed) {
        existing.localPort
      } else {
        startLocked()
      }
    }
  }

  /** Caller holds `lock`. */
  private fun startLocked(): Int {
    val ss = ServerSocket(0, 50) // ephemeral port, all interfaces
    if (ss.localPort < 1024) {
      ss.close()
      throw IOException("ephemeral port below 1024")
    }
    val executor = Executors.newCachedThreadPool(DaemonThreadFactory())
    serverSocket = ss
    pool = executor
    val acceptThread = Thread({ acceptLoop(ss, executor) }, "couch-media-accept")
    acceptThread.isDaemon = true
    acceptThread.start()
    return ss.localPort
  }

  private fun acceptLoop(ss: ServerSocket, executor: ExecutorService) {
    while (!ss.isClosed) {
      val socket: Socket = try {
        ss.accept()
      } catch (e: IOException) {
        break // closed by stopAll
      }
      if (sockets.size >= MAX_CONNECTIONS) {
        closeQuietly(socket)
        continue
      }
      sockets[socket] = ""
      try {
        executor.execute { handle(socket) }
      } catch (e: RejectedExecutionException) {
        sockets.remove(socket)
        closeQuietly(socket)
      }
    }
  }

  private fun handle(socket: Socket) {
    try {
      socket.soTimeout = HEAD_TIMEOUT_MS
      socket.tcpNoDelay = true
      val input = BufferedInputStream(socket.getInputStream())
      val out = BufferedOutputStream(socket.getOutputStream(), CHUNK_BYTES)
      val head = readHead(input)
      if (head == null) {
        sendEmpty(out, 431, "Request Header Fields Too Large", emptyList())
        return
      }
      respond(socket, head, out)
    } catch (e: Exception) {
      // Client went away, socket closed by stop / stopAll, or a read failure: just close.
    } finally {
      sockets.remove(socket)
      closeQuietly(socket)
    }
  }

  /** Request head up to (not including) CRLF CRLF; null when it exceeds MAX_HEAD_BYTES. */
  private fun readHead(input: InputStream): String? {
    val buf = java.io.ByteArrayOutputStream()
    var matched = 0
    while (true) {
      val b = input.read()
      if (b < 0) throw IOException("eof before end of head")
      buf.write(b)
      matched = when {
        b == '\r'.code && (matched == 0 || matched == 2) -> matched + 1
        b == '\n'.code && (matched == 1 || matched == 3) -> matched + 1
        b == '\r'.code -> 1
        else -> 0
      }
      if (matched == 4) {
        val bytes = buf.toByteArray()
        return String(bytes, 0, bytes.size - 4, Charsets.ISO_8859_1)
      }
      if (buf.size() > MAX_HEAD_BYTES) return null
    }
  }

  private fun respond(socket: Socket, head: String, out: OutputStream) {
    val lines = head.split("\r\n")
    val parts = lines.firstOrNull()?.split(" ")?.filter { it.isNotEmpty() } ?: emptyList()
    if (parts.size < 2) {
      sendEmpty(out, 400, "Bad Request", emptyList())
      return
    }
    val method = parts[0].uppercase()
    val target = parts[1]
    var rangeHeader: String? = null
    for (line in lines.drop(1)) {
      val colon = line.indexOf(':')
      if (colon <= 0) continue
      val name = line.substring(0, colon).trim().lowercase()
      if (name == "range" && rangeHeader == null) rangeHeader = line.substring(colon + 1).trim()
    }

    if (method != "GET" && method != "HEAD") {
      sendEmpty(out, 405, "Method Not Allowed", listOf("Allow" to "GET, HEAD"))
      return
    }
    val token = tokenFromTarget(target)
    val entry = if (token != null) entries[token] else null
    if (entry == null) {
      sendEmpty(out, 404, "Not Found", emptyList())
      return
    }
    sockets[socket] = entry.id

    val size = entry.size
    val range = if (rangeHeader != null) parseRange(rangeHeader, size) else RangeResult.Full
    var status = 200
    var reason = "OK"
    var start = 0L
    var length = size
    val headers = ArrayList<Pair<String, String>>()
    when (range) {
      is RangeResult.Unsatisfiable -> {
        sendEmpty(out, 416, "Range Not Satisfiable", listOf("Content-Range" to "bytes */$size"))
        return
      }
      is RangeResult.Partial -> {
        status = 206
        reason = "Partial Content"
        start = range.start
        length = range.end - range.start + 1
        headers.add("Content-Range" to "bytes ${range.start}-${range.end}/$size")
      }
      is RangeResult.Full -> {}
    }
    headers.add("Content-Type" to entry.mime)
    headers.add("Content-Length" to length.toString())
    headers.add("Accept-Ranges" to "bytes")
    headers.add("Cache-Control" to "no-store")
    headers.add("Connection" to "close")
    headers.addAll(dlnaHeaders(entry.streaming))

    if (method == "HEAD" || length == 0L) {
      out.write(responseHead(status, reason, headers))
      out.flush()
      return
    }

    val source = openAt(entry, start)
    if (source == null) {
      sendEmpty(out, 500, "Internal Server Error", emptyList())
      return
    }
    source.use { stream ->
      out.write(responseHead(status, reason, headers))
      val buf = ByteArray(CHUNK_BYTES)
      var remaining = length
      while (remaining > 0) {
        val want = if (remaining < buf.size) remaining.toInt() else buf.size
        val n = stream.read(buf, 0, want)
        if (n < 0) break // file shrank; the client sees a short body and the closed connection
        out.write(buf, 0, n)
        remaining -= n
      }
      out.flush()
    }
  }

  /** Opens the entry's bytes positioned at `start`, or null. */
  private fun openAt(entry: ServedEntry, start: Long): InputStream? {
    val stream: InputStream = when {
      entry.file != null -> FileInputStream(entry.file)
      entry.contentUri != null -> {
        val resolver = resolverProvider() ?: return null
        val pfd = resolver.openFileDescriptor(entry.contentUri, "r")
        if (pfd != null) {
          android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd)
        } else {
          resolver.openInputStream(entry.contentUri) ?: return null
        }
      }
      else -> return null
    }
    if (start <= 0L) return stream
    try {
      if (stream is FileInputStream) {
        try {
          stream.channel.position(start)
          return stream
        } catch (e: IOException) {
          // Not seekable (a pipe): fall through to skipping.
        }
      }
      var toSkip = start
      val scratch = ByteArray(CHUNK_BYTES)
      while (toSkip > 0) {
        val skipped = stream.skip(toSkip)
        if (skipped > 0) {
          toSkip -= skipped
          continue
        }
        val want = if (toSkip < scratch.size) toSkip.toInt() else scratch.size
        val n = stream.read(scratch, 0, want)
        if (n < 0) throw IOException("eof while seeking")
        toSkip -= n
      }
      return stream
    } catch (e: IOException) {
      try {
        stream.close()
      } catch (ignored: IOException) {
      }
      return null
    }
  }

  private fun contentSize(resolver: ContentResolver, uri: Uri): Long {
    try {
      resolver.openFileDescriptor(uri, "r")?.use { pfd ->
        val stat = pfd.statSize
        if (stat >= 0) return stat
      }
    } catch (e: Exception) {
      // fall back to the provider's SIZE column
    }
    try {
      resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val index = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index)
        }
      }
    } catch (e: Exception) {
      // unknown size
    }
    return -1L
  }

  /** 18 bytes from SecureRandom (144 bits) as base64url without padding: 24 characters. */
  private fun randomToken(): String {
    val bytes = ByteArray(18)
    random.nextBytes(bytes)
    return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
  }

  private fun sendEmpty(out: OutputStream, status: Int, reason: String, extra: List<Pair<String, String>>) {
    val headers = ArrayList<Pair<String, String>>(extra)
    headers.add("Content-Length" to "0")
    headers.add("Connection" to "close")
    out.write(responseHead(status, reason, headers))
    out.flush()
  }

  private fun closeQuietly(socket: Socket) {
    try {
      socket.close()
    } catch (e: IOException) {
      // ignore
    }
  }

  private class DaemonThreadFactory : ThreadFactory {
    private val count = AtomicInteger(0)
    override fun newThread(r: Runnable): Thread {
      val t = Thread(r, "couch-media-" + count.incrementAndGet())
      t.isDaemon = true
      return t
    }
  }

  companion object {
    private const val MAX_HEAD_BYTES = 16 * 1024
    private const val CHUNK_BYTES = 64 * 1024
    private const val MAX_CONNECTIONS = 64
    private const val HEAD_TIMEOUT_MS = 15_000
    private val TOKEN_RE = Regex("^[A-Za-z0-9_-]{22,128}$")
    private val EXT_RE = Regex("^[A-Za-z0-9]{1,5}$")

    /** `/<token>` or `/<token>.<ext>` (query string ignored) -> token, else null. */
    fun tokenFromTarget(target: String): String? {
      var path = target
      val q = path.indexOf('?')
      if (q >= 0) path = path.substring(0, q)
      if (!path.startsWith("/")) return null
      path = path.substring(1)
      var token = path
      val dot = path.indexOf('.')
      if (dot >= 0) {
        token = path.substring(0, dot)
        if (!EXT_RE.matches(path.substring(dot + 1))) return null
      }
      return if (TOKEN_RE.matches(token)) token else null
    }

    /** One `bytes=` range; malformed values are ignored (full 200); several ranges get the full file. */
    fun parseRange(value: String, size: Long): RangeResult {
      val v = value.trim()
      if (!v.lowercase().startsWith("bytes=")) return RangeResult.Full
      val spec = v.substring(6).trim()
      if (spec.contains(',')) return RangeResult.Full
      val dash = spec.indexOf('-')
      if (dash < 0) return RangeResult.Full
      val first = spec.substring(0, dash).trim()
      val second = spec.substring(dash + 1).trim()
      if (first.isEmpty()) {
        val n = second.toLongOrNull() ?: return RangeResult.Full
        if (n < 0) return RangeResult.Full
        if (n == 0L || size == 0L) return RangeResult.Unsatisfiable
        val start = if (n >= size) 0L else size - n
        return RangeResult.Partial(start, size - 1)
      }
      val start = first.toLongOrNull() ?: return RangeResult.Full
      if (start < 0) return RangeResult.Full
      var end = size - 1
      if (second.isNotEmpty()) {
        val e = second.toLongOrNull() ?: return RangeResult.Full
        if (e < start) return RangeResult.Full
        end = e
      }
      if (start >= size) return RangeResult.Unsatisfiable
      if (end > size - 1) end = size - 1
      return RangeResult.Partial(start, end)
    }

    /** The caller's mime type, or application/octet-stream when empty or unsafe for a header line. */
    fun safeMime(mime: String): String {
      val t = mime.trim()
      if (t.isEmpty() || t.length > 100) return "application/octet-stream"
      for (ch in t) {
        if (ch.code < 0x20 || ch.code > 0x7E) return "application/octet-stream"
      }
      return t
    }

    /**
     * DLNA delivery headers. Unverified best practice for DLNA TVs (copied from common DLNA
     * servers): Streaming for video / audio, Interactive for images; OP=01 = byte seeking.
     */
    fun dlnaHeaders(streaming: Boolean): List<Pair<String, String>> = listOf(
      "transferMode.dlna.org" to (if (streaming) "Streaming" else "Interactive"),
      "contentFeatures.dlna.org" to "DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000",
    )

    fun responseHead(status: Int, reason: String, headers: List<Pair<String, String>>): ByteArray {
      val sb = StringBuilder()
      sb.append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
      for ((name, value) in headers) sb.append(name).append(": ").append(value).append("\r\n")
      sb.append("\r\n")
      return sb.toString().toByteArray(Charsets.ISO_8859_1)
    }
  }
}
