"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddButton } from "@/components/add-button";

function GridIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 7l4-3h2a3 3 0 006 0h2l4 3-2 3h-2v8a1 1 0 01-1 1H8a1 1 0 01-1-1v-8H5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="14" width="4" height="6" rx="1" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

const itemStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  color: active ? "#111" : "#aaa",
  textDecoration: "none",
  fontSize: "0.6rem",
  lineHeight: 1,
  padding: 0,
  background: "none",
  border: "none",
  fontFamily: "inherit",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      <Link href="/" style={itemStyle(pathname === "/")}>
        <GridIcon />
        一覧
      </Link>

      <Link href="/recommend" style={itemStyle(pathname.startsWith("/recommend"))}>
        <ShirtIcon />
        提案
      </Link>

      <AddButton style={itemStyle(false)}>
        <PlusIcon />
        追加
      </AddButton>

      <Link href="/stats" style={itemStyle(pathname === "/stats")}>
        <BarChartIcon />
        統計
      </Link>

      <Link href="/profile" style={itemStyle(pathname === "/profile")}>
        <PersonIcon />
        設定
      </Link>
    </nav>
  );
}
