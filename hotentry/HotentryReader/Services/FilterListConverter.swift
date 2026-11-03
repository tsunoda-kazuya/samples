import Foundation

/// Safari コンテンツブロッカー (WKContentRuleList) の 1 ルール
struct ContentRule: Encodable, Sendable {
    struct Trigger: Encodable, Sendable {
        var urlFilter: String
        var resourceType: [String]?
        var loadType: [String]?
        var ifDomain: [String]?
        var unlessDomain: [String]?
        var caseSensitive: Bool?

        enum CodingKeys: String, CodingKey {
            case urlFilter = "url-filter"
            case resourceType = "resource-type"
            case loadType = "load-type"
            case ifDomain = "if-domain"
            case unlessDomain = "unless-domain"
            case caseSensitive = "url-filter-is-case-sensitive"
        }
    }

    struct Action: Encodable, Sendable {
        var type: String
        var selector: String?
    }

    var trigger: Trigger
    var action: Action
}

struct ConvertedFilters: Sendable {
    /// 通信ブロック
    var blocking: [ContentRule] = []
    /// 通信ブロックの例外 (@@)。blocking と同じリストの末尾に置く必要がある
    var blockingExceptions: [ContentRule] = []
    /// 要素の非表示 (##)
    var hiding: [ContentRule] = []
    /// 要素非表示の例外 (@@...$elemhide / $document)
    var hidingExceptions: [ContentRule] = []
    var skipped = 0

    var totalCount: Int { blocking.count + hiding.count }
}

