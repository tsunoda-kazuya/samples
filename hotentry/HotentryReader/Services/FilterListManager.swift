import Foundation
import WebKit

/// 広告フィルタリスト (Adblock Plus と同じ EasyList 等) の取得・変換・コンパイルを管理する
@MainActor
final class FilterListManager: ObservableObject {
    static let shared = FilterListManager()

    struct Subscription: Identifiable {
        let id: String
        let name: String
        let detail: String
        let url: URL
        let defaultOn: Bool
    }

    static let subscriptions: [Subscription] = [
        .init(id: "easylist", name: "EasyList", detail: "Adblock Plus 標準の広告フィルタ",
              url: URL(string: "https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt")!,
              defaultOn: true),
        .init(id: "adguard-ja", name: "AdGuard 日本語フィルタ", detail: "国内の広告ネットワーク・サイト向け",
              url: URL(string: "https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_7_Japanese/filter.txt")!,
              defaultOn: true),
        .init(id: "easyprivacy", name: "EasyPrivacy", detail: "トラッカー・アクセス解析",
              url: URL(string: "https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt")!,
              defaultOn: false),
        .init(id: "annoyance", name: "Fanboy's Annoyance", detail: "Cookie 同意バナー・SNS ボタン・通知のお願い等",
              url: URL(string: "https://raw.githubusercontent.com/easylist/easylist/gh-pages/fanboy-annoyance.txt")!,
              defaultOn: false),
    ]

    enum Status: Equatable {
        case idle
        case working(String)
        case failed(String)
    }

    @Published private(set) var enabledIDs: Set<String>
    @Published private(set) var status: Status = .idle
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var ruleCount: Int

    private var identifiers: [String]
    private var loadedLists: [WKContentRuleList]?
    private let defaults = UserDefaults.standard
    private let updateInterval: TimeInterval = 60 * 60 * 24 * 3   // 3 日ごとに自動更新

    /// 1 つのルールリストに入れる最大ルール数 (WebKit の上限は 150,000)
    private let chunkSize = 50_000

    private init() {
        if let saved = defaults.stringArray(forKey: "filter.enabled") {
            enabledIDs = Set(saved)
        } else {
            enabledIDs = Set(Self.subscriptions.filter(\.defaultOn).map(\.id))
        }
        identifiers = defaults.stringArray(forKey: "filter.identifiers") ?? []
        lastUpdated = defaults.object(forKey: "filter.lastUpdated") as? Date
        ruleCount = defaults.integer(forKey: "filter.ruleCount")
    }

    var isWorking: Bool {
        if case .working = status { return true }
        return false
    }

    func isEnabled(_ sub: Subscription) -> Bool { enabledIDs.contains(sub.id) }

    func setEnabled(_ sub: Subscription, _ on: Bool) {
        if on { enabledIDs.insert(sub.id) } else { enabledIDs.remove(sub.id) }
        defaults.set(Array(enabledIDs), forKey: "filter.enabled")
    }

    /// 記事ビューに適用するコンパイル済みルールリスト
    func ruleLists() async -> [WKContentRuleList] {
        if let loadedLists { return loadedLists }
        var lists: [WKContentRuleList] = []
        for id in identifiers {
            if let list = await Self.lookUp(id) { lists.append(list) }
        }
        loadedLists = lists
        return lists
    }

    func updateIfNeeded() async {
        if let lastUpdated, Date().timeIntervalSince(lastUpdated) < updateInterval, !identifiers.isEmpty { return }
        await update()
    }

    func update() async {
        guard !isWorking else { return }
        let subs = Self.subscriptions.filter { enabledIDs.contains($0.id) }

        if subs.isEmpty {
            await replaceLists(with: [], count: 0)
            status = .idle
            return
        }

        // 1. ダウンロード
        status = .working("フィルタをダウンロード中…")
        var texts: [String] = []
        do {
            try await withThrowingTaskGroup(of: String.self) { group in
                for sub in subs {
                    group.addTask {
                        var request = URLRequest(url: sub.url)
                        request.cachePolicy = .reloadIgnoringLocalCacheData
                        request.timeoutInterval = 60
                        let (data, response) = try await URLSession.shared.data(for: request)
                        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                            throw URLError(.badServerResponse)
                        }
                        return String(decoding: data, as: UTF8.self)
                    }
                }
                for try await text in group { texts.append(text) }
            }
        } catch {
            status = .failed("ダウンロードに失敗しました: \(error.localizedDescription)")
            return
        }

