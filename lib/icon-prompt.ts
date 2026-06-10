import type { ClothingCategory } from "@/schema/clothing";

// 全カテゴリ共通の制約。
// ghost-mannequin (invisible mannequin) スタイル: 服が着られた形を保つが
// 人体は見えない。製品写真でよく使われる手法。
const BASE =
  "Pure white background, isolated, no shadows, no person or mannequin visible. " +
  "Faithfully reproduce the item's color, pattern, texture, and material. " +
  "Sharp focus, even lighting, no extra props, vertically centered, fill the frame.";

// カテゴリ別の「どう着られているか」の指示。スタック時に自然に「人が着ている」
// シルエットになるよう、向き・スケール・パーツの位置を揃える。
const CATEGORY_HINT: Record<ClothingCategory, string> = {
  tops:
    "Render this garment as if worn on an invisible body, ghost-mannequin product photography: " +
    "shoulders defined, sleeves hanging slightly out, neckline at the top, hem at the waist. " +
    "Front view, vertical orientation.",
  outerwear:
    "Render this outer garment as if worn open over an invisible body, ghost-mannequin style: " +
    "shoulders at the top, sleeves hanging straight down on both sides, " +
    "FULLY UNBUTTONED with the front parted so the center vertical axis (where inner clothes would be) is empty/visible. " +
    "The two front panels drape outward to either side, exposing the lining or inside fabric. " +
    "Lapels, collar, and hem clearly visible. Front view, vertical orientation.",
  bottoms:
    "Render this bottom garment as if worn on an invisible lower body, ghost-mannequin style: " +
    "waistband at the top, two legs straight down for pants or skirt fanning naturally. " +
    "Front view, vertical orientation.",
  dress:
    "Render this dress as if worn on an invisible body, ghost-mannequin style: " +
    "shoulders/neckline at the top, dress falling to its natural length. " +
    "Front view, vertical orientation.",
  shoes:
    "Render this pair of shoes as if worn in a standing pose, from a slight 3/4 front angle. " +
    "Place both shoes flat on the floor with HEELS CLOSE TOGETHER and TOES POINTED OUTWARD at about 20-30 degrees (V-shape, ハの字, like standing at attention). " +
    "Both shoes fully visible at the same scale.",
  bag:
    "Render this bag from the front, hanging naturally from its invisible strap or handle. " +
    "Show the full silhouette.",
  accessory:
    "Render this accessory worn in its natural position on an invisible body " +
    "(necklace around the neckline, scarf draped, hat upright, watch on wrist).",
  other:
    "Render this item from its most recognizable angle as a clean product shot.",
};

export function buildIconPrompt(category: ClothingCategory): string {
  return `${CATEGORY_HINT[category]} ${BASE}`;
}
