import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("adblockEnabled") private var adblockEnabled = true
    @AppStorage("javascriptEnabled") private var javascriptEnabled = true
    @AppStorage("extraBlockDomains") private var extraBlockDomains = ""
    @AppStorage("openInSafariReader") private var openInSafariReader = false
    @AppStorage("hideRead") private var hideRead = false
    @AppStorage("muteWords") private var muteWords = ""
    @State private var confirmClear = false

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

                Section {
                    TextEditor(text: $extraBlockDomains)
                        .font(.system(.footnote, design: .monospaced))
                        .frame(minHeight: 100)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("追加でブロックするドメイン（1行に1つ）")
                } footer: {
                    Text("例: ads.example.com　サブドメインもまとめてブロックされます。組み込みのリストには \(AdBlocker.blockedDomains.count) 件のドメインが登録済みです。")
                }

                Section {
                    Toggle("タップでSafariリーダー表示", isOn: $openInSafariReader)
                } footer: {
                    Text("オンにすると記事をSafariのリーダー表示で開きます。Safariに設定したコンテンツブロッカー（280blocker・AdGuard等）も有効になります。一覧で記事を右スワイプしても同じ表示で開けます。")
                }

                Section {
                    Toggle("既読の記事を隠す", isOn: $hideRead)
                    Button("既読履歴を消去", role: .destructive) { confirmClear = true }
                } header: {
                    Text("一覧")
                }

                Section {
                    TextEditor(text: $muteWords)
                        .frame(minHeight: 100)
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
                    Button("完了") { dismiss() }
                }
            }
            .confirmationDialog("既読履歴を消去しますか？", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("消去", role: .destructive) { ReadHistory.shared.clear() }
            }
        }
    }
}
