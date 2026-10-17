import { z } from "zod";
import { errorResponse } from "@/app/_lib/api-response";
import { route } from "@/app/_lib/route-handler";

// 確認済み宛先の総メール上限 25 MiB に、MIME 化後も十分収まるサイズ。
const MAX_PDF_BYTES = 10_000_000;

function configurationError(reason: string, message: string): Response {
  // アドレスや secret の値は記録せず、実際に実行されたバージョンの不足項目だけを残す。
  console.error({ event: "wardrobe_email_configuration_error", reason });
  return errorResponse(message, 503);
}

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
  const mailer = env.WARDROBE_EMAIL;
  if (!mailer || typeof mailer.send !== "function") {
    return configurationError(
      "WARDROBE_EMAIL_UNAVAILABLE",
      "実行中の Worker にメール送信 binding WARDROBE_EMAIL がありません。dress-up のバインディングとデプロイを確認してください。",
    );
  }
  const senderValue = typeof env.EMAIL_FROM === "string" ? env.EMAIL_FROM.trim() : env.EMAIL_FROM;
  if (senderValue === undefined || senderValue === "") {
    return configurationError(
      "EMAIL_FROM_MISSING",
      "実行中の Worker に送信元 EMAIL_FROM が設定されていません。dress-up の変数とシークレットで設定し、保存・デプロイしてください。",
    );
  }
  const sender = z.email().safeParse(senderValue);
  if (!sender.success) {
    return configurationError(
      "EMAIL_FROM_INVALID",
      "送信元 EMAIL_FROM の形式が不正です。表示名や引用符を含めず、メールアドレスだけを文字列で設定してください。",
    );
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
    await mailer.send({
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
