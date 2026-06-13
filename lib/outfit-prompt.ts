import type { ClothingCategory, ClothingItem, Pattern, Season } from "@/schema/clothing";

const CATEGORY_LABEL_EN: Record<ClothingCategory, string> = {
  tops: "Top",
  outerwear: "Outerwear",
  bottoms: "Bottoms",
  dress: "Dress",
  shoes: "Shoes",
  bag: "Bag",
  accessory: "Accessory",
  other: "Item",
};

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
  solid: "",
  stripe: "striped",
  check: "checked",
  dot: "polka dot",
  floral: "floral",
  graphic: "graphic-print",
  other: "",
};

const SEASON_LABEL_EN: Record<Season, string> = {
  spring: "spring",
  summer: "summer",
  autumn: "autumn",
  winter: "winter",
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
  "デニム": "jeans",
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
  "チャコール": "charcoal gray",
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
  "ネイビー": "navy blue",
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

// "navy denim denim jeans" のような重複を避けて、簡潔な英語描写にする。
function describeItem(item: ClothingItem): string {
  const tokens: string[] = [];

  const colors = item.colors.slice(0, 2).map((c) => translate(COLOR_JA_TO_EN, c.name));
  if (colors.length === 1) tokens.push(colors[0]);
  else if (colors.length === 2) tokens.push(`${colors[0]} and ${colors[1]}`);

  if (item.pattern && PATTERN_ADJ[item.pattern]) {
    tokens.push(PATTERN_ADJ[item.pattern]);
  }

  const material = translate(MATERIAL_JA_TO_EN, item.material).toLowerCase();
  const sub = item.subcategory
    ? translate(SUBCATEGORY_JA_TO_EN, item.subcategory).toLowerCase()
    : CATEGORY_NOUN[item.category];

  // material が subcategory に既に含まれていれば省略 (denim + jeans = jeans)
  if (material && !sub.includes(material)) tokens.push(material);
  tokens.push(sub);

  return tokens.filter(Boolean).join(" ");
}

export function buildOutfitPrompt(
  items: ClothingItem[],
  context: { tpo?: string; season?: Season } = {},
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

  const outfitLines = sorted.map(
    (item) => `- ${CATEGORY_LABEL_EN[item.category]}: ${describeItem(item)}`,
  );

  const seasonClause = context.season
    ? `Season: ${SEASON_LABEL_EN[context.season]}.`
    : "";
  const tpoClause = context.tpo ? `Scene: ${context.tpo}.` : "";

  return [
    "Professional fashion photograph, full body, front view, neutral light gray seamless studio background.",
    "Subject: a young adult man standing naturally, arms relaxed, looking at camera with a soft expression.",
    seasonClause,
    tpoClause,
    "",
    "Outfit (the model must wear exactly these items, with accurate colors and materials):",
    ...outfitLines,
    "",
    "Style: high-resolution photorealistic editorial fashion photograph, sharp focus on garments, accurate fabric texture, true-to-description colors, soft natural studio lighting.",
    "Strict: no text, no brand logos, no watermark, no additional clothing not listed above.",
  ]
    .filter(Boolean)
    .join("\n");
}
