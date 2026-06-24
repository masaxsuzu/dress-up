import { describe, expect, it } from "vitest";
import { buildOutfitPrompt } from "@/lib/outfit-prompt";
import { makeItem, makeProfile } from "@/test/helpers/factories";

describe("buildOutfitPrompt", () => {
  it("日本語の color/subcategory/material を英語に変換する", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({ id: "t", colors: [{ name: "白", hex: "#fff" }], subcategory: "Tシャツ", material: "コットン" }),
        makeItem({ id: "b", category: "bottoms", colors: [{ name: "ネイビー", hex: "#001" }], subcategory: "デニム", material: "デニム" }),
        makeItem({ id: "s", category: "shoes", colors: [{ name: "白", hex: "#fff" }], subcategory: "スニーカー", material: null }),
      ],
      { tpo: "週末ランチ" },
    );
    expect(prompt).toContain("white cotton t-shirt");
    expect(prompt).toContain("navy blue denim jeans");
    expect(prompt).toContain("white sneakers");
    expect(prompt).toContain("Top:");
    expect(prompt).toContain("Bottoms:");
    expect(prompt).toContain("Shoes:");
  });

  it("バッグ・アクセサリーも箇条書きに含まれる", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({ id: "t", subcategory: "Tシャツ" }),
        makeItem({
          id: "bag",
          category: "bag",
          subcategory: "トート",
          colors: [{ name: "黒", hex: "#000" }],
          material: "レザー",
        }),
      ],
      { tpo: "通勤" },
    );
    expect(prompt).toContain("Bag: black leather tote bag");
  });

  it("solid と other パターンは説明に含めない", () => {
    const prompt = buildOutfitPrompt(
      [makeItem({ id: "t", pattern: "solid" })],
      { tpo: "x" },
    );
    expect(prompt).not.toContain("solid t-shirt");
    expect(prompt).not.toContain("solid white");
  });

  it("striped パターンは含める", () => {
    const prompt = buildOutfitPrompt(
      [makeItem({ id: "t", pattern: "stripe", subcategory: "シャツ" })],
      { tpo: "x" },
    );
    expect(prompt).toContain("striped");
  });

  it("未知の単語はそのまま使う (フォールバック)", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({
          id: "t",
          subcategory: "オリジナル製品名",
          colors: [{ name: "謎色", hex: "#abc" }],
          material: "謎素材",
        }),
      ],
      { tpo: "x" },
    );
    expect(prompt).toContain("謎色");
    expect(prompt).toContain("謎素材");
    expect(prompt).toContain("オリジナル製品名");
  });

  it("着衣順 (outerwear→tops→dress→bottoms→shoes→bag→accessory) で並べる", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({ id: "shoes", category: "shoes", subcategory: "スニーカー" }),
        makeItem({ id: "outer", category: "outerwear", subcategory: "コート" }),
        makeItem({ id: "tops", category: "tops", subcategory: "Tシャツ" }),
        makeItem({ id: "bottoms", category: "bottoms", subcategory: "デニム" }),
      ],
      { tpo: "x" },
    );
    const coatIdx = prompt.indexOf("coat");
    const tshirtIdx = prompt.indexOf("t-shirt");
    const denimIdx = prompt.indexOf("jeans");
    const sneakerIdx = prompt.indexOf("sneakers");
    expect(coatIdx).toBeGreaterThanOrEqual(0);
    expect(coatIdx).toBeLessThan(tshirtIdx);
    expect(tshirtIdx).toBeLessThan(denimIdx);
    expect(denimIdx).toBeLessThan(sneakerIdx);
  });

  it("素材が subcategory に既に含まれる場合は重複させない", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({
          id: "b",
          category: "bottoms",
          subcategory: "デニム",
          material: "デニム",
          colors: [{ name: "ネイビー", hex: "#001" }],
        }),
      ],
      { tpo: "x" },
    );
    expect(prompt).not.toMatch(/denim denim/);
  });

  it("複数色は up to 2 まで使う", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({
          id: "t",
          subcategory: "シャツ",
          colors: [
            { name: "白", hex: "#fff" },
            { name: "黒", hex: "#000" },
            { name: "赤", hex: "#f00" },
          ],
        }),
      ],
      { tpo: "x" },
    );
    expect(prompt).toContain("white and black");
    expect(prompt).not.toContain("red");
  });

  it("TPO と season をプロンプトに含める", () => {
    const prompt = buildOutfitPrompt(
      [makeItem({ id: "t" })],
      { tpo: "結婚式の二次会", season: "winter" },
    );
    expect(prompt).toContain("Scene: 結婚式の二次会");
    expect(prompt).toContain("Season: winter");
  });

  it("photorealistic と studio background のスタイル指定が含まれる", () => {
    const prompt = buildOutfitPrompt([makeItem({ id: "t" })], { tpo: "x" });
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("studio");
    expect(prompt).toContain("full body");
  });

  it("プロフィール未指定の被写体は中性 (young adult person)", () => {
    const prompt = buildOutfitPrompt([makeItem({ id: "t" })], { tpo: "x" });
    expect(prompt).toMatch(/young adult person/);
  });

  it("profile.gender=male なら 'man'、female なら 'woman'", () => {
    const male = buildOutfitPrompt([makeItem({ id: "t" })], {
      tpo: "x",
      profile: makeProfile({ gender: "male" }),
    });
    expect(male).toMatch(/young adult man/);

    const female = buildOutfitPrompt([makeItem({ id: "t" })], {
      tpo: "x",
      profile: makeProfile({ gender: "female" }),
    });
    expect(female).toMatch(/young adult woman/);
  });

  it("身長・体重・体型・gender=other はカッコ書きで Subject 行に入る", () => {
    const prompt = buildOutfitPrompt([makeItem({ id: "t" })], {
      tpo: "x",
      profile: makeProfile({
        gender: "other",
        heightCm: 175,
        weightKg: 65,
        bodyType: "アスリート体型",
      }),
    });
    expect(prompt).toMatch(/young adult person/);
    expect(prompt).toMatch(/175cm tall/);
    expect(prompt).toMatch(/65kg/);
    expect(prompt).toMatch(/アスリート体型/);
  });

  it("hasReferenceImage:true なら『参考写真の顔と体型に合わせろ』指示が入る", () => {
    const prompt = buildOutfitPrompt([makeItem({ id: "t" })], {
      tpo: "x",
      hasReferenceImage: true,
    });
    expect(prompt).toMatch(/reference photo|face and physique/i);
  });

  it("subcategoryがnullならカテゴリ名を使う", () => {
    const prompt = buildOutfitPrompt(
      [
        makeItem({
          id: "t",
          category: "tops",
          subcategory: null,
          material: null,
          colors: [{ name: "白", hex: "#fff" }],
        }),
      ],
      { tpo: "x" },
    );
    expect(prompt).toContain("white top");
  });
});
