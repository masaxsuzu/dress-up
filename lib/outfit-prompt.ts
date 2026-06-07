import type { ClothingCategory, ClothingItem, Pattern } from "@/schema/clothing";

const CATEGORY_NOUN: Record<ClothingCategory, string> = {
  tops: "top",
  outerwear: "outerwear",
  bottoms: "bottoms",
  dress: "dress",
  shoes: "shoes",
  bag: "bag",
  accessory: "accessory",
  other: "item",
};

const PATTERN_ADJ: Record<Pattern, string> = {
  solid: "solid",
  stripe: "striped",
  check: "checked",
  dot: "polka dot",
  floral: "floral",
  graphic: "graphic",
  other: "",
};

const SUBCATEGORY_JA_TO_EN: Record<string, string> = {
  "Tシャツ": "T-shirt",
  "シャツ": "shirt",
  "ブラウス": "blouse",
  "ニット": "knit sweater",
  "セーター": "sweater",
  "スウェット": "sweatshirt",
  "パーカー": "hoodie",
  "カーディガン": "cardigan",
  "タンクトップ": "tank top",
  "ジャケット": "jacket",
  "ブレザー": "blazer",
  "コート": "coat",
  "ダウン": "down jacket",
  "ダウンジャケット": "down jacket",
  "ブルゾン": "blouson",
  "トレンチコート": "trench coat",
  "デニム": "denim jeans",
  "ジーンズ": "jeans",
  "パンツ": "pants",
  "スラックス": "slacks",
  "チノパン": "chinos",
  "スカート": "skirt",
  "ミニスカート": "mini skirt",
  "ロングスカート": "long skirt",
  "ショーツ": "shorts",
  "ワンピース": "dress",
  "ロングワンピース": "long dress",
  "スニーカー": "sneakers",
  "パンプス": "pumps",
  "ヒール": "high heels",
  "ブーツ": "boots",
  "ローファー": "loafers",
  "サンダル": "sandals",
  "革靴": "leather shoes",
  "バッグ": "handbag",
  "トート": "tote bag",
  "トートバッグ": "tote bag",
  "バックパック": "backpack",
  "リュック": "backpack",
  "ショルダーバッグ": "shoulder bag",
  "クラッチ": "clutch",
  "ハット": "hat",
  "キャップ": "cap",
  "ニット帽": "beanie",
  "マフラー": "scarf",
  "ストール": "stole",
  "ベルト": "belt",
  "ピアス": "earrings",
  "ネックレス": "necklace",
  "サングラス": "sunglasses",
  "メガネ": "glasses",
};

const COLOR_JA_TO_EN: Record<string, string> = {
  "白": "white",
  "オフホワイト": "off-white",
  "黒": "black",
  "グレー": "gray",
  "チャコール": "charcoal",
  "赤": "red",
  "ワインレッド": "wine red",
  "ピンク": "pink",
  "オレンジ": "orange",
  "黄": "yellow",
  "イエロー": "yellow",
  "ベージュ": "beige",
  "茶": "brown",
  "茶色": "brown",
  "ブラウン": "brown",
  "カーキ": "khaki",
  "緑": "green",
  "グリーン": "green",
  "青": "blue",
  "ブルー": "blue",
  "ネイビー": "navy",
  "水色": "light blue",
  "紫": "purple",
  "パープル": "purple",
  "ラベンダー": "lavender",
  "ゴールド": "gold",
  "シルバー": "silver",
};

const MATERIAL_JA_TO_EN: Record<string, string> = {
  "コットン": "cotton",
  "ウール": "wool",
  "デニム": "denim",
  "レザー": "leather",
  "リネン": "linen",
  "ナイロン": "nylon",
  "ポリエステル": "polyester",
  "カシミヤ": "cashmere",
  "シルク": "silk",
  "フリース": "fleece",
  "スウェード": "suede",
  "ニット": "knit",
};

function translate(map: Record<string, string>, value: string | null): string {
  if (!value) return "";
  return map[value] ?? value;
}

function describeItem(item: ClothingItem): string {
  const parts: string[] = [];
  const firstColor = item.colors[0]?.name;
  if (firstColor) parts.push(translate(COLOR_JA_TO_EN, firstColor));
  if (item.pattern && item.pattern !== "solid" && item.pattern !== "other") {
    parts.push(PATTERN_ADJ[item.pattern]);
  }
  if (item.material) parts.push(translate(MATERIAL_JA_TO_EN, item.material));
  const sub = item.subcategory
    ? translate(SUBCATEGORY_JA_TO_EN, item.subcategory)
    : CATEGORY_NOUN[item.category];
  parts.push(sub);
  return parts.filter(Boolean).join(" ");
}

export function buildOutfitPrompt(
  items: ClothingItem[],
  tpo: string,
): string {
  const wearOrder: ClothingCategory[] = [
    "outerwear",
    "tops",
    "dress",
    "bottoms",
    "shoes",
    "bag",
    "accessory",
    "other",
  ];
  const sorted = [...items].sort(
    (a, b) => wearOrder.indexOf(a.category) - wearOrder.indexOf(b.category),
  );
  const wearables = sorted
    .filter((i) => i.category !== "bag" && i.category !== "accessory")
    .map(describeItem);
  const accessories = sorted
    .filter((i) => i.category === "bag" || i.category === "accessory")
    .map(describeItem);

  const wearText = wearables.length > 0 ? wearables.join(", ") : "casual clothes";
  const accText =
    accessories.length > 0 ? ` Holding ${accessories.join(" and ")}.` : "";

  return [
    "Full-body fashion lookbook photo, frontal view, neutral light gray studio background.",
    `A young Japanese person standing naturally, wearing ${wearText}.${accText}`,
    "Soft natural lighting, sharp focus, clean magazine editorial style, no text, no logos.",
  ].join(" ");
}
