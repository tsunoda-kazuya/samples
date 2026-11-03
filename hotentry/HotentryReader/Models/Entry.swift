import Foundation

/// ホッテントリ / 新着エントリの 1 件
struct Entry: Identifiable, Hashable {
    var id: String { link.absoluteString }
    let title: String
    let link: URL
    let summary: String
    let date: Date?
    let bookmarkCount: Int
    let imageURL: URL?
    let commentPageURL: URL?
    /// まとめブログ等の配信元 (はてブのエントリは nil)
    var sourceName: String? = nil
    var sourceID: String? = nil

    var isHatena: Bool { sourceID == nil }

    var domain: String {
        (link.host ?? "").replacingOccurrences(of: "www.", with: "")
    }

    var faviconURL: URL? {
        URL(string: "https://cdn-ak.favicon.st-hatena.com/64?url=" + link.absoluteString.urlQueryEncoded)
    }

    /// はてブのエントリページ (b.hatena.ne.jp/entry/s/...)
    var hatenaEntryURL: URL {
        if let commentPageURL { return commentPageURL }
        let s = link.absoluteString
        if s.hasPrefix("https://") {
            return URL(string: "https://b.hatena.ne.jp/entry/s/" + String(s.dropFirst("https://".count))) ?? link
        }
        return URL(string: "https://b.hatena.ne.jp/entry/" + s.replacingOccurrences(of: "http://", with: "")) ?? link
    }
}

enum FeedMode: String, CaseIterable, Identifiable {
    case hot = "hotentry"
    case new = "entrylist"
    var id: String { rawValue }
    var label: String { self == .hot ? "人気" : "新着" }
}

enum HatenaCategory: String, CaseIterable, Identifiable {
    case all, general, social, economics, life, knowledge, it, fun, entertainment, game
    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "総合"
        case .general: "一般"
        case .social: "世の中"
        case .economics: "政治と経済"
        case .life: "暮らし"
        case .knowledge: "学び"
        case .it: "テクノロジー"
        case .fun: "おもしろ"
        case .entertainment: "エンタメ"
        case .game: "アニメとゲーム"
        }
    }

    func feedURL(mode: FeedMode) -> URL {
        URL(string: "https://b.hatena.ne.jp/\(mode.rawValue)/\(rawValue).rss")!
    }
}

extension String {
    var urlQueryEncoded: String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return addingPercentEncoding(withAllowedCharacters: allowed) ?? self
    }
}
