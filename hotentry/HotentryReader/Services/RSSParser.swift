import Foundation

/// はてブの RSS 1.0 (RDF) をパースする
final class RSSParser: NSObject, XMLParserDelegate {
    private var entries: [Entry] = []
    private var current: [String: String]?
    private var text = ""

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ data: Data) -> [Entry] {
        let delegate = RSSParser()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.parse()
        return delegate.entries
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        if elementName == "item" {
            current = [:]
            if let about = attributeDict["rdf:about"] { current?["about"] = about }
        }
        text = ""
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        text += string
    }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        text += String(decoding: CDATABlock, as: UTF8.self)
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?) {
        guard current != nil else { return }
        if elementName == "item" {
            if let entry = makeEntry(current!) { entries.append(entry) }
            current = nil
        } else {
            current?[elementName] = text.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        text = ""
    }

    private func makeEntry(_ d: [String: String]) -> Entry? {
        guard let link = URL(string: d["link"] ?? d["about"] ?? "") else { return nil }
        return Entry(
            title: d["title"] ?? link.absoluteString,
            link: link,
            summary: d["description"] ?? "",
            date: d["dc:date"].flatMap { Self.isoFormatter.date(from: $0) },
            bookmarkCount: Int(d["hatena:bookmarkcount"] ?? "") ?? 0,
            imageURL: d["hatena:imageurl"].flatMap { $0.isEmpty ? nil : URL(string: $0) },
            commentPageURL: d["hatena:bookmarkCommentListPageUrl"].flatMap { URL(string: $0) }
        )
    }
}
