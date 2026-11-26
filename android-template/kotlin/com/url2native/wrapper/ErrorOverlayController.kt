package com.url2native.wrapper

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.annotation.Keep

class ErrorOverlayController(
    context: Context,
    private val mainWebView: WebView,
    private val defaultUrl: String
) {
    private var lastFailedUrl: String = defaultUrl

    @SuppressLint("SetJavaScriptEnabled")
    val overlayView: WebView = WebView(context).apply {
        visibility = View.GONE
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        addJavascriptInterface(ErrorBridge(), "Url2NativeError")
        loadUrl("file:///android_asset/offline.html")
    }

    fun showError(failedUrl: String?) {
        if (!failedUrl.isNullOrBlank()) {
            lastFailedUrl = failedUrl
        }
        overlayView.post {
            overlayView.visibility = View.VISIBLE
        }
    }

    fun hideError() {
        overlayView.post {
            if (overlayView.visibility != View.GONE) {
                overlayView.visibility = View.GONE
            }
        }
    }

    fun retry() {
        overlayView.post {
            overlayView.visibility = View.GONE
            val target = lastFailedUrl.ifBlank { defaultUrl }
            mainWebView.loadUrl(target)
        }
    }

    @Keep
    private inner class ErrorBridge {
        @Keep
        @JavascriptInterface
        fun retry() {
            this@ErrorOverlayController.retry()
        }
    }
}
