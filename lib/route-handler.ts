// All API route handlers follow the same boilerplate: pull Cloudflare env,
// pull user email from Cloudflare Access header, await dynamic params.
// `route()` collapses that into a single wrapper so handlers focus on logic.
//
// Static route:
//   export const GET = route(async ({ env, user }) => { ... });
//
// Dynamic route:
//   export const DELETE = route<{ id: string }>(async ({ env, user, params }) => { ... });

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z, type ZodType } from "zod";
import { validationError } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";

export type RouteContext<P = Record<string, never>> = {
  req: Request;
  env: CloudflareEnv;
  user: string;
  params: P;
};

export function route<P = Record<string, never>>(
  fn: (ctx: RouteContext<P>) => Promise<Response>,
): (
  req: Request,
  args?: { params?: Promise<P> },
) => Promise<Response> {
  return async (req, args) => {
    const { env } = await getCloudflareContext({ async: true });
    const user = getUserEmail(req);
    const params = ((await args?.params) ?? {}) as P;
    return fn({ req, env, user, params });
  };
}

// JSON body を Zod スキーマでパースして {data} か {res: 400 レスポンス} を返す。
// 呼び出し側は if (!parsed.ok) return parsed.res; で抜ける。
export async function parseJson<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, res: validationError(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

// 念のため: z は副作用ある re-export しないので Tree-shake される。
// 利用側で `import { z } from "zod"` を別途すれば十分。
export type { ZodType };
export { z };
