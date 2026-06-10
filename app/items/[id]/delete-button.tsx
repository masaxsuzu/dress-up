"use client";

import { useState } from "react";

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
        style={{
          padding: "0.7rem 1.2rem",
          background: deleting ? "#999" : "#c00",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: deleting ? "not-allowed" : "pointer",
          fontSize: "1rem",
          width: "100%",
        }}
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
