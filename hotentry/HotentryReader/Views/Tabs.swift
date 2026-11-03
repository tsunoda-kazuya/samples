import SwiftUI

struct RootView: View {
    @StateObject private var store = FeedStore()
    @StateObject private var sources = FeedSourceStore.shared
    @AppStorage("selectedTab") private var tab = "mix"

    var body: some View {
        TabView(selection: $tab) {
            MixTab()
                .tabItem { Label("ミックス", systemImage: "square.stack.3d.up") }
                .tag("mix")
            HatenaTab()
                .tabItem { Label("はてブ", systemImage: "bookmark") }
                .tag("hatena")
            MatomeTab()
                .tabItem { Label("まとめ", systemImage: "text.bubble") }
                .tag("matome")
            SettingsView()
                .tabItem { Label("設定", systemImage: "gearshape") }
                .tag("settings")
        }
        .environmentObject(store)
        .environmentObject(sources)
    }
}

/// はてブの人気エントリ + まとめブログを新しい順に混ぜて表示
struct MixTab: View {
    @EnvironmentObject private var store: FeedStore
    @EnvironmentObject private var sources: FeedSourceStore

    var body: some View {
        EntryBrowser(
            title: "ミックス",
            entries: store.mixEntries(sources.enabled),
            isLoading: !store.loading.isEmpty,
            error: store.hatenaErrors[FeedStore.hatenaKey(.all, .hot)],
            refresh: { await store.loadMix(sources.enabled, force: true) },
            header: { EmptyView() },
            leading: { EmptyView() }
        )
        .task(id: sources.enabled.map(\.id)) { await store.loadMix(sources.enabled) }
    }
}

struct HatenaTab: View {
    @EnvironmentObject private var store: FeedStore
    @AppStorage("category") private var category: HatenaCategory = .all
    @AppStorage("feedMode") private var mode: FeedMode = .hot

    private var key: String { FeedStore.hatenaKey(category, mode) }

    var body: some View {
        EntryBrowser(
            title: mode == .hot ? "はてブ 人気" : "はてブ 新着",
            entries: store.hatena[key] ?? [],
            isLoading: store.loading.contains(key),
            error: store.hatenaErrors[key],
            refresh: { await store.loadHatena(category, mode, force: true) },
            header: {
                ChipBar(items: HatenaCategory.allCases, selection: $category) { $0.label }
            },
            leading: {
                Picker("モード", selection: $mode) {
                    ForEach(FeedMode.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .fixedSize()
            }
        )
        .task(id: key) { await store.loadHatena(category, mode) }
    }
}

struct MatomeTab: View {
    @EnvironmentObject private var store: FeedStore
    @EnvironmentObject private var sources: FeedSourceStore
    /// nil = すべてのサイト
    @State private var selected: UUID?

    var body: some View {
        let enabled = sources.enabled
        EntryBrowser(
            title: "まとめ",
            entries: store.matomeEntries(enabled, only: selected),
            isLoading: store.isLoadingFeeds,
            error: selected.flatMap { store.feedErrors[$0] },
            refresh: { await store.loadFeeds(enabled, force: true) },
            header: {
                ChipBar(items: [nil] + enabled.map { Optional($0.id) }, selection: $selected) { id in
                    id.flatMap { id in enabled.first { $0.id == id }?.name } ?? "すべて"
                }
            },
            leading: { EmptyView() }
        )
        .task(id: enabled.map(\.id)) { await store.loadFeeds(enabled) }
    }
}
