import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserEmail } from "@/lib/auth";
import { imageKeyOwnedBy } from "@/lib/db";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Params) {
  const { key } = await params;
  const objectKey = key.join("/");
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  // owner check: 他人のアイテム/プロフィール画像を URL 推測で取れないようにする。
  // 404 ではなく 404 で返すのは情報漏洩を避けるため (存在/非所有が区別できないように)。
  const owned = await imageKeyOwnedBy(env.DB, userEmail, objectKey);
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
}
