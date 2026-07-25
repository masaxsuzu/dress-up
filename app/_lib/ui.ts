// ページ/カード/ボタンの共有インラインスタイル定数。
// 値は app/globals.css の CSS カスタムプロパティ (デザイントークン) を参照する。
import type { CSSProperties } from "react";

// Page container: centered column with 1rem padding.
// Pass the desired maxWidth (e.g. 640 for detail pages, 1100 for the home gallery).
export function pageStyle(maxWidth: number): CSSProperties {
  return {
    padding: "1rem",
    maxWidth,
    margin: "0 auto",
  };
}

// Pill-shaped navigation link (ghost variant: surface bg, dark border).
export const pillLinkStyle: CSSProperties = {
  padding: "0.6rem 1rem",
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--ink)",
  borderRadius: 999,
  textDecoration: "none",
  fontSize: "0.95rem",
  whiteSpace: "nowrap",
};

// Filled pill variant used for the "Add" button.
export const pillLinkFilledStyle: CSSProperties = {
  padding: "0.6rem 1rem",
  background: "var(--ink)",
  color: "#fff",
  borderRadius: 999,
  textDecoration: "none",
  fontSize: "0.95rem",
  whiteSpace: "nowrap",
};

// Full-width action button.
//   variant "primary"  → ink   (default)
//   variant "danger"   → red (var(--danger))
//   variant "secondary"→ muted grey
// disabled: grays out the button and sets cursor.
export function actionBtnStyle(opts?: {
  variant?: "primary" | "danger" | "secondary";
  disabled?: boolean;
  cursor?: CSSProperties["cursor"];
}): CSSProperties {
  const { variant = "primary", disabled = false, cursor } = opts ?? {};
  const bgMap: Record<string, string> = {
    primary: disabled ? "var(--muted)" : "var(--ink)",
    // NOTE: kept as a literal (matches --danger's value) rather than
    // var(--danger) — e2e/icons.spec.ts reads the raw inline
    // `el.style.background` string and expects "#c00" / its rgb() form.
    danger: disabled ? "var(--muted)" : "#c00",
    secondary: disabled ? "var(--muted)" : "#555",
  };
  return {
    display: "block",
    padding: "0.7rem 1.2rem",
    background: bgMap[variant],
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: cursor ?? (disabled ? "not-allowed" : "pointer"),
    fontSize: "1rem",
    width: "100%",
    boxSizing: "border-box",
  };
}

// Card container: surface box with light border and rounded corners.
// Used in recommend cards and item detail sections.
export const cardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.75rem",
  background: "var(--surface)",
};
