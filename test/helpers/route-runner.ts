// API route handler の統合テスト用ヘルパ。
// route() でラップされたハンドラを直接呼んで、Request → Response を検証する。
//
// 使い方:
//   import { setTestEnv, callRoute } from "@/test/helpers/route-runner";
//   import { GET } from "@/app/api/items/route";
//
//   setTestEnv({ DB, IMAGES, GEMINI_API_KEY: "test" });
//   const res = await callRoute(GET, { user: "alice@example.com" });
//   expect(res.status).toBe(200);

import { vi } from "vitest";

// hoist で env スロットを作る。getCloudflareContext は env を返す関数。
const { envSlot } = vi.hoisted(() => ({
  envSlot: { env: null as Partial<CloudflareEnv> | null },
}));

vi.mock("@opennextjs/cloudflare", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCloudflareContext: vi.fn().mockImplementation(() =>
      Promise.resolve({ env: envSlot.env }),
    ),
  };
});

export function setTestEnv(env: Partial<CloudflareEnv> | null): void {
  envSlot.env = env;
}

// route() の返り値型 (req と任意の params オブジェクト)。
type Handler<P> = (
  req: Request,
  args?: { params?: Promise<P> },
) => Promise<Response>;

export type CallOptions<P = Record<string, never>> = {
  url?: string;
  method?: string;
  user?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  params?: P;
  /** multipart/form-data を送る (file アップロード等)。 */
  formData?: FormData;
};

export async function callRoute<P = Record<string, never>>(
  handler: Handler<P>,
  opts: CallOptions<P> = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.user) {
    headers["Cf-Access-Authenticated-User-Email"] = opts.user;
  }

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(opts.body);
  }

  const req = new Request(opts.url ?? "https://test.local/api/test", {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });

  const args = opts.params !== undefined
    ? { params: Promise.resolve(opts.params) }
    : undefined;

  return handler(req, args);
}
