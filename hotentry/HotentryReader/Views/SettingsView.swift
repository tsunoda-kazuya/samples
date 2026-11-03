import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var filters = FilterListManager.shared

    @AppStorage("adblockEnabled") private var adblockEnabled = true
    @AppStorage("javascriptEnabled") private var javascriptEnabled = true
    @AppStorage("extraBlockDomains") private var extraBlockDomains = ""
    @AppStorage("hideRead") private var hideRead = false
    @AppStorage("muteWords") private var muteWords = ""
    @State private var confirmClear = false
    @State private var filtersChanged = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("広告ブロック", isOn: $adblockEnabled)
                    Toggle("JavaScriptを有効にする", isOn: $javascriptEnabled)
                } header: {
                    Text("記事ビュー")
                } footer: {
                    Text("JavaScriptをオフにすると、ほとんどの広告やポップアップが表示されなくなり軽くなります（一部のサイトは表示が崩れます）。変更は次に開く記事から反映されます。")
                }

                filterSection

                Section {
                    TextEditor(text: $extraBlockDomains)
                        .font(.system(.footnote, design: .monospaced))
                        .frame(minHeight: 80)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("追加でブロックするドメイン（1行に1つ）")
                } footer: {
                    Text("例: ads.example.com　サブドメインもまとめてブロックされます。")
                }

                Section {
                    Toggle("既読の記事を隠す", isOn: $hideRead)
                    Button("既読履歴を消去", role: .destructive) { confirmClear = true }
                } header: {
                    Text("一覧")
                }

                Section {
                    TextEditor(text: $muteWords)
                        .frame(minHeight: 80)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("ミュート（1行に1つ）")
                } footer: {
                    Text("タイトルかURLにこの文字列を含む記事を一覧から非表示にします。ドメイン名（例: example.com）も指定できます。")
                }
            }
            .navigationTitle("設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完了") {
                        if filtersChanged { Task { await filters.update() } }
                        dismiss()
                    }
                }
            }
            .confirmationDialog("既読履歴を消去しますか？", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("消去", role: .destructive) { ReadHistory.shared.clear() }
            }
        }
    }

    private var filterSection: some View {
        Section {
            ForEach(FilterListManager.subscriptions) { sub in
                Toggle(isOn: Binding(
                    get: { filters.isEnabled(sub) },
                    set: { filters.setEnabled(sub, $0); filtersChanged = true }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(sub.name)
                        Text(sub.detail).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .disabled(filters.isWorking)
            }

            HStack {
                switch filters.status {
                case .working(let message):
                    ProgressView()
                    Text(message).font(.footnote).foregroundStyle(.secondary)
                case .failed(let message):
                    Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
                    Text(message).font(.footnote).foregroundStyle(.secondary)
                case .idle:
                    if let date = filters.lastUpdated {
                        Text("\(filters.ruleCount.formatted()) ルール・\(date.formatted(date: .abbreviated, time: .shortened)) 更新")
                            .font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Text("未取得").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Button("今すぐ更新") {
                    filtersChanged = false
                    Task { await filters.update() }
                }
                .disabled(filters.isWorking)
            }
        } header: {
            Text("広告フィルタ（Adblock Plusと同じリスト）")
        } footer: {
            Text("Adblock Plusが使っているEasyListなどのフィルタを取り込み、アプリ内の記事ビューに適用します（3日ごとに自動更新）。iOSの仕様上、Safari用の広告ブロッカーアプリは他のアプリ内のブラウザには効かないため、この方式にしています。")
        }
    }
}
