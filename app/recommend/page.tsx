"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Season } from "@/schema/clothing";
import { primaryBtn } from "@/components/clothing-form";
import { pageStyle } from "@/lib/ui";
import { SEASON_LABEL } from "@/lib/labels";
import { ProposalCard } from "@/components/recommend/proposal-card";
import type { Proposal } from "@/schema/recommend";

type RecommendResponse = {
  season?: Season;
  proposals?: Proposal[];
  error?: string;
};

type LatestResponse = {
  latest: {
    tpo: string;
    season: Season;
    proposals: Proposal[];
    createdAt: string;
  } | null;
};

// 「現在画面に出てる提案」セット。fresh = いま POST で返ってきたもの、
// restored = D1 から復元したもの。前者は画像 auto-fire、後者はボタン待ち。
type View = {
  kind: "fresh" | "restored";
  tpo: string;
  season: Season;
  proposals: Proposal[];
  createdAt?: string;
};

export default function RecommendPage() {
  const [tpo, setTpo] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初回マウントで最新を読み込む
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recommend/latest");
        if (!res.ok) return;
        const data = (await res.json()) as LatestResponse;
        if (cancelled || !data.latest) return;
        setView({
          kind: "restored",
          tpo: data.latest.tpo,
          season: data.latest.season,
          proposals: data.latest.proposals,
          createdAt: data.latest.createdAt,
        });
      } catch {
        // latest が無い / 取得失敗は静かに無視 (主機能ではない)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    const trimmed = tpo.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setView(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tpo: trimmed }),
      });
      const data = (await res.json()) as RecommendResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "提案に失敗しました");
      }
      if (data.season && data.proposals) {
        setView({
          kind: "fresh",
          tpo: trimmed,
          season: data.season,
          proposals: data.proposals,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle(900)}>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/" style={{ color: "#666" }}>
          ← 一覧に戻る
        </Link>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.4rem" }}>コーデを提案</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.9rem",
            marginBottom: "0.5rem",
          }}
        >
          シーン・場面
          <textarea
            rows={3}
            placeholder="例: 同僚と週末ランチ、結婚式の二次会、雨の通勤"
            value={tpo}
            onChange={(e) => setTpo(e.target.value)}
            style={{
              boxSizing: "border-box",
              display: "block",
              width: "100%",
              marginTop: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.95rem",
              border: "1px solid #ddd",
              borderRadius: 6,
              resize: "vertical",
              background: "#fff",
            }}
          />
        </label>
        <button
          onClick={onSubmit}
          disabled={loading || !tpo.trim()}
          style={{
            ...primaryBtn(loading || !tpo.trim()),
            marginTop: "0.75rem",
          }}
        >
          {loading ? "提案中..." : "コーデを 3 案出す"}
        </button>
      </section>

      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap" }}>{error}</p>
      )}

      {view && (
        <section>
          <p
            style={{
              color: "#666",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
            }}
          >
            {view.kind === "restored" && view.createdAt
              ? `前回の提案 (${new Date(view.createdAt).toLocaleString("ja-JP")}) ・ シーン: ${view.tpo} ・ ${SEASON_LABEL[view.season]} ・ ${view.proposals.length} 案`
              : `シーン: ${view.tpo} ・ ${SEASON_LABEL[view.season]} ・ ${view.proposals.length} 案`}
          </p>
          {view.proposals.map((p, i) => (
            <ProposalCard
              key={`${view.kind}-${view.createdAt ?? "fresh"}-${i}`}
              proposal={p}
              index={i}
              tpo={view.tpo}
              season={view.season}
              auto={view.kind === "fresh"}
            />
          ))}
        </section>
      )}
    </main>
  );
}
