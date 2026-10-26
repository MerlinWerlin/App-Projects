package app.backspin.pcm

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.SystemClock
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Decode off the UI thread. No new microphone/library permission or external dependency. */
internal object PcmDecoder {
  private const val MAX_BYTES = 16 * 1024 * 1024
  private const val TIMEOUT_MS = 30_000L

  fun decode(source: File, output: File) {
    require(source.canonicalFile != output.canonicalFile)
    val extractor = MediaExtractor()
    var decoder: MediaCodec? = null
    var started = false
    var complete = false
    try {
      extractor.setDataSource(source.absolutePath)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: error("Recording has no audio")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      format.setInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      val codec = MediaCodec.createDecoderByType(requireNotNull(format.getString(MediaFormat.KEY_MIME)))
      decoder = codec
      codec.configure(format, null, null, 0)
      codec.start()
      started = true
      val info = MediaCodec.BufferInfo()
      var inputEnded = false
      var outputEnded = false
      var byteCount = 0
      val deadline = SystemClock.elapsedRealtime() + TIMEOUT_MS
      RandomAccessFile(output, "rw").use { file ->
        file.setLength(0)
        file.write(ByteArray(44))
        while (!outputEnded) {
          check(SystemClock.elapsedRealtime() < deadline) { "Recording conversion timed out" }
          if (!inputEnded) {
            val index = codec.dequeueInputBuffer(10_000)
            if (index >= 0) {
              val buffer = requireNotNull(codec.getInputBuffer(index)).apply { clear() }
              val size = extractor.readSampleData(buffer, 0)
              if (size < 0) {
                codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputEnded = true
              } else {
                codec.queueInputBuffer(index, 0, size, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }
          val index = codec.dequeueOutputBuffer(info, 10_000)
          if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val actual = codec.outputFormat
            val newRate = actual.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val newChannels = actual.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            check(byteCount == 0 || (rate == newRate && channels == newChannels)) { "Audio format changed during recording" }
            rate = newRate
            channels = newChannels
            val encoding = if (actual.containsKey(MediaFormat.KEY_PCM_ENCODING)) actual.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
            check(encoding == AudioFormat.ENCODING_PCM_16BIT) { "Unsupported decoded audio format" }
            check(rate in 8_000..192_000 && channels in 1..2) { "Unsupported recording layout" }
          } else if (index >= 0) {
            try {
              if (info.size > 0 && info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0) {
                check(byteCount + info.size <= MAX_BYTES) { "Recording is too large" }
                val buffer = requireNotNull(codec.getOutputBuffer(index))
                buffer.position(info.offset)
                buffer.limit(info.offset + info.size)
                val bytes = ByteArray(info.size)
                buffer.get(bytes)
                file.write(bytes)
                byteCount += bytes.size
              }
              outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            } finally {
              codec.releaseOutputBuffer(index, false)
            }
          }
        }
        check(rate in 8_000..192_000 && channels in 1..2 && byteCount > 0 && byteCount % (channels * 2) == 0) { "Recording contains no complete PCM frames" }
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray(Charsets.US_ASCII)).putInt(36 + byteCount)
        header.put("WAVEfmt ".toByteArray(Charsets.US_ASCII)).putInt(16)
        header.putShort(1).putShort(channels.toShort()).putInt(rate).putInt(rate * channels * 2)
        header.putShort((channels * 2).toShort()).putShort(16)
        header.put("data".toByteArray(Charsets.US_ASCII)).putInt(byteCount)
        file.seek(0)
        file.write(header.array())
      }
      complete = true
    } finally {
      if (started) runCatching { decoder?.stop() }
      runCatching { decoder?.release() }
      extractor.release()
      if (!complete) output.delete()
    }
  }
}
