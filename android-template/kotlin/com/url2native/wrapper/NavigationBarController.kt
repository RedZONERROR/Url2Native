package com.url2native.wrapper

import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout

object NavigationBarController {

    fun createView(
        context: Context,
        config: Url2NativeConfig,
        webView: WebView,
        errorOverlayController: ErrorOverlayController
    ): View? {
        val nav = config.navigation
        if (!nav.enabled || nav.buttons.isEmpty()) {
            return null
        }

        val bgColor = parseColorOrDefault(nav.backgroundColor, Color.parseColor("#111827"))
        val fgColor = parseColorOrDefault(nav.iconColor, Color.WHITE)

        val bar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(bgColor)
            val verticalPad = dpToPx(context, 6)
            setPadding(dpToPx(context, 8), verticalPad, dpToPx(context, 8), verticalPad)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        for (item in nav.buttons) {
            val button = Button(context, null, android.R.attr.borderlessButtonStyle).apply {
                text = item.label
                isAllCaps = false
                setTextColor(fgColor)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                minHeight = dpToPx(context, 44)
                minWidth = dpToPx(context, 44)
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    1f
                )
                setOnClickListener {
                    errorOverlayController.hideError()
                    if (!item.url.isNullOrBlank()) {
                        webView.loadUrl(item.url)
                    } else {
                        when (item.action) {
                            "back" -> if (webView.canGoBack()) webView.goBack()
                            "forward" -> if (webView.canGoForward()) webView.goForward()
                            "home" -> webView.loadUrl(config.appUrl)
                            "reload" -> webView.reload()
                        }
                    }
                }
            }
            bar.addView(button)
        }

        return bar
    }

    private fun parseColorOrDefault(hex: String, fallback: Int): Int {
        return try {
            Color.parseColor(hex)
        } catch (_: IllegalArgumentException) {
            fallback
        }
    }

    private fun dpToPx(context: Context, dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
