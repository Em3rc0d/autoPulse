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
  private var pendingLanguageTag: String = "en-US"
  private var pendingPromise: Promise? = null

  init {
    reactContext.addLifecycleEventListener(this)
    tts = TextToSpeech(reactContext, this)
  }

  override fun getName(): String = "AutoPulseVoice"

  override fun onInit(status: Int) {
    ready = status == TextToSpeech.SUCCESS
    initializationFailed = !ready

    if (ready) {
      applyLanguage("en-US")
      val text = pendingText
      val languageTag = pendingLanguageTag
      val promise = pendingPromise
      pendingText = null
      pendingPromise = null
      if (!text.isNullOrBlank() && promise != null) {
        speakNow(text, languageTag, promise)
      }
    } else {
      pendingPromise?.resolve(false)
      pendingText = null
      pendingPromise = null
    }
  }

  private fun applyLanguage(languageTag: String): Boolean {
    val locale = when (languageTag) {
      "es-ES" -> Locale("es", "ES")
      else -> Locale.US
    }
    val result = tts?.setLanguage(locale) ?: TextToSpeech.LANG_NOT_SUPPORTED
    return result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
  }

  private fun speakNow(text: String, languageTag: String, promise: Promise) {
    if (!applyLanguage(languageTag)) {
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

  private fun queueOrSpeak(text: String, languageTag: String, promise: Promise) {
    if (text.isBlank() || initializationFailed) {
      promise.resolve(false)
      return
    }

    if (!ready) {
      // Safety messages can arrive immediately after JS mounts. Keep only the
      // newest message until Android TTS reports readiness.
      pendingPromise?.resolve(false)
      pendingText = text
      pendingLanguageTag = languageTag
      pendingPromise = promise
      return
    }

    speakNow(text, languageTag, promise)
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    queueOrSpeak(text, "en-US", promise)
  }

  @ReactMethod
  fun speakLocalized(text: String, languageTag: String, promise: Promise) {
    queueOrSpeak(text, languageTag, promise)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    pendingPromise?.resolve(false)
    pendingText = null
    pendingPromise = null
    tts?.stop()
    promise.resolve(true)
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    pendingPromise?.resolve(false)
    pendingText = null
    pendingPromise = null
    tts?.stop()
    tts?.shutdown()
    tts = null
    ready = false
  }
}
