---
description: 型チェック + 全 unit テスト + (引数 e2e があれば) Playwright を並列に回す。e2e は npm run dev のセットアップで 1 分前後かかる
argument-hint: "[e2e]"
---

# /cycle

「変更を入れたら必ずこれを通す」サイクル。引数 `e2e` を付けた時だけ Playwright も回す (`npm run dev` を起動するため ~1 分かかる)。

## やること

1. `npx tsc --noEmit` で型チェック
2. `npx vitest run` で全 unit + 統合テスト
3. もし `$ARGUMENTS` に `e2e` が含まれていれば `npx playwright test` も回す

## ルール

- 動かす対象 (tsc, vitest, 必要なら playwright) は **同じメッセージで並列に Bash 呼び出し**する。順次やらない。
- 出力はフルで読まず末尾だけで判断する。ただし **`| tail` は exit code を潰すので使わない**。代わりに `2>&1 | tee /tmp/cycle-tsc.log; echo EXIT=$?` のように exit code を必ず print する、あるいは output を file に落としてから tail を別コマンドで読む。tsc は green だと無出力なので `EXIT=0` の有無で判定。
- 全部 green なら最後に 1 行: `✓ tsc / vitest N tests / (e2e M tests)`。これだけ。
- 1 つでも fail したら、failing case の名前と最小の error 行を抜き出して、修正の方向性を 1〜2 文で提案する。修正は勝手にやらない、ユーザに確認する。
- skill / agent は使わない。Bash 直接でいい。
