import { imageKeyOwnedBy } from "@/lib/db";
import { route } from "@/lib/route-handler";

type KeyParams = { key: string[] };

export const GET = route<KeyParams>(async ({ env, user, params }) => {
  const objectKey = params.key.join("/");

  // owner check: 他人のアイテム/プロフィール画像を URL 推測で取れないようにする。
  // 存在/非所有を区別できないように常に 404 で返す。
  const owned = await imageKeyOwnedBy(env.DB, user, objectKey);
  if (!owned) return new Response("not found", { status: 404 });

  let obj: R2ObjectBody | null;
  try {
    obj = await env.IMAGES.get(objectKey);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!obj) return new Response("not found", { status: 404 });

  // items/* と profile/* は UUID キーで一度作ったら同じ URL では中身が変わらない
  // (再アップロード時は新 key を発行する) ので 7d。icons/* は item id 固定キーで
  // 「アイコン化」ボタンで上書きされ得るので短めの 1d に抑える。
  const maxAge = objectKey.startsWith("icons/") ? 86400 : 604800;

  return new Response(obj.body, {
    headers: {
      "Content-Type":
        obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": `private, max-age=${maxAge}`,
      "Content-Length": obj.size.toString(),
    },
  });
});
