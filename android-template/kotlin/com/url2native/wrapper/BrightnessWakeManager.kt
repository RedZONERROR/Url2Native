package com.url2native.wrapper

import android.app.Activity
import android.provider.Settings
import android.view.WindowManager

class BrightnessWakeManager(private val enabled: Boolean) {

    fun applyKeepScreenOn(activity: Activity) {
        if (!enabled) return
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    fun onResume(activity: Activity) {
        if (!enabled) return
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val currentBrightness = try {
            Settings.System.getInt(
                activity.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS
            )
        } catch (_: Settings.SettingNotFoundException) {
            -1
        }

        if (currentBrightness in 0..255) {
            val normalized = (currentBrightness / 255.0f).coerceIn(0.05f, 1.0f)
            val attrs = activity.window.attributes
            attrs.screenBrightness = normalized
            activity.window.attributes = attrs
        }
    }

    fun onPause(activity: Activity) {
        if (!enabled) return
        val attrs = activity.window.attributes
        attrs.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        activity.window.attributes = attrs
    }
}
