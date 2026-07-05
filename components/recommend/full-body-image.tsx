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
    // マウント/trigger 変化直後に生成状態へ入る必要があり、effect 外に出すと
    // ボタン押下 → trigger 更新 → 再生成の一連の流れが崩れるため、この
    // setState はここに置く (react-hooks/set-state-in-effect は意図的に許容)。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- データ取得 effect の開始状態遷移。関数コンポーネント外への抽出は本 PR のスコープ外
    setState("running");
    setErrorMsg(null);

    void (async () => {
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
          let msg = `${res.status}`;
          if (ct.includes("json")) {
            const body: { error?: string } = await res.json();
            msg = body.error ?? "生成失敗";
          }
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
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        />
      )}
      {state === "idle" && (
        <button
          onClick={() => setTrigger((t) => t + 1)}
          className="btn btn-outline"
          style={{ width: "100%", padding: "0.7rem 0.9rem" }}
        >
          全身画像を生成
        </button>
      )}
      {state === "running" && (
        <div
          style={{
            padding: "2rem 0.75rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--muted)",
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
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p
            style={{
              color: "var(--danger)",
              fontSize: "0.85rem",
              margin: "0 0 0.5rem",
            }}
          >
            画像の生成に失敗しました: {errorMsg}
          </p>
          <button
            onClick={() => setTrigger((t) => t + 1)}
            className="btn btn-outline"
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
