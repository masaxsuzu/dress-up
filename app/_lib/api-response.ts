// 全 API ルート共通のレスポンス形状 ({ error: string }) と JSON ヘルパー。
import type { ZodError } from "zod";

// すべての API エラーレスポンスを { error: string } 形状に統一するためのヘルパー。
// Zod エラーも人間可読な 1 文字列に変換することで、クライアントが型ガードを
// 書く必要をなくす。

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// ZodError を "field: message; field: message" 形式の 1 文字列に変換して
// 400 レスポンスとして返す。issues を直接走査するので zod 3/4 両対応。
export function validationError(error: ZodError): Response {
  const parts: string[] = [];
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    parts.push(path ? `${path}: ${issue.message}` : issue.message);
  }
  const message = parts.join("; ") || "Validation failed";
  return Response.json({ error: message }, { status: 400 });
}
