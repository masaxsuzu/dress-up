// ギャラリーの絞り込み条件 (テキスト/カテゴリ/シーズン) と URL パラメータ変換。
// 純粋関数のみ。ビューは components/gallery.tsx。
import type { ClothingCategory, ClothingItem, Season } from "@/schema/clothing";
import { ClothingCategorySchema, SeasonSchema } from "@/schema/clothing";

export type GalleryParams = {
  q: string;
  categories: ClothingCategory[];
  seasons: Season[];
};

export function matchesText(item: ClothingItem, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return [
    item.subcategory,
    item.brand,
    item.material,
    item.notes,
    ...item.tags,
  ]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(lower));
}

export function matchesCategory(
  item: ClothingItem,
  categories: ClothingCategory[],
): boolean {
  if (categories.length === 0) return true;
  return categories.includes(item.category);
}

export function matchesSeason(item: ClothingItem, seasons: Season[]): boolean {
  if (seasons.length === 0) return true;
  return seasons.some((s) => item.season.includes(s));
}

export function matchesAll(item: ClothingItem, p: GalleryParams): boolean {
  return (
    matchesText(item, p.q) &&
    matchesCategory(item, p.categories) &&
    matchesSeason(item, p.seasons)
  );
}

export function parseParams(sp: URLSearchParams): GalleryParams {
  const q = sp.get("q") ?? "";
  const categories = (sp.getAll("category") as ClothingCategory[]).filter((c) =>
    ClothingCategorySchema.options.includes(c),
  );
  const seasons = (sp.getAll("season") as Season[]).filter((s) =>
    SeasonSchema.options.includes(s),
  );
  return { q, categories, seasons };
}

export function buildURL(params: GalleryParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  for (const c of params.categories) sp.append("category", c);
  for (const s of params.seasons) sp.append("season", s);
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}
