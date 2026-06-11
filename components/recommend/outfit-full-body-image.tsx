"use client";

import { useEffect, useState } from "react";
import type { ClothingItem, Season } from "@/schema/clothing";
import { primaryBtn } from "@/components/clothing-form";

export function OutfitFullBodyImage({
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
