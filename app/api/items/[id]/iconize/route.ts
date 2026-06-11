import { GoogleGenAI, Modality } from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getItem, setIconKey } from "@/lib/db";
import { buildIconPrompt } from "@/lib/icon-prompt";
import { removeBackground } from "@/lib/photoroom";
import { loadImageBase64, putIcon } from "@/lib/r2";

const MODEL = "gemini-2.5-flash-image";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });

  const item = await getItem(env.DB, id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });

  const img = await loadImageBase64(env.IMAGES, item.imageKey);
  if (!img) {
    return Response.json({ error: "元画像が見つかりません" }, { status: 404 });
  }
  const { mediaType, base64 } = img;

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const prompt = buildIconPrompt(item.category);

  let data: string;
  let mimeType: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseModalities: [Modality.IMAGE] },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data,
    );
    if (!part?.inlineData?.data) {
      throw new Error("画像が返されませんでした");
    }
    data = part.inlineData.data;
    mimeType = part.inlineData.mimeType ?? "image/png";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }

  let bytes: ArrayBuffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    .buffer as ArrayBuffer;

  // Photoroom があれば、Gemini が付けてくる白背景を真の透過 PNG に置き換える。
  // キャンバスに重ねたときに白い四角が見えるのを避けるため。
  // 失敗 or 未設定なら白背景のまま (CSS の mix-blend-mode multiply でフォールバック)。
  if (env.PHOTOROOM_API_KEY) {
    const cutout = await removeBackground(
      env.PHOTOROOM_API_KEY,
      bytes,
      mimeType,
      { background: "transparent" },
    ).catch(() => null);
    if (cutout) {
      bytes = cutout.bytes;
      mimeType = cutout.mimeType;
    }
  }

  const iconKey = await putIcon(env.IMAGES, id, bytes, mimeType);
  await setIconKey(env.DB, id, iconKey);

  return Response.json({ iconKey });
}
