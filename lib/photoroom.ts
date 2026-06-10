// Photoroom Sandbox API で背景除去。失敗時は null を返し、呼び出し側で元画像にフォールバックする。
// https://docs.photoroom.com/image-editing-api/removing-the-background-with-the-image-editing-api

const ENDPOINT = "https://image-api.photoroom.com/v2/edit";

export type RemoveBackgroundOptions = {
  /**
   * 出力の背景。
   * - "white" (default): 白塗り JPEG。元画像保存用 (サイズが小さい)。
   * - "transparent": 透過 PNG。アイコン用 (キャンバスに重ねたとき透ける)。
   */
  background?: "white" | "transparent";
};

export async function removeBackground(
  apiKey: string,
  imageBytes: ArrayBuffer,
  mimeType: string,
  options: RemoveBackgroundOptions = {},
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  const background = options.background ?? "white";

  const form = new FormData();
  form.append("imageFile", new Blob([imageBytes], { type: mimeType }), "input");
  if (background === "transparent") {
    form.append("background.color", "00000000");
    form.append("export.format", "png");
  } else {
    // 単色背景（白・不透明）にすると JPEG 出力が使えてサイズが膨らまない。
    form.append("background.color", "FFFFFFFF");
    form.append("export.format", "jpg");
    form.append("export.compression.quality", "85");
  }

  const accept = background === "transparent" ? "image/png" : "image/jpeg";
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": apiKey, Accept: accept },
    body: form,
  });

  if (!res.ok) return null;

  const outMime = res.headers.get("Content-Type") ?? accept;
  if (!outMime.startsWith("image/")) return null;

  const bytes = await res.arrayBuffer();
  return { bytes, mimeType: outMime };
}
