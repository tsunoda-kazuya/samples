import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("adblockEnabled") private var adblockEnabled = true
    @AppStorage("javascriptEnabled") private var javascriptEnabled = true
    @AppStorage("extraBlockDomains") private var extraBlockDomains = ""
    @AppStorage("openMode") private var openMode: OpenMode = .safari
    @AppStorage("hideRead") private var hideRead = false
    @AppStorage("muteWords") private var muteWords = ""
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("記事の開き方", selection: $openMode) {
                        ForEach(OpenMode.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text("記事の開き方")
                } footer: {
                    Text("「Safari表示」では、Safariに設定したコンテンツブロッカー（Adblock Plus・280blocker等）が効きます。iPhoneの「設定 > アプリ > Safari > 機能拡張」でブロッカーがオンになっていることを確認してください。一覧の右スワイプでリーダー表示、長押しで開き方を選べます。")
                }

                Section {
                    Toggle("広告ブロック", isOn: $adblockEnabled)
                    Toggle("JavaScriptを有効にする", isOn: $javascriptEnabled)
                } header: {
                    Text("アプリ内ブラウザ")
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
