// latest_recommendation テーブル (ユーザ毎 1 行の提案 draft) の保存/取得。
import { z } from "zod";
import { SeasonSchema, type Season } from "@/schema/clothing";
import {
  ProposalDraftSchema,
  type ProposalDraft,
} from "@/schema/recommend";

interface Row {
  user_email: string;
  tpo: string;
  season: string;
  proposals: string; // JSON encoded ProposalDraft[]
  created_at: string;
}

export type LatestRecommendation = {
  tpo: string;
  season: Season;
  proposals: ProposalDraft[];
  createdAt: string;
};

// JSON が壊れている / スキーマ変更で読めない場合は null 扱いで安全側に倒す。
const ProposalsSchema = z.array(ProposalDraftSchema);

function rowToLatest(row: Row): LatestRecommendation | null {
  const seasonParse = SeasonSchema.safeParse(row.season);
  if (!seasonParse.success) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.proposals);
  } catch {
    return null;
  }
  const proposalsParse = ProposalsSchema.safeParse(parsed);
  if (!proposalsParse.success) return null;
  return {
    tpo: row.tpo,
    season: seasonParse.data,
    proposals: proposalsParse.data,
    createdAt: row.created_at,
  };
}

export async function getLatestRecommendation(
  db: D1Database,
  userEmail: string,
): Promise<LatestRecommendation | null> {
  const row = await db
    .prepare("SELECT * FROM latest_recommendation WHERE user_email = ?")
    .bind(userEmail)
    .first<Row>();
  return row ? rowToLatest(row) : null;
}

export async function setLatestRecommendation(
  db: D1Database,
  userEmail: string,
  input: { tpo: string; season: Season; proposals: ProposalDraft[] },
): Promise<LatestRecommendation> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO latest_recommendation (user_email, tpo, season, proposals, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_email) DO UPDATE SET
         tpo = excluded.tpo,
         season = excluded.season,
         proposals = excluded.proposals,
         created_at = excluded.created_at`,
    )
    .bind(
      userEmail,
      input.tpo,
      input.season,
      JSON.stringify(input.proposals),
      now,
    )
    .run();
  return { ...input, createdAt: now };
}
