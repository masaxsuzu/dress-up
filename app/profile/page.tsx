"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resizeImageForUpload } from "@/lib/resize-image";
import { primaryBtn, Field, inputStyle } from "@/components/clothing-form";
import { pageStyle } from "@/lib/ui";
import type { Gender, Profile, ProfileInput } from "@/schema/profile";

const GENDER_LABEL: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他/指定しない",
};

const EMPTY: ProfileInput = {
  gender: null,
  heightCm: null,
  weightKg: null,
  bodyType: null,
  referenceImageKey: null,
};

export default function ProfilePage() {
  const [draft, setDraft] = useState<ProfileInput>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/profile");
        const data: { profile: Profile | null } = await res.json();
        if (data.profile) {
          setDraft({
            gender: data.profile.gender,
            heightCm: data.profile.heightCm,
            weightKg: data.profile.weightKg,
            bodyType: data.profile.bodyType,
            referenceImageKey: data.profile.referenceImageKey,
          });
          setSavedAt(data.profile.updatedAt);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const resized = await resizeImageForUpload(file);
      const fd = new FormData();
      fd.append("file", resized);
      const res = await fetch("/api/profile/reference-image", {
        method: "POST",
        body: fd,
      });
      const data: { imageKey?: string; error?: string } = await res.json();
      if (!res.ok || !data.imageKey) {
        throw new Error(data.error ?? "アップロード失敗");
      }
      setDraft((d) => ({ ...d, referenceImageKey: data.imageKey! }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data: { profile?: Profile; error?: string } = await res.json();
      if (!res.ok || !data.profile) {
        throw new Error(data.error ?? "保存失敗");
      }
      setSavedAt(data.profile.updatedAt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function clearReferenceImage() {
    setDraft((d) => ({ ...d, referenceImageKey: null }));
  }

  if (!loaded) {
    return (
      <main style={pageStyle(640)}>
        <p style={{ color: "var(--muted)" }}>読み込み中…</p>
      </main>
    );
  }

  return (
    <main style={pageStyle(640)}>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/" style={{ color: "var(--muted)" }}>
          ← 一覧に戻る
        </Link>
      </p>
      <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.4rem" }}>プロフィール</h1>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.85rem",
          marginBottom: "1.5rem",
        }}
      >
        提案時に常に適用されます。未設定の項目はデフォルト (中性的な被写体) に
        フォールバックします。
      </p>

      <Field label="性別">
        <select
          value={draft.gender ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              gender: (e.target.value || null) as Gender | null,
            })
          }
          style={inputStyle}
        >
          <option value="">指定しない</option>
          {(["male", "female", "other"] as const).map((g) => (
            <option key={g} value={g}>
              {GENDER_LABEL[g]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="身長 (cm)">
        <input
          type="number"
          min={50}
          max={250}
          value={draft.heightCm ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              heightCm: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>

      <Field label="体重 (kg)">
        <input
          type="number"
          min={20}
          max={300}
          value={draft.weightKg ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              weightKg: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>

      <Field label="体型 (自由記述)">
        <input
          type="text"
          maxLength={200}
          placeholder="例: 細身、アスリート体型、ふくよか"
          value={draft.bodyType ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, bodyType: e.target.value || null })
          }
          style={inputStyle}
        />
      </Field>

      <Field label="参考画像 (顔・体型のモデル)">
        {draft.referenceImageKey && (
          <div style={{ marginBottom: "0.5rem" }}>
            <img
              src={`/api/images/${draft.referenceImageKey}`}
              alt="reference"
              style={{
                width: "100%",
                maxHeight: "40vh",
                objectFit: "contain",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                display: "block",
              }}
            />
            <button
              onClick={clearReferenceImage}
              style={{
                marginTop: "0.4rem",
                padding: "0.3rem 0.7rem",
                fontSize: "0.8rem",
                background: "var(--surface)",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              画像を消す
            </button>
          </div>
        )}
        <label
          style={{
            display: "block",
            padding: "1rem",
            border: "2px dashed var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void onFileChange(e)}
            disabled={uploading}
            style={{ display: "none" }}
          />
          <span style={{ fontSize: "0.9rem" }}>
            {uploading
              ? "アップロード中…"
              : draft.referenceImageKey
                ? "別の写真を選ぶ"
                : "写真を選ぶ"}
          </span>
        </label>
      </Field>

      <button
        onClick={() => void onSave()}
        disabled={saving}
        style={{ ...primaryBtn(saving), marginTop: "1rem" }}
      >
        {saving ? "保存中…" : "保存"}
      </button>

      {error && (
        <p
          style={{
            color: "var(--danger)",
            whiteSpace: "pre-wrap",
            marginTop: "1rem",
          }}
        >
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.8rem",
            marginTop: "0.5rem",
          }}
        >
          最終更新: {new Date(savedAt).toLocaleString("ja-JP")}
        </p>
      )}
    </main>
  );
}
