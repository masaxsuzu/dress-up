"use client";

import { useState } from "react";
import { actionBtnStyle } from "@/lib/ui";

export function IconizeButton({ id, hasIcon }: { id: string; hasIcon: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleClick() {
    setStatus("loading");
    const res = await fetch(`/api/items/${id}/iconize`, { method: "POST" });
    if (res.ok) {
      setStatus("done");
      window.location.reload();
    } else {
      setStatus("error");
    }
  }

  const label =
    status === "loading"
      ? "生成中..."
      : status === "done"
        ? "完了"
        : status === "error"
          ? "エラー"
          : hasIcon
            ? "アイコンを再生成"
            : "アイコン化";

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      style={actionBtnStyle({
        variant: status === "error" ? "danger" : "secondary",
        disabled: status === "loading",
        cursor: status === "loading" ? "wait" : "pointer",
      })}
    >
      {label}
    </button>
  );
}
