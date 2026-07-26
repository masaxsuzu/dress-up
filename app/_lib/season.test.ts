import { describe, expect, it } from "vitest";
import type { Season } from "@/schema/clothing";
import { currentSeason } from "./season";

// 月 → 季節の対応表。1 ケースで全 12 か月を突き合わせるので、境界
// (2/3・5/6・8/9・11/12) も内側の月もまとめて検証できる。月ごとにケースを
// 分けると、ズレたときに最初の 1 件しか見えないぶん情報がむしろ減る。
const BY_MONTH: Record<number, Season> = {
  1: "winter",
  2: "winter",
  3: "spring",
  4: "spring",
  5: "spring",
  6: "summer",
  7: "summer",
  8: "summer",
  9: "autumn",
  10: "autumn",
  11: "autumn",
  12: "winter",
};

describe("currentSeason", () => {
  it("全 12 か月を正しい季節に対応させる (境界含む)", () => {
    const actual = Object.fromEntries(
      Object.keys(BY_MONTH).map((m) => [
        m,
        currentSeason(new Date(2024, Number(m) - 1, 1)),
      ]),
    );
    expect(actual).toEqual(BY_MONTH);
  });

  it("引数なしなら現在日時で判定する", () => {
    expect(currentSeason()).toBe(BY_MONTH[new Date().getMonth() + 1]);
  });
});
