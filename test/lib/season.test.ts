import { describe, expect, it } from "vitest";
import { currentSeason } from "@/lib/season";

function d(month: number): Date {
  // 2024年の各月1日を使って境界を検証する
  return new Date(2024, month - 1, 1);
}

describe("currentSeason", () => {
  it("3月は spring を返す", () => {
    expect(currentSeason(d(3))).toBe("spring");
  });

  it("2月は winter を返す (spring の前月)", () => {
    expect(currentSeason(d(2))).toBe("winter");
  });

  it("5月は spring を返す", () => {
    expect(currentSeason(d(5))).toBe("spring");
  });

  it("6月は summer を返す (spring の翌月)", () => {
    expect(currentSeason(d(6))).toBe("summer");
  });

  it("8月は summer を返す", () => {
    expect(currentSeason(d(8))).toBe("summer");
  });

  it("9月は autumn を返す (summer の翌月)", () => {
    expect(currentSeason(d(9))).toBe("autumn");
  });

  it("11月は autumn を返す", () => {
    expect(currentSeason(d(11))).toBe("autumn");
  });

  it("12月は winter を返す (autumn の翌月)", () => {
    expect(currentSeason(d(12))).toBe("winter");
  });

  it("1月は winter を返す", () => {
    expect(currentSeason(d(1))).toBe("winter");
  });
});
