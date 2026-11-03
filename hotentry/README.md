# ホッテントリ (Hotentry Reader)

はてなブックマークの [ホッテントリ](https://b.hatena.ne.jp/hotentry/) を読むための iOS アプリ。
公式アプリでは記事ページの広告ブロックが効かない問題を解決するため、**Adblock Plus と同じフィルタリスト（EasyList 等）をアプリ内ブラウザに取り込んで**広告を消します。記事はすべてアプリ内で開き、Safari には移動しません。

> iOS の仕様上、Safari 用の広告ブロッカー（Adblock Plus 等）は他アプリの WKWebView には効きません。
> Adblock Plus の iOS 版自体も「EasyList を Safari コンテンツブロッカー形式に変換する」仕組みなので、このアプリは同じ変換を自前で行い、アプリ内ブラウザに適用しています。

## 機能

- **一覧**: 人気 / 新着 × カテゴリ（総合・一般・世の中・政治と経済・暮らし・学び・テクノロジー・おもしろ・エンタメ・アニメとゲーム）
  - サムネイル・ファビコン・users 数・投稿時刻
  - 既読はグレー表示（「既読を隠す」設定あり）、引っ張って更新
  - 左スワイプ → 既読にする / 長押し → プレビュー・URL コピー・共有
  - ミュートワード（タイトル・URL・ドメインで非表示）
- **記事ビュー（広告ブロック付きアプリ内ブラウザ）**
  - フィルタリストを取得して `WKContentRuleList` に変換（3 日ごとに自動更新、設定から手動更新も可）
    - EasyList（Adblock Plus 標準）・AdGuard 日本語フィルタ: デフォルト ON
    - EasyPrivacy（トラッカー）・Fanboy's Annoyance（Cookie バナー等）: 任意
  - 上記に加えて内蔵ルール（国内外の広告ドメイン約 120 件）
  - よくある広告枠（AdSense, GPT, Taboola, Outbrain, popIn, YDN, i-mobile, MicroAd, はてなブログの広告枠 など）を CSS で非表示
  - 画面下に追従する広告オーバーレイの除去、広告による勝手な App Store 遷移・ポップアップの阻止
  - JavaScript オフの「超軽量モード」（設定）
  - 独自のブロックドメインを追加可能（設定）
  - スワイプで戻る/進む、共有、Safari で開く
- **ブコメ**: 記事を読みながらハーフシートでコメント一覧（コメントなしブクマの表示切替）

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
├── Models/Entry.swift          エントリ・カテゴリ定義
├── Services/
│   ├── HatenaAPI.swift         RSS / ブコメ(jsonlite) 取得
│   ├── RSSParser.swift         RSS 1.0 パーサ
│   ├── AdBlocker.swift         内蔵の広告ブロックルール（ドメイン・セレクタはここで編集）
│   ├── FilterListConverter.swift  Adblock Plus 形式 → WKContentRuleList 変換
│   ├── FilterListManager.swift    フィルタリストの取得・コンパイル・自動更新
│   └── ReadHistory.swift       既読管理
└── Views/
    ├── EntryListView.swift     一覧
    ├── EntryRow.swift
    ├── ArticleView.swift       記事ビュー
    ├── WebViewModel.swift      WKWebView 制御（遷移・ポップアップ制御）
    ├── CommentsView.swift      ブコメ
    └── SettingsView.swift
```

## 使っているエンドポイント

- 一覧: `https://b.hatena.ne.jp/{hotentry|entrylist}/{category}.rss`
- ブコメ: `https://b.hatena.ne.jp/entry/jsonlite/?url={記事URL}`
- フィルタ: `raw.githubusercontent.com` の easylist/easylist（gh-pages）と AdguardTeam/FiltersRegistry

個人利用を想定したアプリです。
