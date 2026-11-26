package com.url2native.wrapper

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class PullToRefreshWrapper(
    private val context: Context,
    private val enabled: Boolean
) {
    private var swipeRefreshLayout: SwipeRefreshLayout? = null

    fun wrap(webView: WebView): View {
        if (!enabled) {
            return webView
        }

        // Ensure the WebView is detached from any previous parent before adding to SwipeRefreshLayout.
        (webView.parent as? ViewGroup)?.removeView(webView)

        val layout = SwipeRefreshLayout(context).apply {
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

            addView(
                webView,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
        }
        swipeRefreshLayout = layout
        return layout
    }

    fun finishRefreshing() {
        swipeRefreshLayout?.isRefreshing = false
    }
}
