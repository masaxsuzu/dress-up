# /merge-deps

オープン中の Dependabot PR を **read → validate → merge** の固定順で処理する。判断の飛ばし・順序入れ替え禁止。

**前提**: patch / minor の green PR は `dependabot-automerge.yml` が自動マージするため、このスキルの対象は **check が red の PR と major bump のみ**。green の patch/minor が残っている場合は auto-merge が動いていない兆候（リポ設定「Allow auto-merge」が無効の可能性）なので、手動マージしつつユーザに報告する。

## 手順

1. `list_pull_requests` (state=open) で `dependabot[bot]` の PR を列挙（`per_page: 20`、body は読まない）
2. 各 PR について古い番号から順に:
   1. `pull_request_read` (method=`get`) で `head.sha` / `mergeable_state` を取得
   2. `pull_request_read` (method=`get_check_runs`) で check を確認。**check が現在の `head.sha` に対するものであること**（`started_at` が rebase 前なら古い世代 — 判断に使わない）
   3. 全ゲート check（`test` / `Build (deploy parity)` / CodeQL 系）が `success` → `merge_pull_request`（`merge_method: "merge"`）
   4. pending あり → `ScheduleWakeup` 90s で次の wake に持ち越し
   5. failure あり → `get_job_logs` で診断:
      - **構造的**（preview の secrets 非供給など、変更内容と無関係）→ ゲート check green ならマージ可
      - **依存起因**（`npm ci` ERESOLVE、型エラー等）→ 最小修正を push するか、非互換 major なら `@dependabot ignore this major version` + 理由コメントでクローズ
3. 処理が全 PR 分終わったら **merged / ignored / waiting の一覧を 1 メッセージで報告**（PR ごとの逐次報告はしない）

## ルール

- `@dependabot rebase` を打った場合、処理まで数分〜15分かかる。90s burst でポーリングし続けず、270s 間隔で最大 15 分待つ。未処理のままでもゲート green + 失敗が構造的なら 2-3 のとおりマージしてよい
- CI 設定変更（workflows/ 配下）の PR が同時に open なら、**そちらを先に**マージして main green を確認してから依存 PR に着手
- self-review は不要（diff はバージョン文字列のみのため）。ただし actions の major bump は該当アクションが green の CI ジョブ内で実行されたことを確認する
