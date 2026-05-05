"use client";

import { useState, useRef, useCallback } from "react";
import {
  ClothingCategorySchema,
  PatternSchema,
  SeasonSchema,
  type ClothingItemUpdate,
  type Color,
} from "@/schema/clothing";
import {
  CATEGORY_LABEL,
  FORMALITY_LABEL,
  PATTERN_LABEL,
  SEASON_LABEL,
} from "@/lib/labels";

const CATEGORIES = ClothingCategorySchema.options;
const PATTERNS = PatternSchema.options;
const SEASONS = SeasonSchema.options;
const FORMALITY_LEVELS = [1, 2, 3, 4, 5];

export type { ClothingItemUpdate };

export function ClothingForm({
  value,
  onChange,
  invalidFieldWarning,
}: {
  value: ClothingItemUpdate;
  onChange: (v: ClothingItemUpdate) => void;
  invalidFieldWarning?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        marginBottom: "1.5rem",
        background: "#fff",
        padding: "1rem",
        borderRadius: 10,
        border: "1px solid #eee",
      }}
    >
      {invalidFieldWarning && (
        <p
          style={{
            margin: 0,
            padding: "0.5rem 0.75rem",
            background: "#fffbe6",
            border: "1px solid #f0c000",
            borderRadius: 6,
            fontSize: "0.85rem",
            color: "#7a5c00",
          }}
        >
          値が不正だったので初期値に戻しました
        </p>
      )}

      <Field label="カテゴリ">
        <select
          value={value.category}
          onChange={(e) =>
            onChange({ ...value, category: e.target.value as never })
          }
          style={inputStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
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
          style={inputStyle}
        />
      </Field>

      <Field label="カラー">
        <ColorEditor
          colors={value.colors}
          onChange={(colors) => onChange({ ...value, colors })}
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
          style={inputStyle}
        >
          <option value="">(なし)</option>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {PATTERN_LABEL[p]}
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
          placeholder="例: コットン、ウール"
          style={inputStyle}
        />
      </Field>

      <Field label="シルエット">
        <input
          value={value.silhouette ?? ""}
          onChange={(e) =>
            onChange({ ...value, silhouette: e.target.value || null })
          }
          placeholder="例: ゆったり、タイト"
          style={inputStyle}
        />
      </Field>

      <Field label="シーズン">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {SEASONS.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
                padding: "0.4rem 0.6rem",
                border: "1px solid #ddd",
                borderRadius: 6,
                background: value.season.includes(s) ? "#eef" : "#fff",
              }}
            >
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
              {SEASON_LABEL[s]}
            </label>
          ))}
        </div>
      </Field>

      <Field label="フォーマル度">
        <select
          value={value.formality}
          onChange={(e) =>
            onChange({ ...value, formality: Number(e.target.value) })
          }
          style={inputStyle}
        >
          {FORMALITY_LEVELS.map((n) => (
            <option key={n} value={n}>
              {n} - {FORMALITY_LABEL[n]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="シーン">
        <TagChipInput
          tags={value.occasion}
          onChange={(occasion) => onChange({ ...value, occasion })}
          placeholder="例: オフィス"
        />
      </Field>

      <Field label="タグ">
        <TagChipInput
          tags={value.tags}
          onChange={(tags) => onChange({ ...value, tags })}
          placeholder="例: お気に入り"
        />
      </Field>

      <Field label="ブランド">
        <input
          value={value.brand ?? ""}
          onChange={(e) =>
            onChange({ ...value, brand: e.target.value || null })
          }
          style={inputStyle}
        />
      </Field>

      <Field label="メモ">
        <textarea
          rows={3}
          value={value.notes ?? ""}
          onChange={(e) =>
            onChange({ ...value, notes: e.target.value || null })
          }
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

// ---- Color picker rows ----

function ColorEditor({
  colors,
  onChange,
}: {
  colors: Color[];
  onChange: (c: Color[]) => void;
}) {
  function update(i: number, patch: Partial<Color>) {
    const next = colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange(next);
  }

  function remove(i: number) {
    onChange(colors.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...colors, { name: "", hex: "#000000" }]);
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {colors.map((c, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          <input
            type="color"
            value={c.hex}
            onChange={(e) => update(i, { hex: e.target.value })}
            style={{
              width: 36,
              height: 36,
              padding: 2,
              border: "1px solid #ddd",
              borderRadius: 4,
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <input
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="色の名前"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={colors.length <= 1}
            aria-label="この色を削除"
            style={{
              flexShrink: 0,
              padding: "0.35rem 0.6rem",
              background: colors.length <= 1 ? "#eee" : "#fee",
              color: colors.length <= 1 ? "#aaa" : "#c00",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: colors.length <= 1 ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
            }}
          >
            削除
          </button>
        </div>
      ))}
      {colors.length < 4 && (
        <button
          type="button"
          onClick={add}
          style={{
            padding: "0.4rem 0.75rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.85rem",
            alignSelf: "start",
          }}
        >
          + 色を追加
        </button>
      )}
    </div>
  );
}

// ---- Tag chip input ----

function TagChipInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInput("");
    },
    [tags, onChange],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function onBlur() {
    if (input.trim()) commit(input);
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem",
        padding: "0.4rem 0.5rem",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "#fff",
        cursor: "text",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((t) => (
        <span
          key={t}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            background: "#f0f0f0",
            borderRadius: 999,
            fontSize: "0.85rem",
          }}
        >
          {t}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((x) => x !== t));
            }}
            aria-label={`${t}を削除`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              color: "#888",
              fontSize: "0.9rem",
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        style={{
          border: "none",
          outline: "none",
          fontSize: "1rem",
          background: "transparent",
          minWidth: 80,
          flex: 1,
        }}
      />
    </div>
  );
}

// ---- Shared helpers ----

export function Field({
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

export const inputStyle: React.CSSProperties = {
  padding: "0.55rem 0.7rem",
  fontSize: "1rem",
  border: "1px solid #ddd",
  borderRadius: 6,
  background: "#fff",
  width: "100%",
  boxSizing: "border-box",
};

export function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.85rem 1.2rem",
    background: disabled ? "#999" : "#111",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "1rem",
    width: "100%",
    marginBottom: "0.75rem",
  };
}
