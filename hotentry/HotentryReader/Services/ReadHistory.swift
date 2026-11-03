import Foundation

/// 既読管理 (UserDefaults に最大 3000 件)
@MainActor
final class ReadHistory: ObservableObject {
    static let shared = ReadHistory()
    private let key = "readHistory"
    @Published private(set) var urls: [String]
    private var set: Set<String>

    private init() {
        let saved = UserDefaults.standard.stringArray(forKey: key) ?? []
        urls = saved
        set = Set(saved)
    }

    func isRead(_ entry: Entry) -> Bool { set.contains(entry.id) }

    func markRead(_ entry: Entry) {
        guard !set.contains(entry.id) else { return }
        urls.append(entry.id)
        set.insert(entry.id)
        if urls.count > 3000 {
            let removed = urls.prefix(urls.count - 3000)
            removed.forEach { set.remove($0) }
            urls.removeFirst(removed.count)
        }
        UserDefaults.standard.set(urls, forKey: key)
    }

    func clear() {
        urls = []
        set = []
        UserDefaults.standard.removeObject(forKey: key)
    }
}
