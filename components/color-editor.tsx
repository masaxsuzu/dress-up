"use client";

import type { Color } from "@/schema/clothing";
import { inputStyle } from "@/components/clothing-form";

export function ColorEditor({
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
              border: "1px solid var(--border)",
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
            className="btn btn-outline"
            style={{
              flexShrink: 0,
              padding: "0.35rem 0.6rem",
              color: colors.length <= 1 ? "var(--muted)" : "var(--danger)",
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
          className="btn btn-outline"
          style={{
            padding: "0.4rem 0.75rem",
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
