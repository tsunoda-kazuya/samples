import Foundation

struct Bookmark: Decodable, Identifiable, Hashable {
    var id: String { user }
    let user: String
    let comment: String
    let timestamp: String
    let tags: [String]

    private enum CodingKeys: String, CodingKey { case user, comment, timestamp, tags }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user = try c.decode(String.self, forKey: .user)
        comment = (try? c.decodeIfPresent(String.self, forKey: .comment)) ?? ""
        timestamp = (try? c.decodeIfPresent(String.self, forKey: .timestamp)) ?? ""
        tags = (try? c.decodeIfPresent([String].self, forKey: .tags)) ?? []
    }

    var iconURL: URL? {
        URL(string: "https://cdn.profile-image.st-hatena.com/users/\(user)/profile.png")
    }
}

private struct BookmarkResponse: Decodable {
    let count: Int?
    let bookmarks: [Bookmark]?
}

enum HatenaAPI {
    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }()

    static func fetchEntries(category: HatenaCategory, mode: FeedMode) async throws -> [Entry] {
        var request = URLRequest(url: category.feedURL(mode: mode))
        request.setValue("HotentryReader/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: request)
        try check(response)
        return FeedParser.parse(data).entries
    }

    /// まとめブログ等の RSS を取得 (https で失敗したら http で再試行)
    static func fetchFeed(_ source: FeedSource) async throws -> [Entry] {
        do {
            return try await fetchFeedData(source.url, source: source)
        } catch {
            guard source.url.scheme == "https",
                  var comps = URLComponents(url: source.url, resolvingAgainstBaseURL: false) else { throw error }
            comps.scheme = "http"
            guard let httpURL = comps.url else { throw error }
            return try await fetchFeedData(httpURL, source: source)
        }
    }

    /// フィード URL を検証してタイトルを返す (サイト追加用)
    static func probeFeed(_ url: URL) async throws -> (title: String?, count: Int) {
        let (data, response) = try await session.data(from: url)
        try check(response)
        let result = FeedParser.parse(data)
        guard !result.entries.isEmpty else { throw URLError(.cannotParseResponse) }
        return (result.title, result.entries.count)
    }

    private static func fetchFeedData(_ url: URL, source: FeedSource) async throws -> [Entry] {
        let (data, response) = try await session.data(from: url)
        try check(response)
        let entries = FeedParser.parse(data, source: source).entries
        if entries.isEmpty { throw URLError(.cannotParseResponse) }
        return entries
    }

    /// ブックマークコメント一覧 (新しい順)
    static func fetchBookmarks(for url: URL) async throws -> (count: Int, bookmarks: [Bookmark]) {
        let api = URL(string: "https://b.hatena.ne.jp/entry/jsonlite/?url=" + url.absoluteString.urlQueryEncoded)!
        let (data, response) = try await session.data(from: api)
        try check(response)
        // ブクマが 0 件だと "null" が返る
        guard let res = try? JSONDecoder().decode(BookmarkResponse.self, from: data) else {
            return (0, [])
        }
        return (res.count ?? 0, res.bookmarks ?? [])
    }

    private static func check(_ response: URLResponse) throws {
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
    }
}
