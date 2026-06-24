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

  return new Response(obj.body, {
    headers: {
      "Content-Type":
        obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "Content-Length": obj.size.toString(),
    },
  });
});
