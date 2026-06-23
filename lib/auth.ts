// Cloudflare Access が allowlist 認証後に必ずセットする header。
// この値は Access 越しでないと付与されない (Worker 直接到達は構成上できない)
// ので、本番では信頼できる identity として扱える。
const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

// ローカル開発・E2E では Access の前段を通らない。その場合のフォールバック
// ユーザ。production では決して使われない (上記ヘッダが必ず付くため)。
export const DEV_USER_EMAIL = "dev@local";

// Request からユーザのメールを取り出す。lowercase + trim して正規化する。
// Access が無ければ DEV_USER_EMAIL を返す (本番ではこの分岐は不通)。
export function getUserEmail(req: Request): string {
  const raw = req.headers.get(ACCESS_EMAIL_HEADER);
  if (!raw) return DEV_USER_EMAIL;
  return raw.trim().toLowerCase();
}

// 同様に Headers から取り出す (route handler の context など Request が
// 直接手に入らない時用)。
export function getUserEmailFromHeaders(headers: Headers): string {
  const raw = headers.get(ACCESS_EMAIL_HEADER);
  if (!raw) return DEV_USER_EMAIL;
  return raw.trim().toLowerCase();
}
