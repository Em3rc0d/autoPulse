package com.em3rc0dth.autopulse

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

/**
 * Local Android TTS adapter. A fulfilled Promise means utterance completion
 * (onDone), NOT that speak() merely accepted the request.
 *
 * All mutable native state is serialized on the Android main thread. A bounded
 * timeout prevents a failed TTS engine from hanging a JS safety-alert Promise.
 */
class AutoPulseVoiceModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener, LifecycleEventListener {

  private data class SpeechRequest(
    val text: String,
    val languageTag: String,
    val priority: Int,
    val promise: Promise,
  )

  private data class ActiveSpeech(
    val utteranceId: String,
    val priority: Int,
    val promise: Promise,
  )

  private val handler = Handler(Looper.getMainLooper())
  private val nextUtteranceId = AtomicLong(1)
  private var tts: TextToSpeech? = null
  private var ready = false
  private var initializationFailed = false
  private var destroyed = false
  private var pending: SpeechRequest? = null
  private var active: ActiveSpeech? = null
  private var activeTimeout: Runnable? = null
  private var initializationTimeout: Runnable? = null

  companion object {
    private const val MAX_UTTERANCE_MS = 15_000L
    private const val MAX_INITIALIZATION_MS = 8_000L
  }

  init {
    reactContext.addLifecycleEventListener(this)
    tts = TextToSpeech(reactContext, this)
    val timeout = Runnable {
      if (!ready && !initializationFailed && !destroyed) {
        initializationFailed = true
        finishPending()
        tts?.shutdown()
        tts = null
      }
    }
    initializationTimeout = timeout
    handler.postDelayed(timeout, MAX_INITIALIZATION_MS)
  }

  override fun getName(): String = "AutoPulseVoice"

  override fun onInit(status: Int) {
    handler.post {
      if (destroyed || initializationFailed) return@post
      initializationTimeout?.let { handler.removeCallbacks(it) }
      initializationTimeout = null
      ready = status == TextToSpeech.SUCCESS
      initializationFailed = !ready

      if (ready) {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) = Unit

          override fun onDone(utteranceId: String?) {
            handler.post { finishActive(utteranceId, true) }
          }

          override fun onError(utteranceId: String?) {
            handler.post { finishActive(utteranceId, false) }
          }

          override fun onError(utteranceId: String?, errorCode: Int) {
            handler.post { finishActive(utteranceId, false) }
          }

          override fun onStop(utteranceId: String?, interrupted: Boolean) {
            handler.post { finishActive(utteranceId, false) }
          }
        })

        val queued = pending
        pending = null
        if (queued != null) queueOrSpeak(queued)
      } else {
        finishPending()
        finishActive(null, false)
      }
    }
  }

  private fun finishPending() {
    pending?.promise?.resolve(false)
    pending = null
  }

  private fun finishActive(utteranceId: String?, delivered: Boolean) {
    val current = active ?: return
    if (utteranceId != null && utteranceId != current.utteranceId) return
    active = null
    activeTimeout?.let { handler.removeCallbacks(it) }
    activeTimeout = null
    current.promise.resolve(delivered)
  }

  private fun applyLanguage(languageTag: String): Boolean {
    if (languageTag != "en-US" && languageTag != "es-ES") return false
    val engine = tts ?: return false
    val locale = Locale.forLanguageTag(languageTag)
    val available = engine.isLanguageAvailable(locale)
    if (available < TextToSpeech.LANG_AVAILABLE) return false
    return engine.setLanguage(locale) >= TextToSpeech.LANG_AVAILABLE
  }

  private fun speakNow(request: SpeechRequest) {
    // Check the currently speaking priority BEFORE changing the Android voice
    // locale, so a rejected advisory cannot alter a critical utterance.
    if ((active?.priority ?: -1) > request.priority) {
      request.promise.resolve(false)
      return
    }
    if (!applyLanguage(request.languageTag)) {
      request.promise.resolve(false)
      return
    }

    val engine = tts
    if (engine == null) {
      request.promise.resolve(false)
      return
    }

    finishActive(null, false)
    engine.stop()

    val id = "autopulse-" + nextUtteranceId.getAndIncrement().toString()
    active = ActiveSpeech(id, request.priority, request.promise)

    val timeout = Runnable {
      if (active?.utteranceId == id) {
        finishActive(id, false)
        engine.stop()
      }
    }
    activeTimeout = timeout
    handler.postDelayed(timeout, MAX_UTTERANCE_MS)

    try {
      val result = engine.speak(request.text, TextToSpeech.QUEUE_FLUSH, null, id)
      if (result != TextToSpeech.SUCCESS) finishActive(id, false)
      // On acceptance, wait for onDone/onError/onStop or the timeout above.
    } catch (_: Exception) {
      finishActive(id, false)
    }
  }

  private fun queueOrSpeak(request: SpeechRequest) {
    if (destroyed || initializationFailed || request.text.isBlank()) {
      request.promise.resolve(false)
      return
    }
    if (!ready) {
      if ((pending?.priority ?: -1) > request.priority) {
        request.promise.resolve(false)
        return
      }
      finishPending()
      pending = request
      return
    }
    speakNow(request)
  }

  private fun enqueue(text: String, languageTag: String, priority: Int, promise: Promise) {
    handler.post {
      queueOrSpeak(SpeechRequest(text, languageTag, priority.coerceIn(0, 3), promise))
    }
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    enqueue(text, "en-US", 1, promise)
  }

  @ReactMethod
  fun speakLocalized(text: String, languageTag: String, promise: Promise) {
    enqueue(text, languageTag, 1, promise)
  }

  @ReactMethod
  fun speakAlert(text: String, languageTag: String, priority: Int, promise: Promise) {
    enqueue(text, languageTag, priority, promise)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    handler.post {
      finishPending()
      finishActive(null, false)
      tts?.stop()
      promise.resolve(true)
    }
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    handler.post {
      destroyed = true
      initializationTimeout?.let { handler.removeCallbacks(it) }
      initializationTimeout = null
      finishPending()
      finishActive(null, false)
      tts?.stop()
      tts?.shutdown()
      tts = null
      ready = false
    }
  }
}
