"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm("このアイテムを削除しますか？")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(await res.text());
      }
      router.push("/");
      router.refresh();
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
