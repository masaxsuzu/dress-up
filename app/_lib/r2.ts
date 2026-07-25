// ホワイトリスト: これ以外の Content-Type は安全でないとみなして弾く。
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function putIcon(
  bucket: R2Bucket,
  itemId: string,
  body: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const ext = extensionForMimeType(mimeType);
  const key = `icons/${itemId}.${ext}`;
  await bucket.put(key, body, {
    httpMetadata: { contentType: mimeType },
  });
  return key;
}

export async function putImage(
  bucket: R2Bucket,
  body: ArrayBuffer | ReadableStream,
  mimeType: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const ext = extensionForMimeType(mimeType);
  const key = `items/${id}.${ext}`;
  await bucket.put(key, body, {
    httpMetadata: { contentType: mimeType },
  });
  return key;
}

// プロフィール参考画像。`profile/<uuid>.<ext>`。items/ と分けて衝突回避。
export async function putProfileImage(
  bucket: R2Bucket,
  body: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const ext = extensionForMimeType(mimeType);
  const key = `profile/${id}.${ext}`;
  await bucket.put(key, body, {
    httpMetadata: { contentType: mimeType },
  });
  return key;
}

// R2 から画像を読み込んで base64 エンコードした結果を返す。
// key が存在しない場合、または許可されていない Content-Type の場合は null。
export async function loadImageBase64(
  bucket: R2Bucket,
  key: string,
): Promise<{ mediaType: string; base64: string } | null> {
  const obj = await bucket.get(key).catch(() => null);
  if (!obj) return null;
  const mediaType = obj.httpMetadata?.contentType ?? "image/jpeg";
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return null;
  const buf = await obj.arrayBuffer();
  return { mediaType, base64: Buffer.from(buf).toString("base64") };
}

export async function deleteImage(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}
