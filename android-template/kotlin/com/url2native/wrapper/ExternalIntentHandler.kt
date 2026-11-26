package com.url2native.wrapper

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import java.net.URISyntaxException

object ExternalIntentHandler {

    fun shouldHandleExternally(uri: Uri, config: Url2NativeConfig): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false

        if (scheme in setOf("about", "blob", "data", "javascript", "tauri")) {
            return false
        }

        val host = uri.host?.lowercase() ?: ""
        if (host == "tauri.localhost") {
            return false
        }

        if (config.externalSchemes.any { it.equals(scheme, ignoreCase = true) }) {
            return true
        }

        if (scheme != "http" && scheme != "https") {
            return true
        }

        if (config.keepExternalDomainsInApp) {
            return false
        }

        val rootHost = Uri.parse(config.appUrl).host?.lowercase() ?: ""
        if (hostMatches(host, rootHost)) {
            return false
        }

        if (config.allowedDomains.any { hostMatches(host, it) }) {
            return false
        }

        return true
    }

    fun handleUrl(
        context: Context,
        webView: WebView?,
        uri: Uri,
        config: Url2NativeConfig
    ): Boolean {
        if (!shouldHandleExternally(uri, config)) {
            return false
        }

        val rawUrl = uri.toString()
        if (uri.scheme.equals("intent", ignoreCase = true)) {
            return handleIntentScheme(context, webView, rawUrl)
        }

        return try {
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            true
        } catch (_: SecurityException) {
            true
        }
    }

    private fun handleIntentScheme(context: Context, webView: WebView?, rawUrl: String): Boolean {
        return try {
            val intent = Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                component = null
                selector = null
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                context.startActivity(intent)
            } catch (_: ActivityNotFoundException) {
                val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                if (!fallbackUrl.isNullOrBlank()) {
                    if (fallbackUrl.startsWith("http://") || fallbackUrl.startsWith("https://")) {
                        webView?.loadUrl(fallbackUrl)
                    } else {
                        val fallbackIntent = Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        try {
                            context.startActivity(fallbackIntent)
                        } catch (_: ActivityNotFoundException) {
                            // No handler installed for fallback URI.
                        }
                    }
                }
            }
            true
        } catch (_: URISyntaxException) {
            true
        }
    }

    private fun hostMatches(host: String, domain: String): Boolean {
        val h = host.removePrefix("www.").lowercase()
        val d = domain.removePrefix("*.").removePrefix("www.").lowercase()
        if (h.isEmpty() || d.isEmpty()) return false
        return h == d || h.endsWith(".$d")
    }
}
