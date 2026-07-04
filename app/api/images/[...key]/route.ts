import { imageKeyOwnedBy } from "@/lib/db";
import { route } from "@/lib/route-handler";

type KeyParams = { key: string[] };

// R2 の型定義は onlyIf に Headers をそのまま渡すことも許容するが、Miniflare の
// Node 側 R2Bucket スタブ (integration テストで使用) は devalue 経由の RPC で
// Headers インスタンスをシリアライズできずエラーになる。そのため If-None-Match
// ヘッダを手動でパースして R2Conditional (プレーンオブジェクト) に変換する。
function parseIfNoneMatch(headers: Headers): R2Conditional | undefined {
  const raw = headers.get("If-None-Match");
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed === "*") return { etagDoesNotMatch: "*" };

  // 複数 etag がカンマ区切りで来ることもあるが、画像配信では通常 1 個なので先頭のみ見る。
  const first = trimmed.split(",")[0]?.trim() ?? "";
  // weak validator (`W/` プレフィックス) は弱比較のため無視し、クォートも剥がして
  // R2Object.etag と同じ生の値 (プレフィックス/クォート無し) に揃える。
  const withoutWeakPrefix = first.startsWith("W/") ? first.slice(2) : first;
  const value = withoutWeakPrefix.replace(/^"|"$/g, "");
  return value ? { etagDoesNotMatch: value } : undefined;
}

export const GET = route<KeyParams>(async ({ req, env, user, params }) => {
  const objectKey = params.key.join("/");

  // owner check: 他人のアイテム/プロフィール画像を URL 推測で取れないようにする。
  // 存在/非所有を区別できないように常に 404 で返す。条件付き GET より必ず先に行う。
  const owned = await imageKeyOwnedBy(env.DB, user, objectKey);
  if (!owned) return new Response("not found", { status: 404 });

  const onlyIf = parseIfNoneMatch(req.headers);

  let obj: R2ObjectBody | R2Object | null;
  try {
    obj = await env.IMAGES.get(objectKey, onlyIf ? { onlyIf } : undefined);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!obj) return new Response("not found", { status: 404 });

  // items/* と profile/* は UUID キーで一度作ったら同じ URL では中身が変わらない
  // (再アップロード時は新 key を発行する) ので 7d + immutable。icons/* は item id 固定キーで
  // 「アイコン化」ボタンで上書きされ得るので短めの 1d に抑え、immutable は付けない。
  const cacheControl = objectKey.startsWith("icons/")
    ? "private, max-age=86400"
    : "private, max-age=604800, immutable";

  // 条件付き GET (If-None-Match) が一致した場合、R2 は body を持たない R2Object を返す。
  if (!("body" in obj)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: obj.httpEtag,
        "Cache-Control": cacheControl,
      },
    });
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type":
        obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": cacheControl,
      "Content-Length": obj.size.toString(),
      ETag: obj.httpEtag,
    },
  });
});
