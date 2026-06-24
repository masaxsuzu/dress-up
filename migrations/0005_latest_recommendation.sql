-- 最新の提案を 1 ユーザ 1 行で保持。新しい提案が走ったら ON CONFLICT で上書き。
-- proposals は ProposalItemDraft (owned: id / buy: category + description) を
-- JSON 配列で持つ。owned は id だけ保持し、見返し時に現在のワードローブから
-- hydrate するので「アイテムが削除済み」のケースも安全に扱える。
CREATE TABLE latest_recommendation (
  user_email TEXT    PRIMARY KEY,
  tpo        TEXT    NOT NULL,
  season     TEXT    NOT NULL,
  proposals  TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
