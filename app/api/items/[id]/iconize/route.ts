import { GoogleGenAI, Modality } from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { errorResponse } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";
import { getItem, setIconKey } from "@/lib/db";
import { buildIconPrompt } from "@/lib/icon-prompt";
import { loadImageBase64, putIcon } from "@/lib/r2";

const MODEL = "gemini-2.5-flash-image";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  const item = await getItem(env.DB, userEmail, id);
  if (!item) return errorResponse("not found", 404);

  const img = await loadImageBase64(env.IMAGES, item.imageKey);
  if (!img) {
    return errorResponse("元画像が見つかりません", 404);
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
    return errorResponse(message, 500);
  }

  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    .buffer as ArrayBuffer;

  const iconKey = await putIcon(env.IMAGES, id, bytes, mimeType);
  await setIconKey(env.DB, userEmail, id, iconKey);

  return Response.json({ iconKey });
}
