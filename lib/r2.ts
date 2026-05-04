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

export async function getImage(
  bucket: R2Bucket,
  key: string,
): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function deleteImage(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}
