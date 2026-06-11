import type { ClothingCategory, ClothingItem, Season } from "@/schema/clothing";

export type MissingItem = { category: ClothingCategory; description: string };
export type OutfitResult = {
  kind: "outfit";
  items: ClothingItem[];
  reason: string;
};
export type ShoppingResult = {
  kind: "shopping";
  missing: MissingItem[];
  reason: string;
};
export type Result = OutfitResult | ShoppingResult;
