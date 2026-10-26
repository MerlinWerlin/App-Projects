package app.backspin.pcm

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

@RunWith(AndroidJUnit4::class)
class PcmDecoderTest {
  @Test fun aacBecomesRealPcmAndDecoderCanBeReused() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val cache = instrumentation.targetContext.cacheDir
    val input = File.createTempFile("tone-", ".m4a", cache)
    try {
      instrumentation.context.assets.open("tone.m4a").use { source -> input.outputStream().use { source.copyTo(it) } }
      repeat(2) {
        val output = File.createTempFile("decoded-", ".wav", cache)
        try {
          PcmDecoder.decode(input, output)
          val bytes = output.readBytes()
          val view = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
          assertEquals("RIFF", String(bytes, 0, 4, Charsets.US_ASCII))
          assertEquals("WAVE", String(bytes, 8, 4, Charsets.US_ASCII))
          assertEquals(1, view.getShort(20).toInt())
          assertEquals(1, view.getShort(22).toInt())
          assertEquals(44100, view.getInt(24))
          assertEquals(16, view.getShort(34).toInt())
          assertEquals(bytes.size - 44, view.getInt(40))
          val frames = (bytes.size - 44) / 2
          assertTrue("AAC duration preserved", frames in 8000..16000)
          assertTrue("decoded tone has sound", (44 until bytes.size step 2).any { kotlin.math.abs(view.getShort(it).toInt()) > 500 })
        } finally { output.delete() }
      }
      assertTrue("conversion preserves its input", input.isFile)
    } finally { input.delete() }
  }

  @Test fun corruptRecordingRejectsAndRemovesPartialOutput() {
    val cache = InstrumentationRegistry.getInstrumentation().targetContext.cacheDir
    val input = File.createTempFile("invalid-", ".m4a", cache).apply { writeText("not an audio file") }
    val output = File.createTempFile("invalid-", ".wav", cache)
    try {
      val result = runCatching { PcmDecoder.decode(input, output) }
      assertTrue(result.isFailure)
      assertFalse("partial output removed", output.exists())
    } finally { input.delete(); output.delete() }
  }
}
