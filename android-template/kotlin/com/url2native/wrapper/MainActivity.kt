package com.url2native.wrapper

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
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
    private var containersAttached: Boolean = false

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
                        isEnabled = true
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
        WebViewConfigurator.flushCookies()
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
            enabled = appConfig.pullToRefresh
        )
        pullToRefreshWrapper = ptrWrapper

        val navBarView = NavigationBarController.createView(
            context = this,
            config = appConfig,
            webView = webView,
            errorOverlayController = errorController
        )

        wrapWebViewClient(webView, ptrWrapper, errorController)
        attachDownloadListener(webView)
        webView.post {
            if (!isFinishing && !isDestroyed) {
                attachContainers(webView, ptrWrapper, errorController, navBarView)
            }
        }
    }

    private fun attachDownloadListener(webView: WebView) {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.isNullOrBlank()) return@setDownloadListener
            val uri = Uri.parse(url)
            val scheme = uri.scheme?.lowercase() ?: ""
            if (scheme != "http" && scheme != "https") {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (_: Exception) {
                    // Ignore unsupported download URIs.
                }
                return@setDownloadListener
            }

            try {
                val guessed = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val safeFilename = java.io.File(guessed).name.ifBlank { "download" }
                val request = DownloadManager.Request(uri).apply {
                    if (!mimeType.isNullOrBlank()) {
                        setMimeType(mimeType)
                    }
                    val cookies = CookieManager.getInstance().getCookie(url)
                    if (!cookies.isNullOrEmpty()) {
                        addRequestHeader("Cookie", cookies)
                    }
                    if (!userAgent.isNullOrBlank()) {
                        addRequestHeader("User-Agent", userAgent)
                    }
                    setTitle(safeFilename)
                    setDescription(appConfig.appName)
                    setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeFilename)
                }

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                if (dm != null) {
                    dm.enqueue(request)
                    Toast.makeText(this, "Downloading $safeFilename", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (_: Exception) {
                    // Ignore if no handler exists.
                }
            }
        }
    }

    private fun attachContainers(
        webView: WebView,
        ptrWrapper: PullToRefreshWrapper,
        errorController: ErrorOverlayController,
        navBarView: View?
    ) {
        if (containersAttached) return
        containersAttached = true

        val parent = webView.parent as? ViewGroup
        val index = parent?.indexOfChild(webView) ?: -1
        val originalParams = webView.layoutParams ?: ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        parent?.removeView(webView)

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

        val webContainer: View = ptrWrapper.wrap(webView)
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

        if (parent != null && index >= 0) {
            parent.addView(rootContainer, index)
        } else {
            setContentView(rootContainer)
        }

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

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (view != null && request != null) {
                    return existingClient.shouldInterceptRequest(view, request)
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                if (ExternalIntentHandler.handleUrl(this@MainActivity, view, uri, appConfig)) {
                    return true
                }
                if (view != null && request != null) {
                    return existingClient.shouldOverrideUrlLoading(view, request)
                }
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                hasMainFrameError = false
                WebViewConfigurator.updateCacheMode(this@MainActivity, webView, appConfig)
                if (view != null && url != null) {
                    existingClient.onPageStarted(view, url, favicon)
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                ptrWrapper.finishRefreshing()
                if (!hasMainFrameError) {
                    errorController.hideError()
                }
                if (view != null && url != null) {
                    existingClient.onPageFinished(view, url)
                }
            }

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                if (view != null && url != null) {
                    existingClient.onPageCommitVisible(view, url)
                }
            }

            override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                if (view != null && url != null) {
                    existingClient.doUpdateVisitedHistory(view, url, isReload)
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                if (view != null && handler != null && error != null) {
                    existingClient.onReceivedSslError(view, handler, error)
                } else {
                    super.onReceivedSslError(view, handler, error)
                }
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
                if (view != null && request != null && error != null) {
                    existingClient.onReceivedError(view, request, error)
                }
            }
        }
    }
}