/// Adblock Plus 形式のフィルタリスト (EasyList 等) を WKContentRuleList 形式に変換する。
/// Adblock Plus の iOS 版も同じ方式 (リストを Safari のコンテンツブロッカー形式に変換) で動いている。
/// WebKit で表現できない構文 (正規表現ルール・拡張 CSS・スクリプト注入など) は読み飛ばす。
enum FilterListConverter {
    static func convert(_ text: String) -> ConvertedFilters {
        var result = ConvertedFilters()
        var genericSelectors: [String] = []
        var seenGeneric = Set<String>()
        var domainSelectors: [String: [String]] = [:]   // "a.com,b.com" -> selectors
        var domainSelectorOrder: [String] = []
        var seenNetwork = Set<String>()

        for raw in text.split(whereSeparator: \.isNewline) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("!") || line.hasPrefix("[") { continue }

            // WebKit で扱えない拡張構文
            if unsupportedMarkers.contains(where: { line.contains($0) }) {
                result.skipped += 1
                continue
            }

            if let range = line.range(of: "##") {
                let domainPart = String(line[..<range.lowerBound])
                let selector = String(line[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                guard isSupportedSelector(selector) else { result.skipped += 1; continue }

                if domainPart.isEmpty {
                    if seenGeneric.insert(selector).inserted { genericSelectors.append(selector) }
                } else {
                    let (include, exclude) = parseDomains(domainPart, separator: ",")
                    if !include.isEmpty {
                        let key = include.sorted().joined(separator: ",")
                        if domainSelectors[key] == nil { domainSelectorOrder.append(key) }
                        domainSelectors[key, default: []].append(selector)
                    } else if !exclude.isEmpty {
                        var trigger = ContentRule.Trigger(urlFilter: ".*")
                        trigger.unlessDomain = exclude.map { "*" + $0 }
                        result.hiding.append(.init(trigger: trigger, action: .init(type: "css-display-none", selector: selector)))
                    } else {
                        result.skipped += 1
                    }
                }
                continue
            }

            guard let converted = convertNetworkRule(line) else { result.skipped += 1; continue }
            switch converted {
            case .block(let rule):
                if seenNetwork.insert(rule.trigger.urlFilter + "|" + (rule.trigger.resourceType?.joined() ?? "") + (rule.trigger.ifDomain?.joined() ?? "")).inserted {
                    result.blocking.append(rule)
                }
            case .exception(let rule):
                result.blockingExceptions.append(rule)
            case .pageException(let rule):
                result.blockingExceptions.append(rule)
                result.hidingExceptions.append(rule)
            case .hidingException(let rule):
                result.hidingExceptions.append(rule)
            }
        }

        // 汎用セレクタはまとめて 1 ルールに (多すぎると遅いので 250 件ずつ)
        stride(from: 0, to: genericSelectors.count, by: 250).forEach { i in
            let chunk = genericSelectors[i..<min(i + 250, genericSelectors.count)]
            result.hiding.append(.init(trigger: .init(urlFilter: ".*"),
                                       action: .init(type: "css-display-none", selector: chunk.joined(separator: ", "))))
        }
        for key in domainSelectorOrder {
            var trigger = ContentRule.Trigger(urlFilter: ".*")
            trigger.ifDomain = key.split(separator: ",").map { "*" + $0 }
            let selectors = domainSelectors[key]!
            stride(from: 0, to: selectors.count, by: 100).forEach { i in
                let chunk = selectors[i..<min(i + 100, selectors.count)]
                result.hiding.append(.init(trigger: trigger,
                                           action: .init(type: "css-display-none", selector: chunk.joined(separator: ", "))))
            }
        }
        return result
    }

    // MARK: - Network rules

    enum NetworkRule {
        case block(ContentRule)
        case exception(ContentRule)
        case pageException(ContentRule)     // @@...$document: そのサイトではブロックしない
        case hidingException(ContentRule)   // @@...$elemhide: そのサイトでは要素を隠さない
    }

    static func convertNetworkRule(_ line: String) -> NetworkRule? {
        var rule = line
        var isException = false
        if rule.hasPrefix("@@") {
            isException = true
            rule.removeFirst(2)
        }
        // 正規表現ルール /.../ は WebKit の正規表現と互換性がないため対象外
        if rule.hasPrefix("/") && (rule.hasSuffix("/") || rule.contains("/$")) { return nil }

        var pattern = rule
        var options: [Substring] = []
        if let dollar = rule.lastIndex(of: "$") {
            pattern = String(rule[..<dollar])
            options = rule[rule.index(after: dollar)...].split(separator: ",")
        }

        var types = Set<String>()
        var loadType: String?
        var include: [String] = []
        var exclude: [String] = []
        var caseSensitive = false
        var documentException = false
        var hidingException = false

        for opt in options {
            let o = opt.lowercased()
            switch o {
            case "third-party", "3p": loadType = "third-party"
            case "~third-party", "first-party", "1p", "~3p": loadType = "first-party"
            case "script": types.insert("script")
            case "image": types.insert("image")
            case "stylesheet", "css": types.insert("style-sheet")
            case "font": types.insert("font")
            case "media": types.insert("media")
            case "xmlhttprequest", "xhr", "websocket", "ping", "other", "object", "object-subrequest":
                types.insert("raw")
            case "subdocument", "frame": types.insert("document")
            case "popup": types.insert("popup")
            case "document", "doc":
                if isException { documentException = true } else { types.insert("document") }
            case "elemhide", "ehide", "generichide", "ghide":
                guard isException else { return nil }
                hidingException = true
            case "match-case": caseSensitive = true
            case "important", "all": break
            default:
                if o.hasPrefix("domain=") {
                    let (inc, exc) = parseDomains(String(opt.dropFirst("domain=".count)), separator: "|")
                    include = inc
                    exclude = exc
                    if inc.isEmpty && exc.isEmpty { return nil }
                } else {
                    // csp= / redirect= / removeparam / rewrite= などは表現できない
                    return nil
                }
            }
        }

        // ページ単位の例外: パターンのホスト名を if-domain にする
        if isException && (documentException || hidingException) {
            guard let host = hostOf(pattern) else { return nil }
            var trigger = ContentRule.Trigger(urlFilter: ".*")
            trigger.ifDomain = ["*" + host]
            let r = ContentRule(trigger: trigger, action: .init(type: "ignore-previous-rules"))
            return documentException ? .pageException(r) : .hidingException(r)
        }

        guard let regex = regex(fromPattern: pattern) else { return nil }
        // ドメインやタイプの指定がない「何にでも一致」するルールは危険なので除外
        if regex == ".*" && include.isEmpty && types.isEmpty { return nil }

        var trigger = ContentRule.Trigger(urlFilter: regex)
        if !types.isEmpty { trigger.resourceType = types.sorted() }
        if let loadType { trigger.loadType = [loadType] }
        if !include.isEmpty {
            trigger.ifDomain = include.map { "*" + $0 }
        } else if !exclude.isEmpty {
            trigger.unlessDomain = exclude.map { "*" + $0 }
        }
        if caseSensitive { trigger.caseSensitive = true }

        if isException {
            return .exception(ContentRule(trigger: trigger, action: .init(type: "ignore-previous-rules")))
        }
        return .block(ContentRule(trigger: trigger, action: .init(type: "block")))
    }

    /// Adblock Plus のパターンを WebKit が解釈できる正規表現に変換
    static func regex(fromPattern pattern: String) -> String? {
        guard pattern.allSatisfy({ $0.isASCII }) else { return nil }
        var p = Substring(pattern)
        var out = ""
        if p.hasPrefix("||") {
            out = "^[^:]+://+([^:/]+\\.)?"
            p = p.dropFirst(2)
        } else if p.hasPrefix("|") {
            out = "^"
            p = p.dropFirst()
        }
        var anchoredEnd = false
        if p.hasSuffix("|") {
            anchoredEnd = true
            p = p.dropLast()
        }
        if p.contains("|") { return nil }

        for ch in p {
            switch ch {
            case "*": out += ".*"
            case "^": out += "[/:?&=]"
            case ".", "+", "?", "(", ")", "[", "]", "{", "}", "\\", "$":
                out += "\\" + String(ch)
            default: out.append(ch)
            }
        }
        if anchoredEnd { out += "$" }

        while out.hasPrefix(".*") { out.removeFirst(2) }
        while out.hasSuffix(".*") { out.removeLast(2) }
        if out.isEmpty { return ".*" }
        // 先頭固定でない短すぎるパターンは誤爆が多い
        if !out.hasPrefix("^") && out.count < 4 { return nil }
        return out
    }

    // MARK: - Helpers

    private static let unsupportedMarkers = [
        "#@#", "#?#", "#$#", "#%#", "#@$#", "#@?#", "#@%#", "##+js", "##^", "$$", "$@$", "#+js",
    ]

    private static let unsupportedSelectorParts = [
        ":-abp-", ":has(", ":has-text", ":contains", ":xpath", ":matches-", ":style(", ":remove(",
        ":upward", "[-ext-", ":watch-attr", ":min-text-length", ":nth-ancestor", ":if(", ":if-not",
        ":others", ":remove-attr", ":remove-class", ":shadow", ":-webkit-any",
    ]

    static func isSupportedSelector(_ selector: String) -> Bool {
        guard !selector.isEmpty, !selector.hasPrefix("+js") else { return false }
        let lower = selector.lowercased()
        if unsupportedSelectorParts.contains(where: { lower.contains($0) }) { return false }
        // 括弧やクォートが閉じていないものは WebKit のコンパイルを失敗させるので除外
        var depth = 0, bracket = 0
        var quote: Character?
        for ch in selector {
            if let q = quote { if ch == q { quote = nil }; continue }
            switch ch {
            case "\"", "'": quote = ch
            case "(": depth += 1
            case ")": depth -= 1
            case "[": bracket += 1
            case "]": bracket -= 1
            default: break
            }
            if depth < 0 || bracket < 0 { return false }
        }
        return depth == 0 && bracket == 0 && quote == nil
    }

    /// "a.com,~b.a.com" → (["a.com"], ["b.a.com"])
    static func parseDomains(_ text: String, separator: Character) -> (include: [String], exclude: [String]) {
        var include: [String] = []
        var exclude: [String] = []
        for part in text.split(separator: separator) {
            var d = part.trimmingCharacters(in: .whitespaces).lowercased()
            let negated = d.hasPrefix("~")
            if negated { d.removeFirst() }
            // ワイルドカード TLD (example.*) や IDN は WebKit で表現できない
            guard !d.isEmpty, !d.contains("*"), !d.contains("/"),
                  d.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "." || $0 == "-") })
            else { continue }
            if negated { exclude.append(d) } else { include.append(d) }
        }
        return (include, exclude)
    }

    /// "||example.com^" → "example.com"
    static func hostOf(_ pattern: String) -> String? {
        var p = Substring(pattern)
        if p.hasPrefix("||") { p = p.dropFirst(2) } else if p.hasPrefix("|") {
            p = p.dropFirst()
            if let r = p.range(of: "://") { p = p[r.upperBound...] }
        } else { return nil }
        let host = p.prefix { $0.isLetter || $0.isNumber || $0 == "." || $0 == "-" }.lowercased()
        return host.contains(".") && host.allSatisfy(\.isASCII) ? host : nil
    }
}
