"use client";

import { useState, useRef, useCallback } from "react";

export function TagChipInput({
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
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface)",
        cursor: "text",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="chip"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--ink)",
            cursor: "default",
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
              color: "var(--muted)",
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
          color: "var(--ink)",
          minWidth: 80,
          flex: 1,
        }}
      />
    </div>
  );
}
