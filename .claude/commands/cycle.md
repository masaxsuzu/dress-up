---
description: 型チェック + 全 unit テスト + (引数があれば) playwright e2e を 1 ターンで回す
argument-hint: "[e2e]"
---

# /cycle

「変更を入れたら必ずこれを通す」サイクル。引数 `e2e` を付けた時だけ Playwright も回す (遅いので普段はスキップ)。

## やること

1. `npx tsc --noEmit` で型チェック
2. `npx vitest run` で全 unit + 統合テスト
3. もし `$ARGUMENTS` に `e2e` が含まれていれば `npx playwright test` も回す

## ルール

- 3 つは独立しているので **同じメッセージで並列に Bash 呼び出し**する。順次やらない。
- 各コマンドのフル出力は流さない。`| tail -20` などで末尾だけ取る (テスト件数とエラーが分かれば十分)。
- 全部 green なら最後に 1 行: `✓ tsc / vitest N tests / (e2e M tests)`。これだけ。
- 1 つでも fail したら、failing case の名前と最小の error 行を抜き出して、修正の方向性を 1〜2 文で提案する。修正は勝手にやらない、ユーザに確認する。
- skill / agent は使わない。Bash 直接でいい。
