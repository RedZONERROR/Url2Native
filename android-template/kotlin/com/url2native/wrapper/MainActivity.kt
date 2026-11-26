package com.url2native.wrapper

import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import __PACKAGE_ID__.TauriActivity

open class MainActivity : TauriActivity() {

    private lateinit var appConfig: Url2NativeConfig
    private lateinit var brightnessWakeManager: BrightnessWakeManager
    private var activeWebView: WebView? = null
    private var pullToRefreshWrapper: PullToRefreshWrapper? = null
    private var errorOverlayController: ErrorOverlayController? = null
    private var hasMainFrameError: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        appConfig = Url2NativeConfig.load(this)
        brightnessWakeManager = BrightnessWakeManager(appConfig.preventBrightnessDrop)

        super.onCreate(savedInstanceState)

        // Enable edge-to-edge layout across Android 10-17 (API 29-37).
        WindowCompat.setDecorFitsSystemWindows(window, false)
        brightnessWakeManager.applyKeepScreenOn(this)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val webView = activeWebView
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        )
    }

    override fun onResume() {
        super.onResume()
        brightnessWakeManager.onResume(this)
        activeWebView?.let { webView ->
            WebViewConfigurator.updateCacheMode(this, webView, appConfig)
        }
    }

    override fun onPause() {
        brightnessWakeManager.onPause(this)
        super.onPause()
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        activeWebView = webView

        WebViewConfigurator.configure(this, webView, appConfig)

        val errorController = ErrorOverlayController(this, webView, appConfig.appUrl)
        errorOverlayController = errorController

        val ptrWrapper = PullToRefreshWrapper(
            context = this,
            webView = webView,
            enabled = appConfig.pullToRefresh
        )
        pullToRefreshWrapper = ptrWrapper

        val navBarView = NavigationBarController.createView(
            context = this,
            config = appConfig,
            webView = webView,
            errorOverlayController = errorController
        )

        attachContainers(webView, ptrWrapper, errorController, navBarView)
        wrapWebViewClient(webView, ptrWrapper, errorController)
    }

    private fun attachContainers(
        webView: WebView,
        ptrWrapper: PullToRefreshWrapper,
        errorController: ErrorOverlayController,
        navBarView: View?
    ) {
        val parent = webView.parent as? ViewGroup ?: return
        val index = parent.indexOfChild(webView)
        val originalParams = webView.layoutParams
        parent.removeView(webView)

        val rootContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = originalParams
        }

        val contentFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }

        val webContainer: View = ptrWrapper.containerView ?: webView
        contentFrame.addView(
            webContainer,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        contentFrame.addView(errorController.overlayView)

        val navAtTop = appConfig.navigation.enabled &&
            appConfig.navigation.position.equals("top", ignoreCase = true)

        if (navBarView != null && navAtTop) {
            rootContainer.addView(navBarView)
            rootContainer.addView(contentFrame)
        } else {
            rootContainer.addView(contentFrame)
            if (navBarView != null) {
                rootContainer.addView(navBarView)
            }
        }

        parent.addView(rootContainer, index)

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            windowInsets
        }
    }

    private fun wrapWebViewClient(
        webView: WebView,
        ptrWrapper: PullToRefreshWrapper,
        errorController: ErrorOverlayController
    ) {
        val existingClient = webView.webViewClient
        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                if (ExternalIntentHandler.handleUrl(this@MainActivity, view, uri, appConfig)) {
                    return true
                }
                return existingClient.shouldOverrideUrlLoading(view, request)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                hasMainFrameError = false
                WebViewConfigurator.updateCacheMode(this@MainActivity, webView, appConfig)
                existingClient.onPageStarted(view, url, favicon)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                ptrWrapper.finishRefreshing()
                if (!hasMainFrameError) {
                    errorController.hideError()
                }
                existingClient.onPageFinished(view, url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                // Only show the branded offline overlay for main-frame network errors.
                val desc = error?.description?.toString() ?: ""
                val isAborted = desc.contains("ERR_ABORTED", ignoreCase = true)
                if (request?.isForMainFrame == true && !isAborted) {
                    hasMainFrameError = true
                    ptrWrapper.finishRefreshing()
                    errorController.showError(request.url?.toString())
                    return
                }
                existingClient.onReceivedError(view, request, error)
            }
        }
    }
}
