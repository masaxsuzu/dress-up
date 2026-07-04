// ワードローブ統計の集計 (純粋関数)。/stats の StatsView が使う。
import type { ClothingItem } from "@/schema/clothing";
import { ClothingCategorySchema, SeasonSchema } from "@/schema/clothing";

export function computeStats(items: ClothingItem[]) {
  const total = items.length;
  const iconized = items.filter((i) => i.iconKey).length;

  // category
  const byCategory = Object.fromEntries(
    ClothingCategorySchema.options.map((c) => [c, 0]),
  ) as Record<string, number>;
  for (const item of items) byCategory[item.category]++;

  // season (multi-value)
  const bySeason = Object.fromEntries(
    SeasonSchema.options.map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const item of items) {
    for (const s of item.season) bySeason[s]++;
  }

  // formality 1-5
  const byFormality: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of items) {
    const f = item.formality;
    if (f >= 1 && f <= 5) byFormality[f]++;
  }

  // pattern
  const byPattern: Record<string, number> = {};
  for (const item of items) {
    if (item.pattern) byPattern[item.pattern] = (byPattern[item.pattern] ?? 0) + 1;
  }

  // colors — hex で集約し、hex 昇順 (暗→明)
  const colorMap = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const c of item.colors) {
      const existing = colorMap.get(c.hex);
      if (existing) existing.count++;
      else colorMap.set(c.hex, { name: c.name, count: 1 });
    }
  }
  const topColors = [...colorMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  // brands — trim して表記揺れを吸収、件数降順 top10
  const brandMap = new Map<string, number>();
  for (const item of items) {
    if (item.brand) {
      const key = item.brand.trim();
      brandMap.set(key, (brandMap.get(key) ?? 0) + 1);
    }
  }
  const topBrands = [...brandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    total,
    iconized,
    byCategory,
    bySeason,
    byFormality,
    byPattern,
    topColors,
    topBrands,
    /** ユニークブランド数 (trim 後)。サマリータイルに表示 */
    brandCount: brandMap.size,
  };
}
