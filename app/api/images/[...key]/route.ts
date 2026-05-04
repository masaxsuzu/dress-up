import { getCloudflareContext } from "@opennextjs/cloudflare";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { key } = await params;
  const objectKey = key.join("/");
  const { env } = await getCloudflareContext({ async: true });

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
