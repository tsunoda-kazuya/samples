import SwiftUI

/// まとめブログ等の RSS の管理 (ON/OFF・追加・削除・並べ替え)
struct FeedSourcesView: View {
    @EnvironmentObject private var sources: FeedSourceStore
    @EnvironmentObject private var store: FeedStore
    @State private var showAdd = false
    @State private var confirmReset = false

    var body: some View {
        List {
            Section {
                ForEach($sources.sources) { $source in
                    Toggle(isOn: $source.enabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(source.name)
                            if let error = store.feedErrors[source.id] {
                                Text("取得エラー: \(error)").font(.caption2).foregroundStyle(.red)
                            } else {
                                Text(source.url.host ?? "").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .onDelete { sources.sources.remove(atOffsets: $0) }
                .onMove { sources.sources.move(fromOffsets: $0, toOffset: $1) }
            } footer: {
                Text("左スワイプで削除、「編集」で並べ替えできます。まとめブログ以外にも、RSS/Atom を配信しているサイト（ニュースサイト・ブログなど）なら何でも追加できます。")
            }

            Section {
                Button("サイトを追加", systemImage: "plus") { showAdd = true }
                Button("初期状態に戻す", role: .destructive) { confirmReset = true }
            }
        }
        .navigationTitle("まとめサイト・RSS")
        .toolbar { EditButton() }
        .sheet(isPresented: $showAdd) { AddFeedView() }
        .confirmationDialog("サイト一覧を初期状態に戻しますか？", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("初期状態に戻す", role: .destructive) { sources.resetToDefaults() }
        }
    }
}

struct AddFeedView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var sources: FeedSourceStore
    @State private var urlText = ""
    @State private var name = ""
    @State private var checking = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://example.com/index.rdf", text: $urlText)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("表示名（空欄ならサイト名）", text: $name)
                } footer: {
                    Text("RSSのURLを入力してください。ライブドアブログなら「ブログのURL/index.rdf」、多くのブログは「/feed」や「/rss」でも取得できます。サイトのトップURLを入れた場合は代表的なRSSの場所を自動で試します。")
                }
                if let message {
                    Text(message).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("サイトを追加")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if checking {
                        ProgressView()
                    } else {
                        Button("追加") { Task { await add() } }
                            .disabled(urlText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }

    private func add() async {
        var text = urlText.trimmingCharacters(in: .whitespaces)
        if !text.lowercased().hasPrefix("http") { text = "https://" + text }
        guard let base = URL(string: text) else {
            message = "URLの形式が正しくありません"
            return
        }
        checking = true
        defer { checking = false }

        // 入力 URL そのもの → よくある RSS の場所 の順に試す
        let root = base.path.isEmpty || base.path == "/" ? base : nil
        let candidates = [base] + (root.map { r in
            ["index.rdf", "feed", "rss", "atom.xml", "feed.xml", "rss.xml", "index.xml"].map { r.appendingPathComponent($0) }
        } ?? [])
        for url in candidates {
            if let result = try? await HatenaAPI.probeFeed(url) {
                let display = name.isEmpty ? (result.title ?? url.host ?? url.absoluteString) : name
                sources.add(name: display, url: url)
                dismiss()
                return
            }
        }
        message = "RSSが見つかりませんでした。RSSのURLを直接入力してください。"
    }
}
