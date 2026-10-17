import { beforeEach, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { setTestEnv } from "@/test/helpers/route-runner";

const { POST } = await import("./route");
const sendMock = vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>();
const PDF = "%PDF-1.4\nwardrobe\n%%EOF";

function sendPdf(options: { headers?: Record<string, string>; body?: BodyInit; anonymous?: boolean } = {}) {
  return POST(new Request("https://dress-up.example/api/wardrobe/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      Origin: "https://dress-up.example",
      ...(options.anonymous ? {} : { "Cf-Access-Authenticated-User-Email": " Alice@Example.com " }),
      ...options.headers,
    },
    body: options.body ?? PDF,
  }));
}

beforeEach(() => {
  setTestEnv({ WARDROBE_EMAIL: { send: sendMock }, EMAIL_FROM: "wardrobe@example.com" });
  sendMock.mockReset();
  sendMock.mockResolvedValue({ messageId: "email-id" });
});

describe("POST /api/wardrobe/email", () => {
  it("認証された本人だけに、元の PDF を添付して送信する", async () => {
    const response = await sendPdf({ headers: { To: "someone-else@example.com" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true });
    expect(sendMock).toHaveBeenCalledOnce();
    const [mail] = sendMock.mock.calls[0];
    if (!("subject" in mail)) throw new Error("Expected a composed email");
    expect(mail.to).toBe("alice@example.com");
    expect(mail.from).toBe("wardrobe@example.com");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments![0].filename).toMatch(/^dress-up-wardrobe-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mail.attachments![0].type).toBe("application/pdf");
    expect(mail.attachments![0].disposition).toBe("attachment");
    expect(mail.attachments![0].content).toEqual(Buffer.from(PDF));
  });

  it("Access ヘッダ無しのローカルフォールバックでは送らない", async () => {
    expect((await sendPdf({ anonymous: true })).status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("メールでない認証情報を拒否する", async () => {
    expect((await sendPdf({ headers: { "Cf-Access-Authenticated-User-Email": "dev@local" } })).status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each(["https://another.example", "null", ""])("別 origin や origin 無しでは送らない: %s", async (origin) => {
    expect((await sendPdf({ headers: { Origin: origin } })).status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each([
    { EMAIL_FROM: "wardrobe@example.com" },
    { WARDROBE_EMAIL: { send: sendMock } },
    { WARDROBE_EMAIL: { send: sendMock }, EMAIL_FROM: "invalid" },
  ])("設定不足なら 503", async (env) => {
    setTestEnv(env);
    const response = await sendPdf();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "メール送信の設定がまだ完了していません。" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("PDF 以外の Content-Type を拒否する", async () => {
    expect((await sendPdf({ headers: { "Content-Type": "text/plain" } })).status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each(["", "not a pdf"])("空や PDF 以外の中身を拒否する: %s", async (body) => {
    expect((await sendPdf({ body })).status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("Content-Length が上限を超えたら拒否する", async () => {
    expect((await sendPdf({ headers: { "Content-Length": "10000001" } })).status).toBe(413);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("Content-Length が無くても実データのサイズ上限を適用する", async () => {
    const body = new Uint8Array(10_000_001);
    body.set(new TextEncoder().encode("%PDF-"));
    expect((await sendPdf({ body })).status).toBe(413);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("送信サービスが拒否したら成功にせず、応答内容も漏らさない", async () => {
    sendMock.mockRejectedValue(new Error("private provider detail: destination not verified"));
    const response = await sendPdf();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private provider detail");
  });

  it("通信エラーなら送信結果不明として返す", async () => {
    sendMock.mockRejectedValue(new Error("network failure"));
    const response = await sendPdf();
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("重複する場合があります");
  });

  it("実際のローカル Cloudflare メール binding が PDF 添付を受け付ける（外部送信なし）", async () => {
    const mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('local'); } };",
      compatibilityDate: "2026-04-01",
      email: { send_email: [{ name: "WARDROBE_EMAIL", destination_address: "alice@example.com" }] },
      bindings: { EMAIL_FROM: "wardrobe@example.com" },
    });
    try {
      setTestEnv(await mf.getBindings<CloudflareEnv>());
      expect((await sendPdf()).status).toBe(200);
    } finally {
      await mf.dispose();
    }
  });
});
