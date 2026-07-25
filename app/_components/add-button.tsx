"use client";

import { useRouter } from "next/navigation";

let _pendingFile: File | null = null;

export function takePendingFile(): File | null {
  const f = _pendingFile;
  _pendingFile = null;
  return f;
}

export function AddButton({
  style,
  children,
}: {
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    _pendingFile = f;
    router.push("/add");
  }

  return (
    <label className="btn-primary" style={{ cursor: "pointer", ...style }}>
      <input
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: "none" }}
      />
      {children ?? "+ 服を追加"}
    </label>
  );
}
