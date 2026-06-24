// テスト全体で使うダミーデータ生成。spec ファイル間で「ClothingItem の
// 必須フィールドを並べる定型」を書かなくて済むようにする。

import type {
  ClothingItem,
  ClothingItemInput,
  ClothingItemUpdate,
} from "@/schema/clothing";
import type { Profile, ProfileInput } from "@/schema/profile";
import type { ProposalDraft } from "@/schema/recommend";

// ClothingItem (DB から読み出した形) のデフォルト。
export function makeItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: "item-default",
    category: "tops",
    subcategory: "Tシャツ",
    colors: [{ name: "白", hex: "#ffffff" }],
    pattern: "solid",
    material: "コットン",
    silhouette: "レギュラー",
    season: ["spring", "summer"],
    formality: 2,
    occasion: ["カジュアル"],
    tags: ["定番"],
    brand: null,
    notes: null,
    imageKey: "items/sample.jpg",
    iconKey: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ClothingItemInput (createItem への引数形)。imageKey 必須、id/createdAt は無い。
export function makeItemInput(
  overrides: Partial<ClothingItemInput> = {},
): ClothingItemInput {
  return {
    category: "tops",
    subcategory: "Tシャツ",
    colors: [{ name: "navy", hex: "#1f2a44" }],
    pattern: "solid",
    material: "cotton",
    silhouette: "regular",
    season: ["spring", "summer"],
    formality: 2,
    occasion: ["casual"],
    tags: ["basic"],
    brand: null,
    notes: null,
    imageKey: "items/sample.jpg",
    ...overrides,
  };
}

// ClothingItemUpdate (updateItem への引数形)。imageKey 無し。
export function makeItemUpdate(
  overrides: Partial<ClothingItemUpdate> = {},
): ClothingItemUpdate {
  return {
    category: "bottoms",
    subcategory: "デニム",
    colors: [{ name: "blue", hex: "#0000ff" }],
    pattern: "stripe",
    material: "denim",
    silhouette: "slim",
    season: ["spring", "autumn"],
    formality: 3,
    occasion: ["office"],
    tags: ["updated"],
    brand: "levis",
    notes: "updated notes",
    ...overrides,
  };
}

// 3 案セット。1 = 全 owned、2 = owned+buy 混在、3 = 全 buy。
export const SAMPLE_PROPOSALS: ProposalDraft[] = [
  {
    items: [
      { kind: "owned", id: "tops-1" },
      { kind: "owned", id: "bottoms-1" },
      { kind: "owned", id: "shoes-1" },
    ],
    reason: "1: シンプル",
  },
  {
    items: [
      { kind: "owned", id: "tops-1" },
      { kind: "buy", category: "bottoms", description: "ベージュチノパン" },
      { kind: "owned", id: "shoes-1" },
    ],
    reason: "2: チノで明るく",
  },
  {
    items: [
      { kind: "buy", category: "tops", description: "ネイビーポロ" },
      { kind: "buy", category: "bottoms", description: "黒スラックス" },
      { kind: "buy", category: "shoes", description: "茶色レザー" },
    ],
    reason: "3: 全部買い替え",
  },
];

// 共通のユーザメール (テスト間で同一)。テナント分離テストでは別の値も使う。
export const ALICE = "alice@example.com";
export const BOB = "bob@example.com";

// Profile factory (Profile or ProfileInput どちらも形は同じ + updatedAt)。
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    gender: null,
    heightCm: null,
    weightKg: null,
    bodyType: null,
    referenceImageKey: null,
    updatedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

export function makeProfileInput(
  overrides: Partial<ProfileInput> = {},
): ProfileInput {
  return {
    gender: null,
    heightCm: null,
    weightKg: null,
    bodyType: null,
    referenceImageKey: null,
    ...overrides,
  };
}
