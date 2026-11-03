import SwiftUI

@MainActor
final class FeedStore: ObservableObject {
    @Published private(set) var entries: [String: [Entry]] = [:]
    @Published private(set) var loading: Set<String> = []
    @Published var errors: [String: String] = [:]

    static func key(_ category: HatenaCategory, _ mode: FeedMode) -> String { "\(mode.rawValue)/\(category.rawValue)" }

    func load(_ category: HatenaCategory, _ mode: FeedMode, force: Bool = false) async {
        let key = Self.key(category, mode)
        if !force, entries[key] != nil { return }
        loading.insert(key)
        defer { loading.remove(key) }
        do {
            entries[key] = try await HatenaAPI.fetchEntries(category: category, mode: mode)
            errors[key] = nil
        } catch is CancellationError {
        } catch let error as URLError where error.code == .cancelled {
        } catch {
            errors[key] = error.localizedDescription
        }
    }
}

struct EntryListView: View {
    @StateObject private var store = FeedStore()
    @ObservedObject private var history = ReadHistory.shared

    @AppStorage("category") private var category: HatenaCategory = .all
    @AppStorage("feedMode") private var mode: FeedMode = .hot
    @AppStorage("hideRead") private var hideRead = false
    @AppStorage("muteWords") private var muteWords = ""

    @State private var path: [Entry] = []
    @State private var showSettings = false

    private var key: String { FeedStore.key(category, mode) }

    private var visibleEntries: [Entry] {
        let words = muteWords.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        return (store.entries[key] ?? []).filter { entry in
            if hideRead && history.isRead(entry) { return false }
            let haystack = (entry.title + " " + entry.link.absoluteString).lowercased()
            return !words.contains { haystack.contains($0) }
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                categoryBar
                Divider()
                content
            }
            .navigationTitle(mode == .hot ? "ホッテントリ" : "新着エントリ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("モード", selection: $mode) {
                        ForEach(FeedMode.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .fixedSize()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .navigationDestination(for: Entry.self) { entry in
                ArticleView(entry: entry)
            }
            .task(id: key) { await store.load(category, mode) }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    private var categoryBar: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(HatenaCategory.allCases) { c in
                        Button {
                            category = c
                        } label: {
                            Text(c.label)
                                .font(.subheadline.weight(c == category ? .bold : .regular))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(
                                    Capsule().fill(c == category ? Color.accentColor : Color.secondary.opacity(0.12))
                                )
                                .foregroundStyle(c == category ? Color.white : Color.primary)
                        }
                        .buttonStyle(.plain)
                        .id(c)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .onChange(of: category) { _, newValue in
                withAnimation { proxy.scrollTo(newValue, anchor: .center) }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let entries = visibleEntries
        if entries.isEmpty && store.loading.contains(key) {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if entries.isEmpty, let error = store.errors[key] {
            ContentUnavailableView {
                Label("読み込めませんでした", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("再読み込み") { Task { await store.load(category, mode, force: true) } }
            }
        } else {
            List(entries) { entry in
                Button {
                    path.append(entry)
                } label: {
                    EntryRow(entry: entry, isRead: history.isRead(entry))
                }
                .buttonStyle(.plain)
                .swipeActions(edge: .trailing) {
                    Button {
                        history.markRead(entry)
                    } label: {
                        Label("既読", systemImage: "checkmark")
                    }
                    .tint(.gray)
                }
                .contextMenu {
                    Button {
                        history.markRead(entry)
                    } label: {
                        Label("既読にする", systemImage: "checkmark")
                    }
                    Button {
                        UIPasteboard.general.url = entry.link
                    } label: {
                        Label("URLをコピー", systemImage: "doc.on.doc")
                    }
                    ShareLink(item: entry.link)
                } preview: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(entry.title).font(.headline)
                        Text(entry.summary).font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding()
                    .frame(width: 320)
                }
            }
            .listStyle(.plain)
            .refreshable { await store.load(category, mode, force: true) }
        }
    }

}
