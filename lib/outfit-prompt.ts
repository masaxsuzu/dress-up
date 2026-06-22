import type { ClothingCategory, ClothingItem, Pattern, Season } from "@/schema/clothing";
import type { Profile } from "@/schema/profile";

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

// アイテム描写用の入力 (所有 or 買うべき)。owned は ClothingItem から色や素材を
// 取り出して描写、buy は description (日本語) をそのまま使う。
export type PromptItem =
  | { kind: "owned"; item: ClothingItem }
  | { kind: "buy"; category: ClothingCategory; description: string };

// テストやレガシー呼び出しを楽にするため、ClothingItem の配列もそのまま受ける。
// `kind` プロパティの有無で判定 (ClothingItem は持たない)。
function normalize(x: ClothingItem | PromptItem): PromptItem {
  return "kind" in x ? x : { kind: "owned", item: x };
}

function itemCategory(p: PromptItem): ClothingCategory {
  return p.kind === "owned" ? p.item.category : p.category;
}

function describePromptItem(p: PromptItem): string {
  return p.kind === "owned" ? describeItem(p.item) : p.description;
}

// プロフィールから Flash Image の Subject 行を組み立てる。
// 参考画像を渡している場合は、その人を被写体にする旨も明記する
// (画像自体は呼び出し側が inlineData で添付する)。
export function buildSubjectClause(
  profile: Profile | null,
  hasReferenceImage: boolean,
): string {
  // gender → 名詞。未設定/other は中性的に "person"。
  const noun =
    profile?.gender === "male"
      ? "man"
      : profile?.gender === "female"
        ? "woman"
        : "person";

  const physique: string[] = [];
  if (profile?.heightCm) physique.push(`${profile.heightCm}cm tall`);
  if (profile?.weightKg) physique.push(`${profile.weightKg}kg`);
  if (profile?.bodyType) physique.push(profile.bodyType);
  const physiqueClause = physique.length > 0 ? ` (${physique.join(", ")})` : "";

  const refClause = hasReferenceImage
    ? " Match the face and physique of the reference photo provided."
    : "";

  return `Subject: a young adult ${noun}${physiqueClause} standing naturally, arms relaxed, looking at camera with a soft expression.${refClause}`;
}

export function buildOutfitPrompt(
  rawItems: Array<ClothingItem | PromptItem>,
  context: {
    tpo?: string;
    season?: Season;
    profile?: Profile | null;
    hasReferenceImage?: boolean;
  } = {},
): string {
  const items = rawItems.map(normalize);
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
    (a, b) => wearOrder.indexOf(itemCategory(a)) - wearOrder.indexOf(itemCategory(b)),
  );

  const outfitLines = sorted.map(
    (p) => `- ${CATEGORY_LABEL_EN[itemCategory(p)]}: ${describePromptItem(p)}`,
  );

  const seasonClause = context.season
    ? `Season: ${SEASON_LABEL_EN[context.season]}.`
    : "";
  const tpoClause = context.tpo ? `Scene: ${context.tpo}.` : "";

  return [
    "Professional fashion photograph, full body, front view, neutral light gray seamless studio background.",
    buildSubjectClause(context.profile ?? null, context.hasReferenceImage ?? false),
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
