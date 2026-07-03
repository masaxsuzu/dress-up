"use client";

// 提案 1 案分の全身コーデ画像を /api/outfit-image で生成して表示する。
// auto=true はマウント時に自動発火 (fresh 提案)、false はボタン押下待ち (見返し)。
import { useEffect, useState } from "react";
import type { ClothingCategory, Season } from "@/schema/clothing";
import type { Proposal, ProposalItem } from "@/schema/recommend";

// /api/outfit-image に渡す形 (owned は id、buy は category+description)。
type ImageRequestItem =
  | { kind: "owned"; id: string }
  | { kind: "buy"; category: ClothingCategory; description: string };

function toRequestItem(it: ProposalItem): ImageRequestItem {
  return it.kind === "owned"
    ? { kind: "owned", id: it.item.id }
    : { kind: "buy", category: it.category, description: it.description };
}

export function FullBodyImage({
  proposal,
  tpo,
  season,
  auto,
}: {
  proposal: Proposal;
  tpo: string;
  season: Season;
  auto: boolean;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    auto ? "running" : "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(auto ? 1 : 0);

  useEffect(() => {
    if (trigger === 0) return; // ボタン待ち状態
    const controller = new AbortController();
    let blobUrl: string | null = null;
    setState("running");
    setErrorMsg(null);

    (async () => {
      try {
        const res = await fetch("/api/outfit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: proposal.items.map(toRequestItem),
            tpo,
            season,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const ct = res.headers.get("Content-Type") ?? "";
          const msg = ct.includes("json")
            ? (((await res.json()) as { error?: string }).error ?? "生成失敗")
            : `${res.status}`;
          throw new Error(msg);
        }
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setState("done");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErrorMsg((e as Error).message);
        setState("error");
      }
    })();

    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // proposal が差し替わったとき (fresh) は auto 由来で再走、ボタンの時は trigger 増加で再走
  }, [proposal, tpo, season, trigger]);

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
            margin: "0 auto",
            borderRadius: 8,
            border: "1px solid #eee",
          }}
        />
      )}
      {state === "idle" && (
        <button
          onClick={() => setTrigger((t) => t + 1)}
          style={{
            width: "100%",
            padding: "0.7rem 0.9rem",
            fontSize: "0.9rem",
            background: "#fff",
            color: "#111",
            border: "1px solid #111",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          全身画像を生成
        </button>
      )}
      {state === "running" && (
        <div
          style={{
            padding: "2rem 0.75rem",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
            textAlign: "center",
          }}
        >
          全身イメージを生成中…
        </div>
      )}
      {state === "error" && (
        <div
          style={{
            padding: "0.75rem",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <p
            style={{
              color: "#c00",
              fontSize: "0.85rem",
              margin: "0 0 0.5rem",
            }}
          >
            画像の生成に失敗しました: {errorMsg}
          </p>
          <button
            onClick={() => setTrigger((t) => t + 1)}
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.85rem",
              background: "#fff",
              color: "#111",
              border: "1px solid #111",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
