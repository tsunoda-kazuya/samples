import SwiftUI

/// 一覧 → 記事 の画面遷移を担う共通コンポーネント (各タブで使う)
struct EntryBrowser<Header: View, Leading: View>: View {
    let title: String
    let entries: [Entry]
    let isLoading: Bool
    let error: String?
    let refresh: () async -> Void
    @ViewBuilder var header: () -> Header
    @ViewBuilder var leading: () -> Leading

    @ObservedObject private var history = ReadHistory.shared
    @AppStorage("hideRead") private var hideRead = false
    @AppStorage("muteWords") private var muteWords = ""
    @State private var path: [Entry] = []

    /// ミュートを適用した一覧 (「次の記事」の計算にも使う)
    private var unmuted: [Entry] {
        let words = muteWords.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        guard !words.isEmpty else { return entries }
        return entries.filter { entry in
            let haystack = (entry.title + " " + entry.link.absoluteString + " " + (entry.sourceName ?? "")).lowercased()
            return !words.contains { haystack.contains($0) }
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                header()
                content
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { leading() }
            }
            .navigationDestination(for: Entry.self) { entry in
                ArticleView(entry: entry, nextEntry: nextUnread(after: entry)) { next in
                    path = [next]
                }
                .id(entry.id)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let visible = hideRead ? unmuted.filter { !history.isRead($0) } : unmuted
        if visible.isEmpty && isLoading {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if visible.isEmpty {
            ContentUnavailableView {
                Label(error == nil ? "記事がありません" : "読み込めませんでした",
                      systemImage: error == nil ? "tray" : "wifi.exclamationmark")
            } description: {
                Text(error ?? (hideRead ? "既読の記事は非表示になっています" : ""))
            } actions: {
                Button("再読み込み") { Task { await refresh() } }
            }
        } else {
            List(visible) { entry in
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
                        if !entry.summary.isEmpty {
                            Text(entry.summary).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .frame(width: 320)
                }
            }
            .listStyle(.plain)
            .refreshable { await refresh() }
        }
    }

    /// 今の記事より下にある未読の記事 (だらだら読み用)
    private func nextUnread(after entry: Entry) -> Entry? {
        let list = unmuted
        let start = (list.firstIndex(of: entry).map { $0 + 1 }) ?? 0
        return list[start...].first { $0 != entry && !history.isRead($0) }
    }
}

/// 横スクロールのチップ選択バー
struct ChipBar<Item: Hashable>: View {
    let items: [Item]
    @Binding var selection: Item
    let label: (Item) -> String

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(items, id: \.self) { item in
                        let selected = item == selection
                        Button {
                            selection = item
                        } label: {
                            Text(label(item))
                                .font(.subheadline.weight(selected ? .bold : .regular))
                                .lineLimit(1)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(selected ? Color.accentColor : Color.secondary.opacity(0.12)))
                                .foregroundStyle(selected ? Color.white : Color.primary)
                        }
                        .buttonStyle(.plain)
                        .id(item)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .onChange(of: selection) { _, newValue in
                withAnimation { proxy.scrollTo(newValue, anchor: .center) }
            }
        }
        .overlay(alignment: .bottom) { Divider() }
    }
}
