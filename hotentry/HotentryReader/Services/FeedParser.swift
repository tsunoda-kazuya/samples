import Foundation

/// RSS 1.0 (RDF) / RSS 2.0 / Atom の汎用パーサ
final class FeedParser: NSObject, XMLParserDelegate {
    struct Result {
        var title: String?
        var entries: [Entry]
    }

    private var entries: [Entry] = []
    private var feedTitle: String?
    private var current: [String: String]?
    private var currentLink: String?
    private var currentImage: String?
    private var text = ""
    private let source: FeedSource?

    private init(source: FeedSource?) {
        self.source = source
    }

    static func parse(_ data: Data, source: FeedSource? = nil) -> Result {
        let delegate = FeedParser(source: source)
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.parse()
        return Result(title: delegate.feedTitle, entries: delegate.entries)
    }

    // MARK: XMLParserDelegate

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        text = ""
        switch elementName {
        case "item", "entry":
            current = [:]
            currentLink = nil
            currentImage = nil
            if let about = attributeDict["rdf:about"] { current?["about"] = about }
        case "link" where current != nil:
            // Atom: <link rel="alternate" href="..."/>
            if let href = attributeDict["href"], (attributeDict["rel"] ?? "alternate") == "alternate", currentLink == nil {
                currentLink = href
            }
        case "media:thumbnail", "media:content", "enclosure":
            guard current != nil, currentImage == nil, let url = attributeDict["url"] else { break }
            let type = attributeDict["type"] ?? attributeDict["medium"] ?? ""
            if elementName == "media:thumbnail" || type.hasPrefix("image") || Self.looksLikeImage(url) {
                currentImage = url
            }
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        text += string
    }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        text += String(decoding: CDATABlock, as: UTF8.self)
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?) {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        text = ""
        guard current != nil else {
            if elementName == "title", feedTitle == nil, !value.isEmpty { feedTitle = value }
            return
        }
        if elementName == "item" || elementName == "entry" {
            if let entry = makeEntry(current!) { entries.append(entry) }
            current = nil
        } else if !value.isEmpty, current?[elementName] == nil {
            current?[elementName] = value
        }
    }

    // MARK: Building entries

    private func makeEntry(_ d: [String: String]) -> Entry? {
        let linkText = currentLink ?? d["link"] ?? d["about"] ?? d["guid"] ?? ""
        guard let link = URL(string: linkText), link.scheme?.hasPrefix("http") == true else { return nil }

        let html = d["content:encoded"] ?? d["content"] ?? d["description"] ?? d["summary"] ?? ""
        let imageText = d["hatena:imageurl"] ?? currentImage ?? Self.firstImage(in: html)
        let summarySource = d["description"] ?? d["summary"] ?? ""

        return Entry(
            title: Self.decodeEntities(Self.stripTags(d["title"] ?? link.absoluteString)),
            link: link,
            summary: String(Self.decodeEntities(Self.stripTags(summarySource)).prefix(300)),
            date: Self.parseDate(d["dc:date"] ?? d["pubDate"] ?? d["published"] ?? d["updated"]),
            bookmarkCount: Int(d["hatena:bookmarkcount"] ?? "") ?? 0,
            imageURL: imageText.flatMap { $0.isEmpty ? nil : URL(string: $0) },
            commentPageURL: d["hatena:bookmarkCommentListPageUrl"].flatMap { URL(string: $0) },
            sourceName: source?.name,
            sourceID: source?.id.uuidString
        )
    }

    // MARK: Helpers

    private static let isoFormatter = ISO8601DateFormatter()
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let rfc822: [DateFormatter] = [
        "EEE, dd MMM yyyy HH:mm:ss Z", "EEE, d MMM yyyy HH:mm:ss Z", "dd MMM yyyy HH:mm:ss Z",
        "EEE, dd MMM yyyy HH:mm Z", "EEE, dd MMM yyyy HH:mm:ss zzz",
    ].map {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = $0
        return f
    }

    static func parseDate(_ text: String?) -> Date? {
        guard let text, !text.isEmpty else { return nil }
        if let d = isoFormatter.date(from: text) ?? isoFractional.date(from: text) { return d }
        for f in rfc822 { if let d = f.date(from: text) { return d } }
        return nil
    }

    private static let imgRegex = try! NSRegularExpression(
        pattern: #"<img[^>]+?src\s*=\s*["']([^"']+)["']"#, options: [.caseInsensitive])

    static func firstImage(in html: String) -> String? {
        let range = NSRange(html.startIndex..., in: html)
        for match in imgRegex.matches(in: html, range: range) {
            guard let r = Range(match.range(at: 1), in: html) else { continue }
            let src = String(html[r])
            // アイコン・絵文字・計測用の極小画像はサムネイルにしない
            let lower = src.lowercased()
            if lower.contains("emoji") || lower.contains("icon") || lower.contains("1x1") || lower.hasSuffix(".gif") { continue }
            if src.hasPrefix("//") { return "https:" + src }
            if src.hasPrefix("http") { return src }
        }
        return nil
    }

    static func looksLikeImage(_ url: String) -> Bool {
        let lower = url.lowercased()
        return [".jpg", ".jpeg", ".png", ".webp"].contains { lower.contains($0) }
    }

    static func stripTags(_ html: String) -> String {
        html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func decodeEntities(_ s: String) -> String {
        guard s.contains("&") else { return s }
        var out = s
        for (k, v) in [("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'"), ("&apos;", "'"),
                       ("&nbsp;", " "), ("&amp;", "&")] {
            out = out.replacingOccurrences(of: k, with: v)
        }
        return out
    }
}
