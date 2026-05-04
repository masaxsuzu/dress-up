"use client";

import { useState } from "react";
import {
  ClothingCategorySchema,
  PatternSchema,
  SeasonSchema,
  type ClothingItemInput,
  type Color,
  type VLMExtraction,
} from "@/schema/clothing";
import { resizeImageForUpload } from "@/lib/resize-image";

const CATEGORIES = ClothingCategorySchema.options;
const PATTERNS = PatternSchema.options;
const SEASONS = SeasonSchema.options;

export default function AddPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<VLMExtraction | null>(null);
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setDraft(data.extraction);
      } else {
        setError(data.error ?? "VLM抽出に失敗しました。属性を手動で入力してください。");
        setDraft(emptyExtraction());
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
      brand: brand || null,
      notes: notes || null,
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
        padding: "2rem",
        maxWidth: 640,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p>
        <a href="/">← 一覧に戻る</a>
      </p>
      <h1>服を追加</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <input type="file" accept="image/*" onChange={onFileChange} />
        {previewUrl && (
          <div style={{ marginTop: "0.75rem" }}>
            <img
              src={previewUrl}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: 400,
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            />
          </div>
        )}
      </section>

      {file && !draft && (
        <button
          onClick={onExtract}
          disabled={extracting}
          style={btn(extracting)}
        >
          {extracting ? "解析中..." : "属性を抽出"}
        </button>
      )}

      {draft && (
        <ExtractionForm
          value={draft}
          onChange={setDraft}
          brand={brand}
          notes={notes}
          onBrandChange={setBrand}
          onNotesChange={setNotes}
        />
      )}

      {draft && (
        <button onClick={onSave} disabled={saving} style={btn(saving)}>
          {saving ? "保存中..." : "保存"}
        </button>
      )}

      {error && (
        <p style={{ color: "#c00", whiteSpace: "pre-wrap" }}>{error}</p>
      )}
    </main>
  );
}

function emptyExtraction(): VLMExtraction {
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
  };
}

function btn(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.6rem 1.2rem",
    background: disabled ? "#999" : "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    marginRight: "0.5rem",
  };
}

function ExtractionForm({
  value,
  onChange,
  brand,
  notes,
  onBrandChange,
  onNotesChange,
}: {
  value: VLMExtraction;
  onChange: (v: VLMExtraction) => void;
  brand: string;
  notes: string;
  onBrandChange: (s: string) => void;
  onNotesChange: (s: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "0.9rem", marginBottom: "1.5rem" }}>
      <Field label="カテゴリ">
        <select
          value={value.category}
          onChange={(e) =>
            onChange({ ...value, category: e.target.value as never })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="サブカテゴリ">
        <input
          value={value.subcategory ?? ""}
          onChange={(e) =>
            onChange({ ...value, subcategory: e.target.value || null })
          }
          placeholder="例: Tシャツ、デニム"
        />
      </Field>

      <Field label="カラー (各行 name,#hex)">
        <textarea
          rows={Math.max(2, value.colors.length)}
          value={value.colors.map((c) => `${c.name},${c.hex}`).join("\n")}
          onChange={(e) =>
            onChange({ ...value, colors: parseColors(e.target.value) })
          }
        />
      </Field>

      <Field label="柄">
        <select
          value={value.pattern ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              pattern: (e.target.value || null) as never,
            })
          }
        >
          <option value="">(なし)</option>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="素材">
        <input
          value={value.material ?? ""}
          onChange={(e) =>
            onChange({ ...value, material: e.target.value || null })
          }
        />
      </Field>

      <Field label="シルエット">
        <input
          value={value.silhouette ?? ""}
          onChange={(e) =>
            onChange({ ...value, silhouette: e.target.value || null })
          }
        />
      </Field>

      <Field label="シーズン">
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {SEASONS.map((s) => (
            <label key={s} style={{ display: "flex", gap: 4 }}>
              <input
                type="checkbox"
                checked={value.season.includes(s)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    season: e.target.checked
                      ? [...value.season, s]
                      : value.season.filter((x) => x !== s),
                  })
                }
              />
              {s}
            </label>
          ))}
        </div>
      </Field>

      <Field label="フォーマル度 (1-5)">
        <input
          type="number"
          min={1}
          max={5}
          value={value.formality}
          onChange={(e) =>
            onChange({ ...value, formality: Number(e.target.value) })
          }
        />
      </Field>

      <Field label="シーン (カンマ区切り)">
        <input
          value={value.occasion.join(", ")}
          onChange={(e) =>
            onChange({ ...value, occasion: parseList(e.target.value) })
          }
        />
      </Field>

      <Field label="タグ (カンマ区切り)">
        <input
          value={value.tags.join(", ")}
          onChange={(e) =>
            onChange({ ...value, tags: parseList(e.target.value) })
          }
        />
      </Field>

      <Field label="ブランド">
        <input value={brand} onChange={(e) => onBrandChange(e.target.value)} />
      </Field>

      <Field label="メモ">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: "0.85rem", color: "#666" }}>{label}</span>
      {children}
    </label>
  );
}

function parseColors(text: string): Color[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, hex] = line.split(",").map((s) => s.trim());
      return { name: name || "unknown", hex: hex || "#000000" };
    });
}

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
