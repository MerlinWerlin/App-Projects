package app.glaze.androidmodule

import android.content.Context
import android.content.SharedPreferences
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.util.Log
import android.view.SurfaceHolder
import org.json.JSONObject
import java.io.File

/**
 * Glaze video live wallpaper (T13, docs/ANDROID.md).
 *
 * Plays the loop saved by GlazeAndroidModule.setVideoWallpaper: config JSON
 * {"uri": "...", "trim": {"startMs": n, "endMs": n}, "speed": 0.5|1|1.5} in the
 * SharedPreferences file "glaze.wallpaper" (key "config"). endMs 0 = play to the end.
 *
 * - android.media.MediaPlayer on the engine's surface (no extra dependency).
 * - Muted, looping between trim start and end, centre-cropped to fill the screen.
 * - Battery-aware: pauses whenever the wallpaper is not visible, resumes when it is.
 * - Releases the player when the surface or engine goes away.
 */
class GlazeVideoWallpaperService : WallpaperService() {

  override fun onCreateEngine(): Engine = VideoEngine()

  data class Config(val uri: String, val startMs: Int, val endMs: Int, val speed: Float)

  companion object {
    const val PREFS = "glaze.wallpaper"
    const val KEY_CONFIG = "config"
    private const val TAG = "GlazeWallpaper"
    private const val TRIM_POLL_MS = 50L

    fun parseConfig(json: String?): Config? {
      if (json.isNullOrBlank()) return null
      return try {
        val o = JSONObject(json)
        val uri = o.optString("uri", "")
        if (uri.isEmpty()) return null
        val trim = o.optJSONObject("trim")
        val start = (trim?.optInt("startMs", 0) ?: 0).coerceAtLeast(0)
        val end = (trim?.optInt("endMs", 0) ?: 0).let { if (it > start) it else 0 }
        val speed = o.optDouble("speed", 1.0).toFloat().let { if (it > 0f && it <= 4f) it else 1f }
        Config(uri, start, end, speed)
      } catch (e: Exception) {
        null
      }
    }

    fun readConfig(context: Context): Config? =
      parseConfig(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CONFIG, null))
  }

  inner class VideoEngine : Engine(), SharedPreferences.OnSharedPreferenceChangeListener {
    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var prepared = false
    private var visible = false
    private var holder: SurfaceHolder? = null
    private var config: Config? = null
    private val prefs: SharedPreferences =
      applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Seeks back to trim start once playback passes trim end (MediaPlayer has no range looping). */
    private val trimLoop = object : Runnable {
      override fun run() {
        val p = player ?: return
        val c = config ?: return
        try {
          if (prepared && p.isPlaying && c.endMs > 0 && p.currentPosition >= c.endMs) {
            p.seekTo(c.startMs)
          }
        } catch (e: IllegalStateException) {
          // Player was released between posts; nothing to do.
        }
        if (visible) handler.postDelayed(this, TRIM_POLL_MS)
      }
    }

    override fun onCreate(surfaceHolder: SurfaceHolder) {
      super.onCreate(surfaceHolder)
      setTouchEventsEnabled(false)
      prefs.registerOnSharedPreferenceChangeListener(this)
    }

    override fun onSurfaceCreated(surfaceHolder: SurfaceHolder) {
      super.onSurfaceCreated(surfaceHolder)
      holder = surfaceHolder
      startPlayer()
    }

    override fun onSurfaceDestroyed(surfaceHolder: SurfaceHolder) {
      releasePlayer()
      holder = null
      super.onSurfaceDestroyed(surfaceHolder)
    }

    override fun onVisibilityChanged(isVisible: Boolean) {
      visible = isVisible
      val p = player
      if (p == null) {
        if (isVisible && holder != null) startPlayer()
        return
      }
      try {
        if (isVisible) {
          if (prepared && !p.isPlaying) {
            p.start()
            applySpeed(p)
          }
          handler.removeCallbacks(trimLoop)
          handler.post(trimLoop)
        } else {
          // Battery: never decode frames nobody can see.
          handler.removeCallbacks(trimLoop)
          if (prepared && p.isPlaying) p.pause()
        }
      } catch (e: IllegalStateException) {
        Log.w(TAG, "visibility change on a dead player", e)
      }
    }

    override fun onSharedPreferenceChanged(sp: SharedPreferences?, key: String?) {
      if (key == KEY_CONFIG && holder != null) {
        releasePlayer()
        startPlayer()
      }
    }

    override fun onDestroy() {
      prefs.unregisterOnSharedPreferenceChangeListener(this)
      releasePlayer()
      super.onDestroy()
    }

    private fun startPlayer() {
      val h = holder ?: return
      val c = readConfig(applicationContext) ?: return
      config = c
      val uri = resolveUri(c.uri) ?: return
      val p = MediaPlayer()
      player = p
      prepared = false
      try {
        p.setSurface(h.surface)
        p.setDataSource(applicationContext, uri)
        p.setVolume(0f, 0f)
        // Our own trim loop handles ranges; full-length loops use MediaPlayer's own looping.
        p.isLooping = c.endMs == 0 && c.startMs == 0
        p.setOnPreparedListener { mp ->
          prepared = true
          // Centre-crop: scale to fill the surface, cropping the overflow (keeps aspect ratio).
          mp.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING)
          if (c.startMs > 0) mp.seekTo(c.startMs)
          if (visible || isPreview) {
            mp.start()
            applySpeed(mp)
            handler.removeCallbacks(trimLoop)
            handler.post(trimLoop)
          }
        }
        p.setOnCompletionListener { mp ->
          // Reached the end of the file with a trim start set (or looping off): go round again.
          try {
            mp.seekTo(c.startMs)
            if (visible || isPreview) mp.start()
          } catch (e: IllegalStateException) {
            Log.w(TAG, "completion on a dead player", e)
          }
        }
        p.setOnErrorListener { _, what, extra ->
          Log.w(TAG, "MediaPlayer error what=$what extra=$extra")
          releasePlayer()
          true
        }
        p.prepareAsync()
      } catch (e: Exception) {
        Log.w(TAG, "could not start wallpaper video", e)
        releasePlayer()
      }
    }

    private fun applySpeed(p: MediaPlayer) {
      val c = config ?: return
      if (c.speed == 1f || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
      try {
        // Setting PlaybackParams on a paused player starts it, so only call this while playing.
        p.playbackParams = p.playbackParams.setSpeed(c.speed)
      } catch (e: Exception) {
        Log.w(TAG, "playback speed not supported", e)
      }
    }

    private fun resolveUri(raw: String): Uri? {
      return try {
        if (raw.startsWith("/")) Uri.fromFile(File(raw)) else Uri.parse(raw)
      } catch (e: Exception) {
        null
      }
    }

    private fun releasePlayer() {
      handler.removeCallbacks(trimLoop)
      val p = player ?: return
      player = null
      prepared = false
      try {
        p.setOnPreparedListener(null)
        p.setOnCompletionListener(null)
        p.setOnErrorListener(null)
        p.reset()
        p.release()
      } catch (e: Exception) {
        Log.w(TAG, "release failed", e)
      }
    }
  }
}
