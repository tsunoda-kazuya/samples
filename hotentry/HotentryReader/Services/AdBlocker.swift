import Foundation
import WebKit

/// WKContentRuleList による広告ブロック
/// - 広告/トラッキング配信ドメインへのサードパーティ通信を遮断
/// - よくある広告枠の要素を非表示 (css-display-none)
@MainActor
final class AdBlocker {
    static let shared = AdBlocker()

    private var cachedKey: String?
    private var cachedList: WKContentRuleList?

    /// 広告・トラッカー配信ドメイン (サブドメインも含めて遮断)
    static let blockedDomains: [String] = [
        // Google
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "googletagservices.com",
        "adservice.google.com", "adservice.google.co.jp", "google-analytics.com", "googletagmanager.com",
        "imasdk.googleapis.com", "fundingchoicesmessages.google.com",
        // 海外ネットワーク
        "amazon-adsystem.com", "adnxs.com", "criteo.com", "criteo.net", "taboola.com", "outbrain.com",
        "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com", "smartadserver.com",
        "adsrvr.org", "bidswitch.net", "33across.com", "sharethrough.com", "media.net", "moatads.com",
        "scorecardresearch.com", "quantserve.com", "teads.tv", "adform.net", "yieldmo.com", "seedtag.com",
        "unrulymedia.com", "adpushup.com", "browsiprod.com", "doubleverify.com", "adsafeprotected.com",
        "flashtalking.com", "3lift.com", "triplelift.com", "indexww.com", "lijit.com", "sonobi.com",
        "gumgum.com", "inmobi.com", "applovin.com", "vungle.com", "unityads.unity3d.com",
        // 国内ネットワーク
        "i-mobile.co.jp", "im-apps.net", "microad.jp", "microad.net", "microad.co.jp", "ad-stir.com",
        "adingo.jp", "fluct.jp", "gssprt.jp", "nend.net", "zucks.net", "impact-ad.jp", "yads.c.yimg.jp",
        "yads.yahoo.co.jp", "yads.yjtag.yahoo.co.jp", "s.yimg.jp/images/listing", "socdm.com",
        "ad-generation.jp", "popin.cc", "logly.co.jp", "uncn.jp", "genieesspv.jp", "gsspat.jp",
        "gsspcln.jp", "gmossp-sp.jp", "adlantis.jp", "relaido.jp", "fout.jp", "bypass.jp", "i2i.jp",
        "shinobi.jp", "ninja.co.jp", "admatrix.jp", "amoad.com", "adtdp.com", "yie.jp", "yieldone.com",
        "flux-cdn.com", "flux-adserver.com", "ladsp.com", "ad-m.asia", "trafficgate.net", "adjust-net.jp",
        "caprofitx.com", "dsp.logly.co.jp", "ads.pubmatic.com", "adapf.com", "smaad.net", "mediams.mb.softbank.jp",
        "ad.ad-arata.com", "adsby.bidtheatre.com", "ad.as.amanad.adtdp.com", "linkshare.ne.jp",
        "aja-recommend.com", "ad.yieldlab.net", "anymind360.com", "adpon.jp", "adcolony.com",
        "valuecommerce.com", "ad.jp.ap.valuecommerce.com", "track.affiliate-b.com",
    ]

    /// 非表示にする広告枠セレクタ
    static let hiddenSelectors: [String] = [
        "ins.adsbygoogle", ".adsbygoogle", "[id^='google_ads_']", "[id^='div-gpt-ad']",
        ".google-auto-placed", "iframe[src*='googlesyndication']", "iframe[src*='doubleclick']",
        "amp-ad", "amp-embed", "amp-sticky-ad",
        "[id^='taboola-']", ".trc_related_container", ".OUTBRAIN", "[data-widget-id^='AR_']",
        "._popIn_recommend", "#_popIn_recommend", ".logly-lift-ad",
        "[id^='yads']", ".yads_ad", "[id^='gn_interstitial']", "[id^='geniee']",
        "[id^='im-'][id$='-ad']", ".im_ad", ".microad", "[id^='microad']",
        ".ad-container", ".ad_container", ".ad-wrapper", ".ad_wrapper", ".adsense", ".ad-area", ".ad_area",
        ".ad-box", ".ad_box", ".ad-banner", ".ad_banner", ".ads-area", ".pr-area", ".sponsored-link",
        "[class^='adArea']", "[class*='_adArea']",
        // はてなブログ
        ".google-afc-user-container", ".google-afc-image", "#pc-billboard-ad", "#hatena-ad",
        // 追従フッター / オーバーレイ系
        "[class*='overlay-ad']", "[id*='overlay-ad']", "[class*='footer-ad']", "[id*='footer-ad']",
        "[class*='sticky-ad']", "[id*='sticky-ad']", "[class*='anchor-ad']",
    ]

