"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import {
  type ClothingItem,
  type ClothingItemUpdate,
} from "@/schema/clothing";
import { ClothingForm, primaryBtn } from "@/components/clothing-form";
import { sanitizeToUpdate } from "@/lib/sanitize";

export default function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [item, setItem] = useState<ClothingItem | null>(null);
  const [draft, setDraft] = useState<ClothingItemUpdate | null>(null);
  const [invalidFieldWarning, setInvalidFieldWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json() as Promise<{ item?: ClothingItem; error?: string }>)
      .then((data) => {
        if (!data.item) {
          setError(data.error ?? "not found");
          return;
        }
        setItem(data.item);
        const { sanitized, hadInvalidFields } = sanitizeToUpdate(data.item);
        setDraft(sanitized);
        setInvalidFieldWarning(hadInvalidFields);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      window.location.href = `/items/${id}`;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "1rem", maxWidth: 640, margin: "0 auto" }}>
        <p style={{ color: "#888" }}>読み込み中...</p>
      </main>
    );
  }

  if (error && !draft) {
    return (
      <main style={{ padding: "1rem", maxWidth: 640, margin: "0 auto" }}>
        <p style={{ color: "#c00" }}>{error}</p>
        <a href="/" style={{ color: "#666" }}>← 一覧に戻る</a>
      </main>
    );
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 640, margin: "0 auto" }}>
      <p style={{ margin: "0 0 1rem" }}>
        <a href={`/items/${id}`} style={{ color: "#666" }}>
          ← 詳細に戻る
        </a>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.4rem" }}>アイテムを編集</h1>

      {item && (
        <div style={{ marginBottom: "1.5rem" }}>
          <img
            src={`/api/images/${item.imageKey}`}
            alt={item.subcategory ?? item.category}
            style={{
              width: "100%",
              maxHeight: "40vh",
              objectFit: "contain",
              borderRadius: 8,
              border: "1px solid #eee",
              background: "#fff",
            }}
          />
        </div>
      )}

      {draft && (
        <ClothingForm
          value={draft}
          onChange={setDraft}
          invalidFieldWarning={invalidFieldWarning}
        />
      )}

      <button onClick={onSave} disabled={saving || !draft} style={primaryBtn(saving || !draft)}>
        {saving ? "保存中..." : "保存"}
      </button>

      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap", marginTop: "1rem" }}>
          {error}
        </p>
      )}
    </main>
  );
}

