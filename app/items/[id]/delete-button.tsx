"use client";

import { useState } from "react";
import { actionBtnStyle } from "@/lib/ui";

export function DeleteButton({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm("このアイテムを削除しますか？")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `削除に失敗 (status ${res.status})`);
      }
      // router.push + refresh は RSC キャッシュが残るケースで一覧から消えないことが
      // あったので、確実にリロードされるハードナビゲーションに統一する。
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={onDelete}
        disabled={deleting}
        style={actionBtnStyle({ variant: "danger", disabled: deleting })}
      >
        {deleting ? "削除中..." : "削除"}
      </button>
      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
    </>
  );
}
