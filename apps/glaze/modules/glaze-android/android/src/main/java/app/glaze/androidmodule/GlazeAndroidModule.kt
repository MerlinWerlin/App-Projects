package app.glaze.androidmodule

import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.BitmapFactory
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

/**
 * GlazeAndroid native module (T13). Reached only through src/native/android.ts.
 *
 * Every function resolves with a result string and never rejects:
 *   setVideoWallpaper(json) -> "requested" | "unsupported" | "error:<reason>"
 *   isPinShortcutSupported() -> Boolean
 *   pinShortcut(json)       -> "requested" | "unsupported" | "error:<reason>"
 */
class GlazeAndroidModule : Module() {

  private val context: Context?
    get() = appContext.reactContext?.applicationContext

  override fun definition() = ModuleDefinition {
    Name("GlazeAndroid")

    AsyncFunction("setVideoWallpaper") { json: String ->
      setVideoWallpaper(json)
    }

    AsyncFunction("isPinShortcutSupported") {
      val ctx = context
      ctx != null && pinSupported(ctx)
    }

    AsyncFunction("pinShortcut") { json: String ->
      pinShortcut(json)
    }
  }

  // ---------------------------------------------------------------- live wallpaper

  private fun setVideoWallpaper(json: String): String {
    val ctx = context ?: return "error:no-context"
    return try {
      val o = JSONObject(json)
      val source = o.optString("uri", "")
      if (source.isEmpty()) return "error:no-uri"

      // Copy the video into app storage so the service can always read it
      // (picker content:// grants don't survive a reboot; cache files can be cleared).
      val dest = File(ctx.filesDir, "glaze-wallpaper.mp4")
      val tmp = File(ctx.filesDir, "glaze-wallpaper.tmp")
      val srcUri = if (source.startsWith("/")) Uri.fromFile(File(source)) else Uri.parse(source)
      val input = ctx.contentResolver.openInputStream(srcUri) ?: return "error:unreadable"
      input.use { ins -> tmp.outputStream().use { out -> ins.copyTo(out) } }
      if (dest.exists()) dest.delete()
      if (!tmp.renameTo(dest)) return "error:copy-failed"

      o.put("uri", Uri.fromFile(dest).toString())
      // Version bump so the service's preference listener always fires, even for the same loop.
      o.put("savedAt", System.currentTimeMillis())
      ctx.getSharedPreferences(GlazeVideoWallpaperService.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(GlazeVideoWallpaperService.KEY_CONFIG, o.toString())
        .apply()

      if (isOurWallpaperActive(ctx)) return "requested" // Already set: the service reloads the new config.
      openLiveWallpaperPicker(ctx)
    } catch (e: Exception) {
      "error:${e.javaClass.simpleName}"
    }
  }

  private fun isOurWallpaperActive(ctx: Context): Boolean {
    return try {
      val info = WallpaperManager.getInstance(ctx).wallpaperInfo
      info != null && info.packageName == ctx.packageName &&
        info.serviceName == GlazeVideoWallpaperService::class.java.name
    } catch (e: Exception) {
      false
    }
  }

  private fun openLiveWallpaperPicker(ctx: Context): String {
    val component = ComponentName(ctx, GlazeVideoWallpaperService::class.java)
    val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
      .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
    val chooser = Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)
    for (intent in listOf(direct, chooser)) {
      try {
        startActivity(ctx, intent)
        return "requested"
      } catch (e: ActivityNotFoundException) {
        // Some launchers/OEM builds lack the direct preview; try the generic chooser next.
      }
    }
    return "unsupported"
  }

  private fun startActivity(ctx: Context, intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  // ---------------------------------------------------------------- pinned shortcuts

  private fun pinSupported(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    return try {
      ctx.getSystemService(ShortcutManager::class.java)?.isRequestPinShortcutSupported == true
    } catch (e: Exception) {
      false
    }
  }

  private fun pinShortcut(json: String): String {
    val ctx = context ?: return "error:no-context"
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !pinSupported(ctx)) return "unsupported"
    return try {
      val o = JSONObject(json)
      val id = o.optString("id", "")
      val label = o.optString("label", "")
      val longLabel = o.optString("longLabel", label)
      val url = o.optString("url", "")
      val png = o.optString("pngBase64", "")
      if (id.isEmpty() || label.isEmpty() || url.isEmpty() || png.isEmpty()) return "error:bad-payload"

      val bytes = Base64.decode(png, Base64.DEFAULT)
      val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return "error:bad-png"

      // The URL scheme of the target app. VERIFY: many catalogue schemes are iOS-only; when no
      // Android activity handles it the launcher shows "App isn't installed" on tap.
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)

      // Our PNG already carries the Glaze theme's shape and colours, so it is used as-is.
      // VERIFY: Android 13+ "themed icons" (monochrome) apply to app icons, not shortcut bitmaps.
      val info = ShortcutInfo.Builder(ctx, id)
        .setShortLabel(label)
        .setLongLabel(longLabel)
        .setIcon(Icon.createWithBitmap(bitmap))
        .setIntent(intent)
        .build()

      val manager = ctx.getSystemService(ShortcutManager::class.java) ?: return "unsupported"
      if (manager.requestPinShortcut(info, null)) "requested" else "unsupported"
    } catch (e: Exception) {
      "error:${e.javaClass.simpleName}"
    }
  }
}
