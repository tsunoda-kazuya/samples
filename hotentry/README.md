# ホッテントリ (Hotentry Reader)

はてなブックマークの [ホッテントリ](https://b.hatena.ne.jp/hotentry/) を読むための iOS アプリ。
公式アプリでは記事ページの広告ブロックが効かない問題を解決するため、**記事を広告ブロック付きのアプリ内ブラウザで開く**ことに特化しています。

## 機能

- **一覧**: 人気 / 新着 × カテゴリ（総合・一般・世の中・政治と経済・暮らし・学び・テクノロジー・おもしろ・エンタメ・アニメとゲーム）
  - サムネイル・ファビコン・users 数・投稿時刻
  - 既読はグレー表示（「既読を隠す」設定あり）、引っ張って更新
  - 右スワイプ → Safari リーダーで開く / 左スワイプ → 既読にする / 長押し → プレビュー・共有
  - ミュートワード（タイトル・URL・ドメインで非表示）
- **記事ビュー（広告ブロック付き WKWebView）**
  - 広告・トラッカー配信ドメイン約 120 件をネットワークレベルで遮断（`WKContentRuleList`）
  - よくある広告枠（AdSense, GPT, Taboola, Outbrain, popIn, YDN, i-mobile, MicroAd, はてなブログの広告枠 など）を CSS で非表示
  - 画面下に追従する広告オーバーレイの除去、広告による勝手な App Store 遷移・ポップアップの阻止
  - JavaScript オフの「超軽量モード」（設定）
  - 独自のブロックドメインを追加可能（設定）
  - スワイプで戻る/進む、共有、Safari で開く
- **ブコメ**: 記事を読みながらハーフシートでコメント一覧（コメントなしブクマの表示切替）
- **Safari リーダーで開く**: `SFSafariViewController` のリーダー表示。Safari に入れているコンテンツブロッカー（280blocker / AdGuard 等）もそのまま効きます

## ビルド方法

必要: Mac + Xcode 16 以降（iOS 17 以降の端末）

1. `hotentry/HotentryReader.xcodeproj` を Xcode で開く
2. ターゲット **HotentryReader** → *Signing & Capabilities* で **Team** に自分の Apple ID を選択
   - Bundle Identifier が使えないと言われたら `jp.hotentryreader.app.k7x2` を任意の文字列に変更
3. iPhone を接続して ▶︎ (Run)
   - 初回は iPhone の「設定 > 一般 > VPN とデバイス管理」で開発元を信頼
   - 無料の Apple ID の場合、アプリは 7 日で期限切れになるので再度 Run してください

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
│   ├── AdBlocker.swift         広告ブロックルール（ドメイン・セレクタはここで編集）
│   └── ReadHistory.swift       既読管理
└── Views/
    ├── EntryListView.swift     一覧
    ├── EntryRow.swift
    ├── ArticleView.swift       記事ビュー
    ├── WebViewModel.swift      WKWebView 制御（遷移・ポップアップ制御）
    ├── CommentsView.swift      ブコメ
    ├── SafariView.swift
    └── SettingsView.swift
```

## 使っているエンドポイント

- 一覧: `https://b.hatena.ne.jp/{hotentry|entrylist}/{category}.rss`
- ブコメ: `https://b.hatena.ne.jp/entry/jsonlite/?url={記事URL}`

個人利用を想定したアプリです。
