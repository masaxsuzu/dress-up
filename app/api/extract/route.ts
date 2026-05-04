import { getCloudflareContext } from "@opennextjs/cloudflare";
import { putImage } from "@/lib/r2";
import { extractClothing } from "@/lib/vlm";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing file" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { error: `unsupported content type: ${file.type}` },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const imageKey = await putImage(env.IMAGES, buffer, file.type);

  try {
    const extraction = await extractClothing(env.ANTHROPIC_API_KEY, {
      mediaType: file.type,
      base64,
    });
    return Response.json({ imageKey, extraction });
  } catch (e) {
    // VLM が失敗しても画像は残しておく。手動で属性を埋めれば保存できる。
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { imageKey, extraction: null, error: message },
      { status: 200 },
    );
  }
}
