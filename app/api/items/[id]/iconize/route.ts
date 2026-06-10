import { GoogleGenAI, Modality } from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getItem, setIconKey } from "@/lib/db";
import { putIcon } from "@/lib/r2";

const MODEL = "gemini-2.5-flash-image";

const PROMPT =
  "Generate a clean flat-lay icon of this single clothing item. " +
  "Pure white background, item centered, no person or mannequin, no shadows, no accessories. " +
  "Faithfully reproduce the item's color, pattern, texture, and shape. " +
  "Style: crisp product-shot icon suitable for a dress-up game.";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });

  const item = await getItem(env.DB, id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });

  const obj = await env.IMAGES.get(item.imageKey).catch(() => null);
  if (!obj) {
    return Response.json({ error: "元画像が見つかりません" }, { status: 404 });
  }
  const mediaType = obj.httpMetadata?.contentType ?? "image/jpeg";
  const base64 = Buffer.from(await obj.arrayBuffer()).toString("base64");

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

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
            { text: PROMPT },
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

  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
  const iconKey = await putIcon(env.IMAGES, id, bytes as ArrayBuffer, mimeType);
  await setIconKey(env.DB, id, iconKey);

  return Response.json({ iconKey });
}
