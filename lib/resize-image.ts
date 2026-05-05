// Anthropic API の制限: base64 後で 5MB 以下、長辺 8000px 以下。
// 推奨は長辺 1568px 以下なのでそこに合わせてリサイズする。
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

// createImageBitmap with imageOrientation option support detection (cached).
let supportsImageOrientation: boolean | null = null;

async function createOrientedBitmap(file: File): Promise<ImageBitmap> {
  if (supportsImageOrientation === null) {
    try {
      // Test with a tiny 1x1 PNG; if the option is accepted, cache true.
      const testBlob = new Blob(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63,
            0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
            0x82,
          ]),
        ],
        { type: "image/png" },
      );
      const bmp = await createImageBitmap(testBlob, {
        imageOrientation: "from-image",
      });
      bmp.close();
      supportsImageOrientation = true;
    } catch {
      supportsImageOrientation = false;
    }
  }

  if (supportsImageOrientation) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  return createImageBitmap(file);
}

export async function resizeImageForUpload(file: File): Promise<File> {
  try {
    // Always re-encode through canvas so EXIF orientation is baked in.
    // Skipping the early-return optimization avoids storing rotated images
    // for small portrait photos that would otherwise bypass the canvas path.
    const bitmap = await createOrientedBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
