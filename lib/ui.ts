// ページ/カード/ボタンの共有インラインスタイル定数。
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

// Pill-shaped navigation link (ghost variant: white bg, dark border).
export const pillLinkStyle: CSSProperties = {
  padding: "0.6rem 1rem",
  background: "#fff",
  color: "#111",
  border: "1px solid #111",
  borderRadius: 999,
  textDecoration: "none",
  fontSize: "0.95rem",
  whiteSpace: "nowrap",
};

// Filled pill variant used for the "Add" button.
export const pillLinkFilledStyle: CSSProperties = {
  padding: "0.6rem 1rem",
  background: "#111",
  color: "#fff",
  borderRadius: 999,
  textDecoration: "none",
  fontSize: "0.95rem",
  whiteSpace: "nowrap",
};

// Full-width action button.
//   variant "primary"  → black  (default)
//   variant "danger"   → red (#c00)
//   variant "secondary"→ grey (#555)
// disabled: grays out the button and sets cursor.
export function actionBtnStyle(opts?: {
  variant?: "primary" | "danger" | "secondary";
  disabled?: boolean;
  cursor?: CSSProperties["cursor"];
}): CSSProperties {
  const { variant = "primary", disabled = false, cursor } = opts ?? {};
  const bgMap: Record<string, string> = {
    primary: disabled ? "#999" : "#111",
    danger: disabled ? "#999" : "#c00",
    secondary: disabled ? "#999" : "#555",
  };
  return {
    display: "block",
    padding: "0.7rem 1.2rem",
    background: bgMap[variant],
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: cursor ?? (disabled ? "not-allowed" : "pointer"),
    fontSize: "1rem",
    width: "100%",
    boxSizing: "border-box",
  };
}

// Card container: white box with light border and rounded corners.
// Used in recommend cards and item detail sections.
export const cardStyle: CSSProperties = {
  border: "1px solid #e5e5e5",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#fff",
};
