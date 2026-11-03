import SwiftUI
import WebKit
import Combine

/// 記事表示用 WKWebView の状態管理
@MainActor
final class WebViewModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published private(set) var webView: WKWebView?
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var progress: Double = 0
    @Published var isLoading = false
    @Published var title: String?
    @Published var url: URL?

    struct Options: Equatable {
        var adBlock: Bool
        var javaScript: Bool
        var extraDomains: [String]
    }

    func setup(url initialURL: URL, options: Options) async {
        guard webView == nil else { return }

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = .all
        config.defaultWebpagePreferences.allowsContentJavaScript = options.javaScript
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        if options.adBlock {
            if let list = await AdBlocker.shared.ruleList(extraDomains: options.extraDomains) {
                config.userContentController.add(list)
            }
            config.userContentController.addUserScript(AdBlocker.cleanupScript)
        }

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.allowsBackForwardNavigationGestures = true
        wv.allowsLinkPreview = true
        wv.navigationDelegate = self
        wv.uiDelegate = self

        wv.publisher(for: \.canGoBack).receive(on: RunLoop.main).assign(to: &$canGoBack)
        wv.publisher(for: \.canGoForward).receive(on: RunLoop.main).assign(to: &$canGoForward)
        wv.publisher(for: \.estimatedProgress).receive(on: RunLoop.main).assign(to: &$progress)
        wv.publisher(for: \.isLoading).receive(on: RunLoop.main).assign(to: &$isLoading)
        wv.publisher(for: \.title).receive(on: RunLoop.main).assign(to: &$title)
        wv.publisher(for: \.url).receive(on: RunLoop.main).assign(to: &$url)

        webView = wv
        wv.load(URLRequest(url: initialURL))
    }

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
    func reload() { webView?.reload() }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            return .cancel
        }
        let userTapped = navigationAction.navigationType == .linkActivated
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true

        if ["http", "https", "about", "data", "blob", "javascript"].contains(scheme) {
            // 広告による勝手な App Store 遷移を防ぐ
            if isMainFrame, !userTapped, let host = url.host,
               host.hasSuffix("apps.apple.com") || host.hasSuffix("itunes.apple.com") {
                return .cancel
            }
            return .allow
        }
        // itms-apps:// や twitter:// などの外部スキームはタップされた時だけ開く
        if userTapped {
            _ = await UIApplication.shared.open(url)
        }
        return .cancel
    }

    // MARK: - WKUIDelegate

    /// target="_blank" のリンクは同じ画面で開き、スクリプトによるポップアップは無視する
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, navigationAction.navigationType == .linkActivated {
            webView.load(navigationAction.request)
        }
        return nil
    }
}

struct WebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
