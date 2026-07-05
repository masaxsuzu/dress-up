"use client";

import { useState, useEffect } from "react";
import {
  type ClothingItemInput,
  type ClothingItemUpdate,
  type VLMExtraction,
} from "@/schema/clothing";
import { takePendingFile } from "@/components/add-button";
import { resizeImageForUpload } from "@/lib/resize-image";
import { ClothingForm, primaryBtn } from "@/components/clothing-form";
import { pageStyle } from "@/lib/ui";
import { sanitizeToUpdate } from "@/lib/sanitize";

export default function AddPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClothingItemUpdate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const f = takePendingFile();
    if (f) {
      // takePendingFile() はモジュール変数を pop する副作用を持つため、render
      // 本体で呼ぶと StrictMode の二重 render で消費されてしまう。mount 時に
      // 一度だけ effect で処理する必要があるため、この setState はここに置く。
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部シングルトンの一度限りの消費。render 本体への移動は StrictMode 二重実行で壊れるため不可
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setDraft(null);
    setImageKey(null);
    setError(null);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function onExtract() {
    if (!file) return;
    setExtracting(true);
    setError(null);
    try {
      const resized = await resizeImageForUpload(file);
      const fd = new FormData();
      fd.append("file", resized);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data: {
        imageKey?: string;
        extraction?: VLMExtraction | null;
        error?: string;
      } = await res.json();
      if (data.imageKey) setImageKey(data.imageKey);
      if (data.extraction) {
        setDraft(sanitizeToUpdate({ ...data.extraction, brand: null, notes: null }).sanitized);
      } else {
        setError(data.error ?? "属性の自動抽出に失敗しました。手動で入力してください。");
        setDraft(emptyDraft());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function onSave() {
    if (!imageKey || !draft) return;
    setSaving(true);
    setError(null);
    const payload: ClothingItemInput = {
      ...draft,
      imageKey,
    };
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      // 登録直後にアイコン化を fire-and-forget で投げる。完了を待たずに一覧へ
      // 戻るので、戻った頃にはサムネイルが入っている。失敗しても本体は登録
      // 済みなので、詳細ページの「アイコン化」ボタンから手動で再生できる。
      const { item }: { item: { id: string } } = await res.json();
      void fetch(`/api/items/${item.id}/iconize`, {
        method: "POST",
        keepalive: true,
      });
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={pageStyle(640)}>
      <p style={{ margin: "0 0 1rem" }}>
        <a href="/" style={{ color: "var(--muted)" }}>
          ← 一覧に戻る
        </a>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.4rem" }}>服を追加</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            padding: "1rem",
            border: "2px dashed var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <input
            data-testid="photo-file-input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <span style={{ fontSize: "0.95rem" }}>
            {file ? "別の写真を選ぶ" : "写真を選ぶ"}
          </span>
        </label>
        {previewUrl && (
          <div style={{ marginTop: "0.75rem" }}>
            <img
              src={previewUrl}
              alt=""
              style={{
                width: "100%",
                maxHeight: "50vh",
                objectFit: "contain",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            />
          </div>
        )}
      </section>

      {file && !draft && (
        <button
          onClick={() => void onExtract()}
          disabled={extracting}
          style={primaryBtn(extracting)}
        >
          {extracting ? "解析中..." : "属性を抽出"}
        </button>
      )}

      {draft && (
        <ClothingForm value={draft} onChange={setDraft} />
      )}

      {draft && (
        <button onClick={() => void onSave()} disabled={saving} style={primaryBtn(saving)}>
          {saving ? "保存中..." : "保存"}
        </button>
      )}

      {error && (
        <p
          style={{
            color: "var(--danger)",
            whiteSpace: "pre-wrap",
            marginTop: "1rem",
          }}
        >
          {error}
        </p>
      )}
    </main>
  );
}

function emptyDraft(): ClothingItemUpdate {
  return {
    category: "tops",
    subcategory: null,
    colors: [{ name: "black", hex: "#000000" }],
    pattern: null,
    material: null,
    silhouette: null,
    season: ["spring"],
    formality: 2,
    occasion: [],
    tags: [],
    brand: null,
    notes: null,
  };
}

