package com.em3rc0dth.autopulse

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.PI

class AutoPulseMotionModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), SensorEventListener, LifecycleEventListener {

  private val sensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
  private var listening = false
  private var listenerCount = 0

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "AutoPulseMotion"

  @ReactMethod
  fun start() {
    if (listening || rotationSensor == null) return
    // Off-Road orientation is glance telemetry, not an IMU recorder. Keep the
    // bridge intentionally slow so phone sensors can never compete with ELM/OBD
    // command timing on the React Native JS thread.
    listening = sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_NORMAL)
  }

  @ReactMethod
  fun stop() {
    if (!listening) return
    sensorManager.unregisterListener(this)
    listening = false
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
    if (listenerCount == 0) stop()
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (!listening || listenerCount <= 0 || event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
    val rotationMatrix = FloatArray(9)
    val orientation = FloatArray(3)
    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
    SensorManager.getOrientation(rotationMatrix, orientation)
    val toDegrees = 180.0 / PI
    val payload = Arguments.createMap().apply {
      putDouble("heading", ((orientation[0] * toDegrees) + 360.0) % 360.0)
      putDouble("pitch", orientation[1] * toDegrees)
      putDouble("roll", orientation[2] * toDegrees)
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("AutoPulseMotion", payload)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  override fun onHostResume() = Unit
  override fun onHostPause() = Unit
  override fun onHostDestroy() = stop()
}
