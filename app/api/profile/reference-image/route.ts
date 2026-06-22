import { getCloudflareContext } from "@opennextjs/cloudflare";
import { errorResponse } from "@/lib/api-response";
import { putProfileImage } from "@/lib/r2";

// extract と同じポリシー: 5MB / ホワイトリスト Content-Type。
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5_000_000;

// 参考画像をアップロードして R2 key だけ返す。プロフィール本体への紐付けは
// PUT /api/profile に referenceImageKey を含めて呼ぶ責務 (画像登録と同じ流れ)。
export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

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
  const imageKey = await putProfileImage(env.IMAGES, bytes, file.type);
  return Response.json({ imageKey });
}
