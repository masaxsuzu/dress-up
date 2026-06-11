"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClothingItem, Season } from "@/schema/clothing";
import { primaryBtn } from "@/components/clothing-form";
import { SEASON_LABEL } from "@/lib/labels";
import { OutfitCard } from "@/components/recommend/outfit-card";
import { ShoppingCard } from "@/components/recommend/shopping-card";
import type { MissingItem, Result } from "@/components/recommend/types";

export default function RecommendPage() {
  const [tpo, setTpo] = useState("");
  const [submittedTpo, setSubmittedTpo] = useState("");
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    const trimmed = tpo.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSeason(null);
    setSubmittedTpo(trimmed);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tpo: trimmed }),
      });
      const data = (await res.json()) as {
        season?: Season;
        kind?: "outfit" | "shopping";
        items?: ClothingItem[];
        missing?: MissingItem[];
        reason?: string;
        error?: string | { formErrors?: string[] };
      };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "提案に失敗しました";
        throw new Error(msg);
      }
      if (data.season) setSeason(data.season);
      if (data.kind === "outfit" && data.items && data.reason) {
        setResult({
          kind: "outfit",
          items: data.items,
          reason: data.reason,
        });
      } else if (data.kind === "shopping" && data.missing && data.reason) {
        setResult({
          kind: "shopping",
          missing: data.missing,
          reason: data.reason,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 900, margin: "0 auto" }}>
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
          {loading ? "提案中..." : "コーデを見つける"}
        </button>
      </section>

      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap" }}>{error}</p>
      )}

      {season && result && (
        <section>
          <p
            style={{
              color: "#666",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
            }}
          >
            季節: {SEASON_LABEL[season]} /{" "}
            {result.kind === "outfit" ? "コーデ提案" : "買い足し提案"}
          </p>
          {result.kind === "outfit" ? (
            <OutfitCard outfit={result} tpo={submittedTpo} season={season} />
          ) : (
            <ShoppingCard shopping={result} />
          )}
        </section>
      )}
    </main>
  );
}
