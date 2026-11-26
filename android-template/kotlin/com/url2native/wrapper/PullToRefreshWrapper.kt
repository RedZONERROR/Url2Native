package com.url2native.wrapper

import android.content.Context
import android.view.ViewGroup
import android.webkit.WebView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class PullToRefreshWrapper(
    context: Context,
    private val webView: WebView,
    enabled: Boolean
) {
    val containerView: SwipeRefreshLayout? = if (enabled) {
        SwipeRefreshLayout(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            // Only trigger pull-to-refresh when the WebView is scrolled to the very top.
            setOnChildScrollUpCallback { _, _ ->
                webView.scrollY > 0
            }

            setOnRefreshListener {
                webView.reload()
            }
        }
    } else {
        null
    }

    fun attachWebView() {
        val container = containerView ?: return
        if (webView.parent === container) return
        (webView.parent as? ViewGroup)?.removeView(webView)
        container.addView(
            webView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
    }

    fun finishRefreshing() {
        containerView?.isRefreshing = false
    }
}
