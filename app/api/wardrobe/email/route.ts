import { z } from "zod";
import { errorResponse } from "@/app/_lib/api-response";
import { route } from "@/app/_lib/route-handler";

// 確認済み宛先の総メール上限 25 MiB に、MIME 化後も十分収まるサイズ。
const MAX_PDF_BYTES = 10_000_000;

export const POST = route(async ({ req, env, user }) => {
  // ローカル開発の dev@local フォールバックではメールを送らない。
  // 本番は他の API と同様、Cloudflare Access の前段保護を必須とする。
  if (
    !req.headers.get("Cf-Access-Authenticated-User-Email") ||
    !z.email().safeParse(user).success
  ) {
    return errorResponse("メール送信にはログインが必要です。", 401);
  }
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return errorResponse("このサイトから送信してください。", 403);
  }
  const sender = z.email().safeParse(env.EMAIL_FROM);
  if (!env.WARDROBE_EMAIL || !sender.success) {
    return errorResponse("メール送信の設定がまだ完了していません。", 503);
  }
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/pdf") {
    return errorResponse("PDF ファイルを指定してください。", 400);
  }
  if (Number(req.headers.get("content-length")) > MAX_PDF_BYTES) {
    return errorResponse("PDF は 10 MB 以下にしてください。", 413);
  }

  // Content-Length は信用せず、実際に読み取ったバイト数にも上限を適用する。
  const reader = req.body?.getReader();
  if (!reader) return errorResponse("PDF ファイルが空です。", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) {
        await reader.cancel();
        return errorResponse("PDF は 10 MB 以下にしてください。", 413);
      }
      chunks.push(value);
    }
  } catch {
    return errorResponse("PDF を読み取れませんでした。", 400);
  } finally {
    reader.releaseLock();
  }
  const pdf = Buffer.concat(chunks);
  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return errorResponse("有効な PDF ファイルを指定してください。", 400);
  }

  try {
    const date = new Date().toISOString().slice(0, 10);
    await env.WARDROBE_EMAIL.send({
      from: sender.data,
      // 宛先を client から受け取らない。Access で認証された本人にのみ送る。
      to: user,
      subject: "dress-up ワードローブ一覧",
      text: "写真付きワードローブ一覧の PDF をお届けします。表示中の絞り込み条件で出力しています。",
      attachments: [{
        filename: `dress-up-wardrobe-${date}.pdf`,
        content: pdf,
        type: "application/pdf",
        disposition: "attachment",
      }],
    });
    return Response.json({ accepted: true });
  } catch {
    return errorResponse("メール送信結果を確認できませんでした。再送すると重複する場合があります。", 502);
  }
});