    func ruleList(extraDomains: [String]) async -> WKContentRuleList? {
        let domains = Self.blockedDomains + extraDomains
        let json = Self.makeRulesJSON(domains: domains, selectors: Self.hiddenSelectors)
        let key = String(json.hashValue)
        if key == cachedKey, let cachedList { return cachedList }

        guard let store = WKContentRuleListStore.default() else { return nil }
        let list: WKContentRuleList? = await withCheckedContinuation { cont in
            store.compileContentRuleList(forIdentifier: "hotentry-adblock",
                                         encodedContentRuleList: json) { list, error in
                if let error { print("AdBlock compile error:", error) }
                cont.resume(returning: list)
            }
        }
        cachedKey = key
        cachedList = list
        return list
    }

    static func makeRulesJSON(domains: [String], selectors: [String]) -> String {
        var rules: [[String: Any]] = []
        for raw in Set(domains) {
            let d = raw.trimmingCharacters(in: .whitespaces).lowercased()
            guard !d.isEmpty, !d.hasPrefix("#") else { continue }
            guard d.allSatisfy({ $0.isLetter || $0.isNumber || "-./".contains($0) }) else { continue }
            let escaped = d.replacingOccurrences(of: ".", with: "\\.")
            // "domain/path" 形式はそのまま前方一致、ドメインのみならサブドメインも含めて一致
            let filter = d.contains("/")
                ? "^https?://([^/]+\\.)?\(escaped)"
                : "^https?://([^/:]+\\.)?\(escaped)[:/]"
            rules.append([
                "trigger": ["url-filter": filter, "load-type": ["third-party"]] as [String: Any],
                "action": ["type": "block"],
            ])
        }
        // セレクタは数が多いと 1 ルールが巨大になるので分割
        stride(from: 0, to: selectors.count, by: 20).forEach { i in
            let chunk = selectors[i..<min(i + 20, selectors.count)]
            rules.append([
                "trigger": ["url-filter": ".*"],
                "action": ["type": "css-display-none", "selector": chunk.joined(separator: ", ")],
            ])
        }
        let data = try! JSONSerialization.data(withJSONObject: rules)
        return String(decoding: data, as: UTF8.self)
    }

    /// ブロックされた広告が残す空白や、スクロール禁止オーバーレイを片付けるスクリプト
    static let cleanupScript = WKUserScript(source: """
    (function () {
      function clean() {
        // 追従型の広告オーバーレイ (画面下に固定された小さめの要素) を除去
        var adName = /(^|[\\s_-])(ad|ads|advert|advertisement|banner-ad|adarea)([\\s_-]|$)/i;
        function looksLikeAd(el) {
          if (el.querySelector('iframe, ins.adsbygoogle')) return true;
          var nodes = [el].concat(Array.prototype.slice.call(el.querySelectorAll('[id], [class]'), 0, 50));
          return nodes.some(function (n) { return adName.test((n.getAttribute('class') || '') + ' ' + (n.id || '')); });
        }
        document.querySelectorAll('body *').forEach(function (el) {
          var s = getComputedStyle(el);
          if (s.position === 'fixed' && el.offsetHeight > 0 &&
              el.offsetHeight < window.innerHeight * 0.35 && parseInt(s.bottom, 10) <= 0 &&
              !el.querySelector('nav, header, [role="navigation"]') && looksLikeAd(el)) {
            el.style.setProperty('display', 'none', 'important');
          }
        });
        // 広告インタースティシャルでスクロールがロックされた場合の解除
        [document.documentElement, document.body].forEach(function (el) {
          if (el && getComputedStyle(el).overflow === 'hidden') el.style.setProperty('overflow', 'auto', 'important');
        });
      }
      window.addEventListener('load', function () { setTimeout(clean, 800); setTimeout(clean, 3000); });
    })();
    """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
}
