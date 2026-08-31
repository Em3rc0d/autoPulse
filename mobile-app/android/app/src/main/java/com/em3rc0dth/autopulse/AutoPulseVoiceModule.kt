package com.em3rc0dth.autopulse

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class AutoPulseVoiceModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener, LifecycleEventListener {

  private var tts: TextToSpeech? = null
  private var ready = false
  private var initializationFailed = false
  private var pendingText: String? = null
  private var pendingLanguageTag: String = DEFAULT_LANGUAGE_TAG
  private var pendingPromise: Promise? = null

  companion object {
    private const val DEFAULT_LANGUAGE_TAG = "en-US"
  }

  init {
    reactContext.addLifecycleEventListener(this)
    tts = TextToSpeech(reactContext, this)
  }

  override fun getName(): String = "AutoPulseVoice"

  override fun onInit(status: Int) {
    ready = status == TextToSpeech.SUCCESS
    initializationFailed = !ready

    if (ready) {
      setLanguage(DEFAULT_LANGUAGE_TAG)
      val text = pendingText
      val languageTag = pendingLanguageTag
      val promise = pendingPromise
      pendingText = null
      pendingLanguageTag = DEFAULT_LANGUAGE_TAG
      pendingPromise = null
      if (!text.isNullOrBlank() && promise != null) {
        speakNow(text, languageTag, promise)
      }
    } else {
      pendingPromise?.resolve(false)
      pendingText = null
      pendingLanguageTag = DEFAULT_LANGUAGE_TAG
      pendingPromise = null
    }
  }

  private fun setLanguage(languageTag: String): Boolean {
    val engine = tts ?: return false
    val locale = Locale.forLanguageTag(languageTag.ifBlank { DEFAULT_LANGUAGE_TAG })
    val availability = engine.isLanguageAvailable(locale)
    if (availability < TextToSpeech.LANG_AVAILABLE) return false
    return engine.setLanguage(locale) >= TextToSpeech.LANG_AVAILABLE
  }

  private fun speakNow(text: String, languageTag: String, promise: Promise) {
    if (!setLanguage(languageTag)) {
      promise.resolve(false)
      return
    }

    val result = tts?.speak(
      text,
      TextToSpeech.QUEUE_FLUSH,
      null,
      "autopulse-${System.currentTimeMillis()}"
    )
    promise.resolve(result == TextToSpeech.SUCCESS)
  }

  @ReactMethod
  fun speak(text: String, languageTag: String, promise: Promise) {
    if (text.isBlank() || initializationFailed) {
      promise.resolve(false)
      return
    }

    if (!ready) {
      // Startup warnings can arrive almost immediately after JS mounts. Keep the
      // newest message until Android TTS reports readiness rather than silently
      // dropping the first important advisory.
      pendingPromise?.resolve(false)
      pendingText = text
      pendingLanguageTag = languageTag.ifBlank { DEFAULT_LANGUAGE_TAG }
      pendingPromise = promise
      return
    }

    speakNow(text, languageTag, promise)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    pendingPromise?.resolve(false)
    pendingText = null
    pendingLanguageTag = DEFAULT_LANGUAGE_TAG
    pendingPromise = null
    tts?.stop()
    promise.resolve(true)
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    pendingPromise?.resolve(false)
    pendingText = null
    pendingLanguageTag = DEFAULT_LANGUAGE_TAG
    pendingPromise = null
    tts?.stop()
    tts?.shutdown()
    tts = null
    ready = false
  }
}
