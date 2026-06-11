import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorResponse, validationError } from "@/lib/api-response";

describe("errorResponse", () => {
  it("指定したメッセージと status コードで { error: string } を返す", async () => {
    const res = errorResponse("not found", 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not found" });
  });

  it("400 ステータスで動作する", async () => {
    const res = errorResponse("bad request", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "bad request" });
  });

  it("500 ステータスで動作する", async () => {
    const res = errorResponse("internal error", 500);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "internal error" });
  });
});

describe("validationError", () => {
  it("フィールドエラーを 'field: message' 形式の文字列に変換して 400 を返す", async () => {
    const schema = z.object({
      category: z.enum(["tops", "bottoms"]),
      colors: z.array(z.string()).min(1),
    });
    const result = schema.safeParse({ category: "invalid", colors: [] });
    if (result.success) throw new Error("should fail");

    const res = validationError(result.error);
    expect(res.status).toBe(400);

    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
    // フィールド名が含まれていること
    expect(body.error).toContain("category");
    expect(body.error).toContain("colors");
  });

  it("フォームエラー (フィールド外) も文字列に含まれる", async () => {
    const schema = z.object({}).refine(() => false, {
      message: "全体エラー",
    });
    const result = schema.safeParse({});
    if (result.success) throw new Error("should fail");

    const res = validationError(result.error);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("全体エラー");
  });

  it("エラーが空のときは 'Validation failed' にフォールバックする", async () => {
    // ZodError を直接構築して空の flatten を持たせる
    const { ZodError } = await import("zod");
    const err = new ZodError([]);
    const res = validationError(err);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Validation failed");
  });

  it("レスポンスは { error: string } 形状のみを返す (flatten オブジェクトではない)", async () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });
    if (result.success) throw new Error("should fail");

    const res = validationError(result.error);
    const body = await res.json() as Record<string, unknown>;
    // error が string であること
    expect(typeof body.error).toBe("string");
    // flatten 構造 (fieldErrors, formErrors) が漏れ出ていないこと
    expect(body.fieldErrors).toBeUndefined();
    expect(body.formErrors).toBeUndefined();
  });
});
