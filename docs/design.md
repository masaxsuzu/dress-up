# 自分専用ファッションアプリ 設計サマリ

## 1. 機能 (現状)

1. 写真から手持ち服を登録 (VLM で属性抽出 → ユーザ確認・編集 → 保存)
1. 一覧・検索 (カテゴリ / シーズン / フリーテキスト / URL パラメータでの絞り込み)
1. アイテムのアイコン化 (ゴーストマネキン風サムネイルを生成。一覧サムネイルとコーデ提案結果に利用)
1. スタイル提案 (TPO に応じた手持ちアイテムの組み合わせ提案、不足アイテムは買い足し提案として返す)
1. 提案結果から全身イメージ生成 (新規提案は自動、保存提案の見返しはボタン)
1. 最新の提案を 1 セット D1 に保存し、`/recommend` 再訪時に復元表示
1. プロフィール設定 (性別・身長・体重・体型・参考画像)。提案と全身イメージに常に反映される

## 2. 技術スタック (Cloudflare完結)

|層        |採用                                            |メモ                          |
|---------|----------------------------------------------|----------------------------|
|フロント     |Next.js 15 App Router                         |                            |
|ランタイム    |Cloudflare Workers (OpenNext 経由)               |                            |
|DB       |D1                                            |SQLite ベース                  |
|画像ストレージ  |R2                                            |egress 無料                  |
|認証       |Cloudflare Access                             |Zero Trust 無料プラン (〜50ユーザー) |
|VLM (属性抽出)|Gemini 2.5 Flash                              |                            |
|コーデ推論    |Gemini 2.5 Pro                                |マルチモーダル                    |
|画像生成     |Gemini 2.5 Flash Image (Nano Banana)          |アイコン化と全身イメージ                |

### 認証戦略

- Cloudflare Access で Google/GitHub ログインを設定
- メールアドレス allowlist に自分だけ登録
- **認証コードを1行も書かずに「自分しか入れないアプリ」**

## 3. 設計判断

- **スキーマ後方互換は取らない**: 破壊的変更時はアイテムを再登録
- **VLM 失敗時**: 画像は R2 に残し、空フォームを出して手動入力できるようにする
- **Gemini 503/429**: アプリ側でリトライしない (Worker のレスポンス時間制限で接続切れする方が UX が悪い)。ユーザがボタンを押し直す
- **画像配信**: R2 への直接アクセスなし。`/api/images/[...key]` 経由
- **エラーレスポンス形状**: 全 API ルートで `{ error: string }` に統一 (`lib/api-response.ts`)
- **プロフィール**: D1 の `profile` テーブル、`user_email` を PRIMARY KEY とし、ユーザ毎 1 行。未設定なら提案・画像生成は中性デフォルト (`a young adult person`) にフォールバック
- **マルチテナント**: Cloudflare Access の `Cf-Access-Authenticated-User-Email` ヘッダを `lib/auth.ts` で取り出し、全 D1 クエリは `user_email` で絞り込む。`/api/images` も owner check 付き。ローカル/E2E ではヘッダ無しなので `dev@local` にフォールバック

## 4. コスト

- Cloudflare 一式: **0円** (Workers/D1/R2/Access すべて無料枠内)
- Gemini API: Pro/Flash Image を 1 日数回叩く程度なら**月数百円**
- ドメイン: 任意

---

*Last updated: 2026-06-12*
