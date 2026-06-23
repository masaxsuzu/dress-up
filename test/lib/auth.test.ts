import { describe, expect, it } from "vitest";
import {
  DEV_USER_EMAIL,
  getUserEmail,
  getUserEmailFromHeaders,
} from "@/lib/auth";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/x", { headers });
}

describe("getUserEmail", () => {
  it("Cf-Access-Authenticated-User-Email ヘッダがあればそれを返す", () => {
    const r = req({ "Cf-Access-Authenticated-User-Email": "alice@example.com" });
    expect(getUserEmail(r)).toBe("alice@example.com");
  });

  it("大文字や前後空白は正規化される", () => {
    const r = req({ "Cf-Access-Authenticated-User-Email": "  Alice@Example.COM  " });
    expect(getUserEmail(r)).toBe("alice@example.com");
  });

  it("ヘッダ無しなら DEV_USER_EMAIL (dev@local) を返す", () => {
    const r = req();
    expect(getUserEmail(r)).toBe(DEV_USER_EMAIL);
    expect(DEV_USER_EMAIL).toBe("dev@local");
  });
});

describe("getUserEmailFromHeaders", () => {
  it("Headers オブジェクトから同じ結果を返す", () => {
    const h = new Headers({ "Cf-Access-Authenticated-User-Email": "bob@example.com" });
    expect(getUserEmailFromHeaders(h)).toBe("bob@example.com");
  });

  it("ヘッダ無しなら DEV_USER_EMAIL", () => {
    expect(getUserEmailFromHeaders(new Headers())).toBe(DEV_USER_EMAIL);
  });
});
