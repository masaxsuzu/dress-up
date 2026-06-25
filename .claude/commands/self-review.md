---
description: 指定 PR の diff をレビュー (静的) + 実 deploy 確認 (CI で curl 済) して clean / suspicious / broken を判定し、結果を PR コメントに投稿する。babysitter の自動マージ前のゲート
argument-hint: "<PR number>"
---

# /self-review

PR babysitter が **自動マージする前** に必ず通すレビュー。`$ARGUMENTS` に PR 番号を渡す (例: `/self-review 60`)。判定はこの 3 値:

| Verdict | 行動 |
|---------|------|
| ✓ clean | 問題なし、babysitter は merge へ進む |
| ⚠ suspicious | 不確かな点があり、判断を user に投げる (AskUserQuestion) |
| ✗ broken | 明らかな問題 (壊れた assertion / 抜けた null check / 型違反 / preview verify 失敗) を見つけた。修正して同じ PR ブランチに push、resolve thread |

## 手順

1. `mcp__github__pull_request_read` (method=`get`) で PR メタ取得 (title / body / head SHA)
2. `mcp__github__pull_request_read` (method=`get_diff`) で diff を取得
3. `mcp__github__pull_request_read` (method=`get_files`) で変更ファイル一覧を取得
4. 下のチェックリスト (静的) を通す
5. **Deploy verification** — `.github/workflows/preview.yml` の `Verify preview deploy` ステップが既に preview deploy 直後に `scripts/verify-preview.sh` を CI 上で実行している。Claude Code セッションから workers.dev に直接 curl はできない (agent proxy が policy で 403 を返す) ので、ここでは CI 結果を信用する:
   - `mcp__github__pull_request_read` (method=`get_check_runs`) で `preview` ジョブが `completed` かつ `conclusion: "success"` なら verify pass 扱い
   - `preview` が failure / cancelled / skipped なら **broken**
6. 静的レビュー + CI 結果を合算して verdict を決める
7. **verdict を PR コメントとして投稿:** `mcp__github__add_issue_comment` で結果サマリを書く (下の出力フォーマット参照)

## チェックリスト (このリポジトリ固有)

**Correctness:**
- Zod schema に変更があるとき、`lib/db.ts` の row → object マッピングや migration と整合してるか
- `route()` wrapper を使ってるか (`getCloudflareContext` / `getUserEmail` を直に呼んでないか)
- `user_email` で scoping してるか (新規 D1 query を足したとき)
- `process.env` を使ってないか (Cloudflare bindings に限る)
- `atob` を呼ぶコードは valid base64 を期待してるか (テストで `imageResponse` 使ってるか)

**Security:**
- 新規 `/api/images/[...key]` 系で owner check (`imageKeyOwnedBy`) 通してるか
- multipart upload の Content-Type ホワイトリスト / サイズ上限が他 endpoint と揃ってるか
- Secret や API key を直書きしてないか

**Tests:**
- `lib/*.ts` への変更には対応する `test/lib/*.test.ts` の更新があるか
- `app/api/**/route.ts` への変更には `test/api/*.test.ts` の更新があるか (新規エンドポイントなら新規テスト)
- e2e (`e2e/**/*.spec.ts`) は壊れていないか (page title / role / locator が変わっていれば spec も更新が必要)

**Quality:**
- 新規ファイルが規約に沿ってるか (route handler は `route()`, テストは shared helpers, factories)
- コミットメッセージが具体的か (「Fix bug」みたいな空メッセージじゃない)
- 過剰なリファクタや無関係なファイル変更が混じってないか

**Suspicious sign:**
- diff に `// TODO` や `// FIXME` が残っている
- テストを skip / .only にしている
- timeout を急に長くしてる (今回は弱い signal だが justify されてるか確認)
- 型 assertion (`as unknown as Foo`) が増えてる

## 出力フォーマット (PR コメント本文)

```markdown
**Self-review: ✓ clean | ⚠ suspicious | ✗ broken** (commit `<short sha>`)

Static: <1 文の総評>
Deploy: ✓ preview ジョブ green (verify-preview.sh PASS)  (or)  ✗ preview ジョブ failure

[suspicious / broken のときだけ箇条書きで懸念点 1〜3 個]
```

例:

```
**Self-review: ✓ clean** (commit `dca84f6`)

Static: 9 行差分の docs only、suspicious sign 無し。
Deploy: ✓ preview ジョブ green (verify-preview.sh PASS)
```

## ルール

- 静的レビューも deploy 確認も MCP github tool で完結する (skill / agent / Bash 使わない)
- 自分で書いた diff だからといって甘くしない。「もし他人が出してきたらここ指摘するか?」で判定する
- diff が 100 行以下なら全部読む。100 行超なら、変更が密集してるホットスポット (`get_files` の additions が多いファイル) を優先
- verdict コメントは必ず投稿する (gate がコメントを見て判断する人にも見える)
