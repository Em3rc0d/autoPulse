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
      tts?.language = Locale.getDefault()
      val text = pendingText
      val promise = pendingPromise
      pendingText = null
      pendingPromise = null
      if (!text.isNullOrBlank() && promise != null) {
        speakNow(text, promise)
      }
    } else {
      pendingPromise?.resolve(false)
      pendingText = null
      pendingPromise = null
    }
  }

  private fun speakNow(text: String, promise: Promise) {
    val result = tts?.speak(
      text,
      TextToSpeech.QUEUE_FLUSH,
      null,
      "autopulse-${System.currentTimeMillis()}"
    )
    promise.resolve(result == TextToSpeech.SUCCESS)
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
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
      pendingPromise = promise
      return
    }

    speakNow(text, promise)
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
