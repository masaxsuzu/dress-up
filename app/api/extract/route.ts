import { errorResponse } from "@/lib/api-response";
import { putImage } from "@/lib/r2";
import { route } from "@/lib/route-handler";
import { extractClothing } from "@/lib/vlm";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Gemini API は inlineData 1 件あたり 20MB まで。実用的にはサーバ側の
// メモリと、フォームアップロードのレイテンシを考えて 5MB を上限にする。
const MAX_IMAGE_BYTES = 5_000_000;

export const POST = route(async ({ req, env }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse("missing file", 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return errorResponse(`unsupported content type: ${file.type}`, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return errorResponse(
      `image too large: ${file.size} bytes (max ${MAX_IMAGE_BYTES})`,
      413,
    );
  }

  const bytes = await file.arrayBuffer();
  const imageKey = await putImage(env.IMAGES, bytes, file.type);
  const base64 = Buffer.from(bytes).toString("base64");

  try {
    const extraction = await extractClothing(env.GEMINI_API_KEY, {
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
});
