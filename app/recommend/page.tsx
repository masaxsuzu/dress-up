"use client";

import { useEffect, useState } from "react";
import type { ClothingCategory, ClothingItem, Season } from "@/schema/clothing";
import { primaryBtn } from "@/components/clothing-form";

type MissingItem = { category: ClothingCategory; description: string };
type OutfitResult = {
  kind: "outfit";
  items: ClothingItem[];
  reason: string;
};
type ShoppingResult = {
  kind: "shopping";
  missing: MissingItem[];
  reason: string;
};
type Result = OutfitResult | ShoppingResult;

const SEASON_LABEL: Record<Season, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

const CATEGORY_LABEL: Record<ClothingCategory, string> = {
  tops: "トップス",
  outerwear: "アウター",
  bottoms: "ボトムス",
  dress: "ワンピース",
  shoes: "シューズ",
  bag: "バッグ",
  accessory: "アクセサリー",
  other: "その他",
};

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
        <a href="/" style={{ color: "#666" }}>
          ← 一覧に戻る
        </a>
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

function OutfitCard({
  outfit,
  tpo,
  season,
}: {
  outfit: OutfitResult;
  tpo: string;
  season: Season;
}) {
  return (
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: "0.75rem",
        background: "#fff",
      }}
    >
      <OutfitFullBodyImage items={outfit.items} tpo={tpo} season={season} />

      <h2
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.8rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        使ったアイテム
      </h2>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          margin: "0 0 0.75rem",
          paddingBottom: "0.25rem",
        }}
      >
        {outfit.items.map((item) => (
          <a
            key={item.id}
            href={`/items/${item.id}`}
            style={{ flexShrink: 0, textDecoration: "none", color: "#111" }}
          >
            <img
              src={`/api/images/${item.imageKey}`}
              alt={item.subcategory ?? item.category}
              style={{
                width: 72,
                height: 72,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid #eee",
                display: "block",
              }}
            />
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.7rem",
                color: "#666",
                textAlign: "center",
                maxWidth: 72,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {item.subcategory ?? item.category}
            </p>
          </a>
        ))}
      </div>

      <h2
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.8rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        説明
      </h2>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
        {outfit.reason}
      </p>
    </article>
  );
}

function OutfitFullBodyImage({
  items,
  tpo,
  season,
}: {
  items: ClothingItem[];
  tpo: string;
  season: Season;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function onGenerate() {
    setState("running");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/outfit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_ids: items.map((i) => i.id),
          tpo,
          season,
        }),
      });
      if (!res.ok) {
        const ct = res.headers.get("Content-Type") ?? "";
        const msg = ct.includes("json")
          ? (((await res.json()) as { error?: string }).error ?? "生成失敗")
          : `${res.status}`;
        throw new Error(msg);
      }
      const blob = await res.blob();
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(blob));
      setState("done");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setState("error");
    }
  }

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {state === "done" && url && (
        <img
          src={url}
          alt="全身コーデ"
          style={{
            width: "100%",
            maxWidth: 480,
            display: "block",
            margin: "0 auto 0.5rem",
            borderRadius: 8,
            border: "1px solid #eee",
          }}
        />
      )}
      {state === "running" && (
        <div
          style={{
            padding: "1.5rem 0.75rem",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          全身イメージを生成中…
        </div>
      )}
      {state === "error" && (
        <p
          style={{
            color: "#c00",
            fontSize: "0.85rem",
            margin: "0 0 0.5rem",
          }}
        >
          生成に失敗しました: {errorMsg}
        </p>
      )}
      {state !== "running" && (
        <button
          onClick={onGenerate}
          style={{
            ...primaryBtn(false),
            background: "#fff",
            color: "#111",
            border: "1px solid #111",
            width: "100%",
          }}
        >
          {state === "done"
            ? "全身イメージを作り直す"
            : state === "error"
              ? "全身イメージを再試行"
              : "全身イメージを生成（AI 画像、~10 秒）"}
        </button>
      )}
    </div>
  );
}

function ShoppingCard({ shopping }: { shopping: ShoppingResult }) {
  return (
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: "0.75rem",
        background: "#fff",
      }}
    >
      <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
        買い足したいアイテム
      </h2>
      <p
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.85rem",
          color: "#555",
          background: "#f7f5ef",
          border: "1px solid #ece7d8",
          borderRadius: 6,
          padding: "0.5rem 0.6rem",
        }}
      >
        このシーンに合うコーデを既存のワードローブから組めなかったため、買い足し候補を提案します。
      </p>
      <ul style={{ margin: "0 0 0.75rem", padding: 0, listStyle: "none" }}>
        {shopping.missing.map((m, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.5rem",
              padding: "0.4rem 0",
              borderBottom:
                i === shopping.missing.length - 1 ? "none" : "1px solid #eee",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                color: "#fff",
                background: "#888",
                borderRadius: 4,
                padding: "0.1rem 0.4rem",
                whiteSpace: "nowrap",
              }}
            >
              {CATEGORY_LABEL[m.category]}
            </span>
            <span style={{ fontSize: "0.9rem" }}>{m.description}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
        {shopping.reason}
      </p>
    </article>
  );
}
