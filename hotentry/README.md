# ホッテントリ (Hotentry Reader)

はてなブックマークのホッテントリと 2ch まとめブログを、**広告ブロックしながらアプリ内でだらだら読む** iOS アプリ。
記事はすべてアプリ内ブラウザで開き、Safari には移動しません。

## タブ

| タブ | 内容 |
|---|---|
| ミックス | はてブ人気エントリ（総合）＋まとめブログを新しい順に混ぜて表示 |
| はてブ | 人気 / 新着 × カテゴリ（総合・一般・世の中・政治と経済・暮らし・学び・テクノロジー・おもしろ・エンタメ・アニメとゲーム） |
| まとめ | 2ch まとめブログの新着（サイトごとの絞り込みあり） |
| 設定 | 読み込むサイト・広告フィルタ・ミュート等 |

## 機能

- **だらだら読み**: 記事画面の「次の記事」で、一覧に戻らずに次の未読記事へ
- **ブコメ**: どの記事でも、はてブのコメントをハーフシートで表示（記事を読みながら見られる）
- **まとめサイト・RSS の管理**: 初期登録 12 サイト。ON/OFF・並べ替え・削除、任意の RSS/Atom を追加（トップ URL から RSS を自動検出）
- **一覧**: 既読はグレー表示（隠す設定あり）、左スワイプで既読、長押しでプレビュー・共有、ミュートワード（タイトル・URL・サイト名）
- **広告ブロック**
  - Adblock Plus と同じフィルタリストを取り込み `WKContentRuleList` に変換（3 日ごとに自動更新）
    - EasyList（Adblock Plus 標準）・AdGuard 日本語フィルタ: デフォルト ON
    - EasyPrivacy（トラッカー）・Fanboy's Annoyance（Cookie バナー等）: 任意
    - 要素非表示の例外ルール（`#@#`）にも対応
  - 内蔵ルール（国内外の広告ドメイン約 120 件 + 広告枠セレクタ）
  - 画面下に追従する広告の除去、広告による勝手な App Store 遷移・ポップアップの阻止
  - JavaScript オフの「超軽量モード」、独自ブロックドメインの追加

> iOS の仕様上、Safari 用の広告ブロッカー（Adblock Plus 等）は他アプリの WKWebView には効きません。
> Adblock Plus の iOS 版も EasyList を Safari コンテンツブロッカー形式に変換する仕組みなので、このアプリは同じ変換を自前で行っています。

## ビルド方法

必要: Mac + Xcode 16 以降（iOS 17 以降の端末）

1. `hotentry/HotentryReader.xcodeproj` を Xcode で開く
2. ターゲット **HotentryReader** → *Signing & Capabilities* で **Team** に自分の Apple ID を選択
   - Bundle Identifier が使えないと言われたら `jp.hotentryreader.app.k7x2` を任意の文字列に変更
3. iPhone を接続して ▶︎ (Run)
   - 初回は iPhone の「設定 > 一般 > VPN とデバイス管理」で開発元を信頼
   - 有料の Developer Program は不要。無料の Apple ID でも自分の端末にインストールできます
   - 無料の場合の制限: アプリは 7 日で期限切れ（Mac につないで再度 Run すれば延長）、1 端末に同時 3 アプリまで

> `.xcodeproj` が開けない場合の予備として `project.yml` (XcodeGen) を同梱しています:
> `brew install xcodegen && cd hotentry && xcodegen`

## 構成

```
HotentryReader/
├── HotentryReaderApp.swift
├── Models/
│   ├── Entry.swift                エントリ・はてブカテゴリ定義
│   └── FeedSource.swift           まとめサイト一覧（初期登録サイトはここ）
├── Services/
│   ├── HatenaAPI.swift            はてブ RSS / ブコメ / 任意 RSS の取得
│   ├── FeedParser.swift           RSS 1.0・2.0・Atom パーサ
│   ├── FeedStore.swift            取得したエントリの保持（全タブ共有）
│   ├── AdBlocker.swift            内蔵の広告ブロックルール
│   ├── FilterListConverter.swift  Adblock Plus 形式 → WKContentRuleList 変換
│   ├── FilterListManager.swift    フィルタリストの取得・コンパイル・自動更新
│   └── ReadHistory.swift          既読管理
└── Views/
    ├── Tabs.swift                 タブ（ミックス・はてブ・まとめ）
    ├── EntryBrowser.swift         一覧 → 記事 の共通画面・チップバー
    ├── EntryRow.swift
    ├── ArticleView.swift          記事ビュー（次の記事・ブコメ）
    ├── WebViewModel.swift         WKWebView 制御（遷移・ポップアップ制御）
    ├── CommentsView.swift         ブコメ
    ├── FeedSourcesView.swift      まとめサイト・RSS の管理
    └── SettingsView.swift
```

## 使っているエンドポイント

- はてブ一覧: `https://b.hatena.ne.jp/{hotentry|entrylist}/{category}.rss`
- ブコメ: `https://b.hatena.ne.jp/entry/jsonlite/?url={記事URL}`
- まとめブログ: 各ブログの RSS（ライブドアブログは `/index.rdf`）
- 広告フィルタ: `raw.githubusercontent.com` の easylist/easylist（gh-pages）と AdguardTeam/FiltersRegistry

個人利用を想定したアプリです。
