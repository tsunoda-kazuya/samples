import Foundation

/// はてブ・まとめブログのエントリを保持するストア (全タブで共有)
@MainActor
final class FeedStore: ObservableObject {
    @Published private(set) var hatena: [String: [Entry]] = [:]
    @Published private(set) var hatenaErrors: [String: String] = [:]
    @Published private(set) var feedEntries: [UUID: [Entry]] = [:]
    @Published private(set) var feedErrors: [UUID: String] = [:]
    @Published private(set) var loading: Set<String> = []

    static func hatenaKey(_ category: HatenaCategory, _ mode: FeedMode) -> String {
        "\(mode.rawValue)/\(category.rawValue)"
    }

    // MARK: はてブ

    func loadHatena(_ category: HatenaCategory, _ mode: FeedMode, force: Bool = false) async {
        let key = Self.hatenaKey(category, mode)
        if !force, hatena[key] != nil { return }
        loading.insert(key)
        defer { loading.remove(key) }
        do {
            hatena[key] = try await HatenaAPI.fetchEntries(category: category, mode: mode)
            hatenaErrors[key] = nil
        } catch {
            if !Self.isCancellation(error) { hatenaErrors[key] = error.localizedDescription }
        }
    }

    // MARK: まとめ (RSS)

    func loadFeeds(_ sources: [FeedSource], force: Bool = false) async {
        let targets = force ? sources : sources.filter { feedEntries[$0.id] == nil }
        guard !targets.isEmpty else { return }
        loading.insert("feeds")
        defer { loading.remove("feeds") }

        await withTaskGroup(of: (UUID, [Entry]?, String?).self) { group in
            for source in targets {
                group.addTask {
                    do {
                        return (source.id, try await HatenaAPI.fetchFeed(source), nil)
                    } catch {
                        return (source.id, nil, Self.isCancellation(error) ? nil : error.localizedDescription)
                    }
                }
            }
            // 取得できたサイトから順に一覧へ反映
            for await (id, entries, error) in group {
                if let entries {
                    feedEntries[id] = entries
                    feedErrors[id] = nil
                } else if let error {
                    feedErrors[id] = error
                    if feedEntries[id] == nil { feedEntries[id] = [] }
                }
            }
        }
    }

    func matomeEntries(_ sources: [FeedSource], only: UUID? = nil) -> [Entry] {
        let entries = sources
            .filter { only == nil || $0.id == only }
            .flatMap { feedEntries[$0.id] ?? [] }
        return Self.sortedUnique(entries)
    }

    // MARK: ミックス

    func loadMix(_ sources: [FeedSource], force: Bool = false) async {
        async let h: Void = loadHatena(.all, .hot, force: force)
        async let f: Void = loadFeeds(sources, force: force)
        _ = await (h, f)
    }

    func mixEntries(_ sources: [FeedSource]) -> [Entry] {
        let hot = hatena[Self.hatenaKey(.all, .hot)] ?? []
        return Self.sortedUnique(hot + sources.flatMap { feedEntries[$0.id] ?? [] })
    }

    var isLoadingFeeds: Bool { loading.contains("feeds") }

    // MARK: Helpers

    /// 同じ URL を除いて新しい順に並べる
    static func sortedUnique(_ entries: [Entry]) -> [Entry] {
        var seen = Set<String>()
        let unique = entries.filter { seen.insert($0.id).inserted }
        return unique.sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }

    nonisolated static func isCancellation(_ error: Error) -> Bool {
        error is CancellationError || (error as? URLError)?.code == .cancelled
    }
}
