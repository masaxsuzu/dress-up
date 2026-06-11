import type { ZodError } from "zod";

// すべての API エラーレスポンスを { error: string } 形状に統一するためのヘルパー。
// Zod エラーも人間可読な 1 文字列に変換することで、クライアントが型ガードを
// 書く必要をなくす。

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// ZodError を "field: message; field: message" 形式の 1 文字列に変換して
// 400 レスポンスとして返す。
export function validationError(error: ZodError): Response {
  const flat = error.flatten();

  const parts: string[] = [];

  // フォームエラー (特定フィールドに紐付かないエラー)
  for (const msg of flat.formErrors) {
    parts.push(msg);
  }

  // フィールド別エラー
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (!messages) continue;
    for (const msg of messages) {
      parts.push(`${field}: ${msg}`);
    }
  }

  const message = parts.join("; ") || "Validation failed";
  return Response.json({ error: message }, { status: 400 });
}
