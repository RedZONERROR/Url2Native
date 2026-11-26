package com.url2native.wrapper

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import org.json.JSONObject

data class NavButtonConfig(
    val label: String,
    val action: String?,
    val url: String?
)

data class NavigationConfig(
    val enabled: Boolean,
    val position: String,
    val backgroundColor: String,
    val iconColor: String,
    val buttons: List<NavButtonConfig>
)

data class Url2NativeConfig(
    val appName: String,
    val appUrl: String,
    val userAgentMode: String,
    val userAgentValue: String,
    val pullToRefresh: Boolean,
    val smartCache: Boolean,
    val hardwareAcceleration: Boolean,
    val preventBrightnessDrop: Boolean,
    val externalSchemes: List<String>,
    val keepExternalDomainsInApp: Boolean,
    val allowedDomains: List<String>,
    val navigation: NavigationConfig
) {
    companion object {
        fun load(context: Context): Url2NativeConfig {
            val jsonText = context.assets.open("app.config.json")
                .bufferedReader()
                .use { it.readText() }
            val root = JSONObject(jsonText)
            val app = root.getJSONObject("app")
            val ua = root.getJSONObject("userAgent")
            val behavior = root.getJSONObject("behavior")
            val nav = root.getJSONObject("navigation")

            val schemes = mutableListOf<String>()
            val schemesArr = behavior.getJSONArray("externalSchemes")
            for (i in 0 until schemesArr.length()) {
                schemes.add(schemesArr.getString(i))
            }

            val allowed = mutableListOf<String>()
            val allowedArr = behavior.getJSONArray("allowedDomains")
            for (i in 0 until allowedArr.length()) {
                allowed.add(allowedArr.getString(i))
            }

            val buttons = mutableListOf<NavButtonConfig>()
            val btnArr = nav.getJSONArray("buttons")
            for (i in 0 until btnArr.length()) {
                val obj = btnArr.getJSONObject(i)
                buttons.add(
                    NavButtonConfig(
                        label = obj.getString("label"),
                        action = if (obj.has("action") && !obj.isNull("action")) obj.getString("action") else null,
                        url = if (obj.has("url") && !obj.isNull("url")) obj.getString("url") else null
                    )
                )
            }

            return Url2NativeConfig(
                appName = app.getString("name"),
                appUrl = app.getString("url"),
                userAgentMode = ua.getString("mode"),
                userAgentValue = ua.optString("value", ""),
                pullToRefresh = behavior.getBoolean("pullToRefresh"),
                smartCache = behavior.getBoolean("smartCache"),
                hardwareAcceleration = behavior.getBoolean("hardwareAcceleration"),
                preventBrightnessDrop = behavior.getBoolean("preventBrightnessDrop"),
                externalSchemes = schemes,
                keepExternalDomainsInApp = behavior.getBoolean("keepExternalDomainsInApp"),
                allowedDomains = allowed,
                navigation = NavigationConfig(
                    enabled = nav.getBoolean("enabled"),
                    position = nav.getString("position"),
                    backgroundColor = nav.getString("backgroundColor"),
                    iconColor = nav.getString("iconColor"),
                    buttons = buttons
                )
            )
        }
    }
}

object WebViewConfigurator {

    @SuppressLint("SetJavaScriptEnabled")
    fun configure(context: Context, webView: WebView, config: Url2NativeConfig) {
        if (config.hardwareAcceleration) {
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        } else {
            webView.setLayerType(View.LAYER_TYPE_NONE, null)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false

            when (config.userAgentMode.lowercase()) {
                "replace" -> {
                    if (config.userAgentValue.isNotBlank()) {
                        userAgentString = config.userAgentValue
                    }
                }
                "append" -> {
                    val defaultUa = WebSettings.getDefaultUserAgent(context)
                    val suffix = config.userAgentValue.trim()
                    if (suffix.isNotEmpty() && !defaultUa.contains(suffix)) {
                        userAgentString = "$defaultUa $suffix"
                    }
                }
                else -> {
                    // Preserve default system WebView User-Agent.
                }
            }
        }

        updateCacheMode(context, webView, config)
    }

    fun updateCacheMode(context: Context, webView: WebView, config: Url2NativeConfig) {
        if (!config.smartCache) {
            webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
            return
        }
        val online = isNetworkAvailable(context)
        webView.settings.cacheMode = if (online) {
            WebSettings.LOAD_DEFAULT
        } else {
            WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
    }

    fun isNetworkAvailable(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
