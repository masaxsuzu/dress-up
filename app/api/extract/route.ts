import { getCloudflareContext } from "@opennextjs/cloudflare";
import { putImage } from "@/lib/r2";
import { extractClothing } from "@/lib/vlm";
import { removeBackground } from "@/lib/photoroom";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Anthropic API は base64 後 5MB まで。base64 は元の約4/3倍になるので
// 生バイトは ~3.75MB が上限。安全側で 3.5MB を弾く。
const MAX_IMAGE_BYTES = 3_500_000;

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
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json(
      {
        error: `image too large: ${file.size} bytes (max ${MAX_IMAGE_BYTES})`,
      },
      { status: 413 },
    );
  }

  const original = await file.arrayBuffer();

  // Photoroom で背景除去。失敗時は元画像で続行。
  let storedBytes: ArrayBuffer = original;
  let storedMime: string = file.type;
  if (env.PHOTOROOM_API_KEY) {
    const cutout = await removeBackground(
      env.PHOTOROOM_API_KEY,
      original,
      file.type,
    ).catch(() => null);
    if (cutout) {
      storedBytes = cutout.bytes;
      storedMime = cutout.mimeType;
    }
  }

  const imageKey = await putImage(env.IMAGES, storedBytes, storedMime);

  // VLM には背景除去後の画像を渡す（属性抽出の精度が上がる）。
  const base64 = Buffer.from(storedBytes).toString("base64");

  try {
    const extraction = await extractClothing(env.ANTHROPIC_API_KEY, {
      mediaType: storedMime,
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
