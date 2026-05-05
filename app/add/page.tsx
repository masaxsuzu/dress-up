"use client";

import { useState, useEffect } from "react";
import {
  ClothingCategorySchema,
  PatternSchema,
  SeasonSchema,
  type ClothingItemInput,
  type ClothingItemUpdate,
  type VLMExtraction,
} from "@/schema/clothing";
import { takePendingFile } from "@/components/add-button";
import { resizeImageForUpload } from "@/lib/resize-image";
import { ClothingForm, primaryBtn } from "@/components/clothing-form";

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
      const data = (await res.json()) as {
        imageKey?: string;
        extraction?: VLMExtraction | null;
        error?: string;
      };
      if (data.imageKey) setImageKey(data.imageKey);
      if (data.extraction) {
        setDraft(sanitizeExtraction(data.extraction));
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
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        padding: "1rem",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <p style={{ margin: "0 0 1rem" }}>
        <a href="/" style={{ color: "#666" }}>
          ← 一覧に戻る
        </a>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.4rem" }}>服を追加</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            padding: "1rem",
            border: "2px dashed #ccc",
            borderRadius: 10,
            background: "#fff",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <input
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
                borderRadius: 8,
                border: "1px solid #eee",
                background: "#fff",
              }}
            />
          </div>
        )}
      </section>

      {file && !draft && (
        <button
          onClick={onExtract}
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
        <button onClick={onSave} disabled={saving} style={primaryBtn(saving)}>
          {saving ? "保存中..." : "保存"}
        </button>
      )}

      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap", marginTop: "1rem" }}>
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

function sanitizeExtraction(extraction: VLMExtraction): ClothingItemUpdate {
  const validCategories = ClothingCategorySchema.options as readonly string[];
  const validPatterns = PatternSchema.options as readonly string[];
  const validSeasons = SeasonSchema.options as readonly string[];

  return {
    category: validCategories.includes(extraction.category)
      ? extraction.category
      : "tops",
    subcategory: extraction.subcategory,
    colors: extraction.colors,
    pattern:
      extraction.pattern === null || validPatterns.includes(extraction.pattern)
        ? extraction.pattern
        : null,
    material: extraction.material,
    silhouette: extraction.silhouette,
    season: extraction.season.filter((s) => validSeasons.includes(s)) as ClothingItemUpdate["season"],
    formality: extraction.formality,
    occasion: extraction.occasion,
    tags: extraction.tags,
    brand: null,
    notes: null,
  };
}
