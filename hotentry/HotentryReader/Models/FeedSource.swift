import Foundation

/// RSS で取り込むサイト (2ch まとめブログなど)
struct FeedSource: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var url: URL
    var enabled = true
}

@MainActor
final class FeedSourceStore: ObservableObject {
    static let shared = FeedSourceStore()
    private let key = "feedSources"

    @Published var sources: [FeedSource] {
        didSet { save() }
    }

    var enabled: [FeedSource] { sources.filter(\.enabled) }

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let saved = try? JSONDecoder().decode([FeedSource].self, from: data) {
            sources = saved
        } else {
            sources = Self.defaults
        }
    }

    func add(name: String, url: URL) {
        guard !sources.contains(where: { $0.url == url }) else { return }
        sources.append(FeedSource(name: name, url: url))
    }

    func resetToDefaults() { sources = Self.defaults }

    private func save() {
        if let data = try? JSONEncoder().encode(sources) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /// 初期状態で登録しておく人気の 2ch まとめブログ (設定から追加・削除・並べ替え可能)
    static let defaults: [FeedSource] = [
        ("痛いニュース(ﾉ∀`)", "https://blog.livedoor.jp/dqnplus/index.rdf"),
        ("ハムスター速報", "https://hamusoku.com/index.rdf"),
        ("オレ的ゲーム速報＠刃", "https://jin115.com/index.rdf"),
        ("VIPPERな俺", "https://blog.livedoor.jp/news23vip/index.rdf"),
        ("暇人＼(^o^)／速報", "https://himasoku.com/index.rdf"),
        ("アルファルファモザイク", "https://alfalfalfa.com/index.rdf"),
        ("哲学ニュースnwk", "https://blog.livedoor.jp/nwknews/index.rdf"),
        ("キニ速", "https://blog.livedoor.jp/kinisoku/index.rdf"),
        ("ニュー速クオリティ", "https://news4vip.livedoor.biz/index.rdf"),
        ("ライフハックちゃんねる弐式", "https://lifehack2ch.livedoor.biz/index.rdf"),
        ("ガハろぐNews", "https://gahalog.2chblog.jp/index.rdf"),
        ("まとめたニュース", "https://matometanews.com/index.rdf"),
    ].map { FeedSource(name: $0.0, url: URL(string: $0.1)!) }
}
