"use client";

import {
  ClothingCategorySchema,
  PatternSchema,
  SeasonSchema,
  type ClothingItemUpdate,
} from "@/schema/clothing";
import {
  CATEGORY_LABEL,
  FORMALITY_LABEL,
  PATTERN_LABEL,
  SEASON_LABEL,
} from "@/lib/labels";
import { ColorEditor } from "@/components/color-editor";
import { TagChipInput } from "@/components/tag-chip-input";
import { actionBtnStyle } from "@/lib/ui";

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
      className="card"
      style={{
        display: "grid",
        gap: "1rem",
        marginBottom: "1.5rem",
        padding: "1rem",
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
              className={
                value.season.includes(s) ? "chip chip-active" : "chip"
              }
              style={{ display: "flex", gap: 4, alignItems: "center" }}
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
      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: "0.55rem 0.7rem",
  fontSize: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--ink)",
  width: "100%",
  boxSizing: "border-box",
};

export function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    ...actionBtnStyle({ disabled }),
    padding: "0.85rem 1.2rem",
    marginBottom: "0.75rem",
  };
}
