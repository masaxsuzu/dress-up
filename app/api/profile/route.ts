import { getCloudflareContext } from "@opennextjs/cloudflare";
import { validationError } from "@/lib/api-response";
import { getProfile, setProfile } from "@/lib/profile";
import { deleteImage } from "@/lib/r2";
import { ProfileInputSchema } from "@/schema/profile";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const profile = await getProfile(env.DB);
  return Response.json({ profile });
}

export async function PUT(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await req.json().catch(() => null);
  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  // 参考画像を差し替えた or 削除した場合は旧画像を R2 から消す。
  const prev = await getProfile(env.DB);
  if (
    prev?.referenceImageKey &&
    prev.referenceImageKey !== parsed.data.referenceImageKey
  ) {
    await deleteImage(env.IMAGES, prev.referenceImageKey).catch(() => {});
  }

  const profile = await setProfile(env.DB, parsed.data);
  return Response.json({ profile });
}