        // 2. 変換 (重いのでバックグラウンドで)
        status = .working("ルールを変換中…")
        let joined = texts.joined(separator: "\n")
        let converted = await Task.detached(priority: .utility) {
            FilterListConverter.convert(joined)
        }.value

        // 3. コンパイル (通信ブロックと要素非表示を別リストに。失敗したルール群は二分して除外)
        status = .working("ルールを適用中…（\(converted.totalCount) 件）")
        let stamp = String(Int(Date().timeIntervalSince1970))
        var newIDs: [String] = []
        var budget = 80   // コンパイル試行回数の上限
        for (index, start) in stride(from: 0, to: converted.blocking.count, by: chunkSize).enumerated() {
            let chunk = converted.blocking[start..<min(start + chunkSize, converted.blocking.count)]
            newIDs += await compileRobustly(chunk, tail: converted.blockingExceptions,
                                            prefix: "filter-\(stamp)-net\(index)", budget: &budget)
        }
        for (index, start) in stride(from: 0, to: converted.hiding.count, by: chunkSize).enumerated() {
            let chunk = converted.hiding[start..<min(start + chunkSize, converted.hiding.count)]
            newIDs += await compileRobustly(chunk, tail: converted.hidingExceptions,
                                            prefix: "filter-\(stamp)-css\(index)", budget: &budget)
        }

        if newIDs.isEmpty {
            status = .failed("ルールの適用に失敗しました")
            return
        }
        await replaceLists(with: newIDs, count: converted.totalCount)
        lastUpdated = Date()
        defaults.set(lastUpdated, forKey: "filter.lastUpdated")
        status = .idle
    }

    // MARK: - Private

    private func replaceLists(with newIDs: [String], count: Int) async {
        let old = identifiers.filter { !newIDs.contains($0) }
        identifiers = newIDs
        ruleCount = count
        loadedLists = nil
        defaults.set(newIDs, forKey: "filter.identifiers")
        defaults.set(count, forKey: "filter.ruleCount")
        for id in old { await Self.remove(id) }
    }

    /// まとめてコンパイルし、失敗したら半分に分けて再試行。壊れたルールを含む小さな塊だけを捨てる
    private func compileRobustly(_ rules: ArraySlice<ContentRule>, tail: [ContentRule],
                                 prefix: String, budget: inout Int) async -> [String] {
        guard !rules.isEmpty, budget > 0 else { return [] }
        budget -= 1
        let id = "\(prefix)-\(rules.startIndex)"
        if await Self.compile(id, rules: Array(rules) + tail) { return [id] }
        if rules.count <= 100 {
            // 例外ルール側が原因の可能性もあるので、例外なしでもう一度
            if !tail.isEmpty, budget > 0 {
                budget -= 1
                if await Self.compile(id, rules: Array(rules)) { return [id] }
            }
            return []
        }
        let mid = rules.startIndex + rules.count / 2
        let left = await compileRobustly(rules[rules.startIndex..<mid], tail: tail, prefix: prefix, budget: &budget)
        let right = await compileRobustly(rules[mid..<rules.endIndex], tail: tail, prefix: prefix, budget: &budget)
        return left + right
    }

    private static func compile(_ id: String, rules: [ContentRule]) async -> Bool {
        let json: String = await Task.detached(priority: .utility) {
            let data = (try? JSONEncoder().encode(rules)) ?? Data("[]".utf8)
            return String(decoding: data, as: UTF8.self)
        }.value
        guard let store = WKContentRuleListStore.default() else { return false }
        return await withCheckedContinuation { cont in
            store.compileContentRuleList(forIdentifier: id, encodedContentRuleList: json) { list, error in
                if let error { print("Filter compile error (\(id), \(rules.count) rules):", error) }
                cont.resume(returning: list != nil)
            }
        }
    }

    private static func lookUp(_ id: String) async -> WKContentRuleList? {
        guard let store = WKContentRuleListStore.default() else { return nil }
        return await withCheckedContinuation { cont in
            store.lookUpContentRuleList(forIdentifier: id) { list, _ in cont.resume(returning: list) }
        }
    }

    private static func remove(_ id: String) async {
        guard let store = WKContentRuleListStore.default() else { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            store.removeContentRuleList(forIdentifier: id) { _ in cont.resume() }
        }
    }
}
