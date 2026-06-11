import type { Season } from "@/schema/clothing";

// 月から現在の季節を返す。date を渡さない場合は今日の日付を使う。
export function currentSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}
