package expo.modules.irblaster

import android.content.Context
import android.hardware.ConsumerIrManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin wrapper over android.hardware.ConsumerIrManager. UNVERIFIED: written without a build machine
 * or an IR phone. Patterns are alternating on/off microseconds starting with "on" (see
 * src/core/ir/protocols.ts).
 */
class IrBlasterModule : Module() {
  private fun manager(): ConsumerIrManager? {
    val ctx = appContext.reactContext ?: return null
    return ctx.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
  }

  override fun definition() = ModuleDefinition {
    Name("IrBlaster")

    Function("hasIrEmitter") {
      try {
        manager()?.hasIrEmitter() ?: false
      } catch (e: Throwable) {
        false
      }
    }

    Function("getCarrierFrequencies") {
      try {
        val m = manager()
        if (m == null || !m.hasIrEmitter()) {
          emptyList<Map<String, Int>>()
        } else {
          m.carrierFrequencies?.map { mapOf("min" to it.minFrequency, "max" to it.maxFrequency) } ?: emptyList()
        }
      } catch (e: Throwable) {
        emptyList<Map<String, Int>>()
      }
    }

    AsyncFunction("transmit") { frequency: Int, pattern: List<Int> ->
      val m = manager()
      if (m == null || !m.hasIrEmitter()) {
        throw IrException("This phone has no infrared blaster.")
      }
      if (pattern.isEmpty() || pattern.any { it <= 0 }) {
        throw IrException("Invalid infrared pattern.")
      }
      try {
        // Blocks until the pattern has been sent (at most 2 s); AsyncFunction runs off the JS thread.
        m.transmit(frequency, pattern.toIntArray())
      } catch (e: Exception) {
        throw IrException(e.message ?: "Could not send the infrared signal.")
      }
    }
  }
}

class IrException(message: String) : CodedException("ERR_IR_TRANSMIT", message, null)
