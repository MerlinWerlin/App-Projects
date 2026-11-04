package app.backspin.pcm

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class BackspinPcmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BackspinPcm")
    AsyncFunction("decodeToWav") { uri: String ->
      val context = appContext.reactContext ?: error("App context unavailable")
      val parsed = Uri.parse(uri)
      require(parsed.scheme == "file") { "Expected a local recording" }
      val source = File(requireNotNull(parsed.path)).canonicalFile
      val cache = context.cacheDir.canonicalFile
      require(source.path.startsWith(cache.path + File.separator) && source.isFile) { "Recording is outside app cache" }
      val directory = File(cache, "round").apply { mkdirs() }
      val output = File.createTempFile("recording-", ".wav", directory)
      PcmDecoder.decode(source, output)
      Uri.fromFile(output).toString()
    }
  }
}
