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

  init {
    reactContext.addLifecycleEventListener(this)
    tts = TextToSpeech(reactContext, this)
  }

  override fun getName(): String = "AutoPulseVoice"

  override fun onInit(status: Int) {
    ready = status == TextToSpeech.SUCCESS
    if (ready) {
      tts?.language = Locale.getDefault()
    }
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    if (!ready || text.isBlank()) {
      promise.resolve(false)
      return
    }
    val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "autopulse-${System.currentTimeMillis()}")
    promise.resolve(result == TextToSpeech.SUCCESS)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    tts?.stop()
    promise.resolve(true)
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    tts?.stop()
    tts?.shutdown()
    tts = null
    ready = false
  }
}
