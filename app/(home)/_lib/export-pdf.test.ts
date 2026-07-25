import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installCanvasMock,
  installCreateImageBitmapMock,
  type BitmapMockHandle,
  type CanvasMockHandle,
} from "@/test/helpers/browser";
import { makeItem } from "@/test/helpers/factories";

// jsPDF は実物を動かす必要がないので丸ごと差し替え、呼び出しだけ観測する。
// vi.mock は巻き上げられるので spy は vi.hoisted 内で作る。
const pdf = vi.hoisted(() => ({
  ctor: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  output: vi.fn(() => new Blob(["%PDF-fake"], { type: "application/pdf" })),
}));

vi.mock("jspdf", () => ({
  jsPDF: class {
    constructor(...args: unknown[]) {
      pdf.ctor(...args);
    }
    addPage = pdf.addPage;
    addImage = pdf.addImage;
    output = pdf.output;
  },
}));

const { buildWardrobePdf } = await import("./export-pdf");

// export-pdf.ts の定数から決まる 1 ページあたりの行数。
// floor((297 - 15 - 26) / 25) = floor(10.24)
const ROWS_PER_PAGE = 10;

let canvas: CanvasMockHandle;
let bitmap: BitmapMockHandle;

/** 画像取得を成功させる fetch。 */
function fetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["img"], { type: "image/png" })),
      }),
    ),
  );
}

beforeEach(() => {
  pdf.ctor.mockClear();
  pdf.addPage.mockClear();
  pdf.addImage.mockClear();
  pdf.output.mockClear();
  canvas = installCanvasMock();
  bitmap = installCreateImageBitmapMock({ width: 200, height: 100 });
  fetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildWardrobePdf", () => {
  it("A4 縦の jsPDF を mm 単位で作る", async () => {
    await buildWardrobePdf([]);
    expect(pdf.ctor).toHaveBeenCalledWith({ unit: "mm", format: "a4" });
  });

  it("jsPDF が出した Blob をそのまま返す", async () => {
    const out = await buildWardrobePdf([makeItem()]);
    expect(pdf.output).toHaveBeenCalledWith("blob");
    expect(out).toBe(pdf.output.mock.results[0].value);
  });

  describe("ページ分割", () => {
    it("0 件でも見出しだけのページを 1 枚出す", async () => {
      await buildWardrobePdf([]);

      expect(pdf.addImage).toHaveBeenCalledTimes(1);
      expect(pdf.addPage).not.toHaveBeenCalled();
      expect(canvas.lastCtx().texts()).toContain("dress-up ワードローブ一覧");
    });

    it("1 ページに収まる件数では改ページしない", async () => {
      const items = Array.from({ length: ROWS_PER_PAGE }, (_, i) =>
        makeItem({ id: `item-${i}` }),
      );

      await buildWardrobePdf(items);

      expect(pdf.addImage).toHaveBeenCalledTimes(1);
      expect(pdf.addPage).not.toHaveBeenCalled();
    });

    it("1 件でも溢れると 2 ページ目を作る", async () => {
      const items = Array.from({ length: ROWS_PER_PAGE + 1 }, (_, i) =>
        makeItem({ id: `item-${i}` }),
      );

      await buildWardrobePdf(items);

      expect(pdf.addImage).toHaveBeenCalledTimes(2);
      expect(pdf.addPage).toHaveBeenCalledTimes(1);
      expect(canvas.canvases).toHaveLength(2);
    });
  });

  describe("見出し", () => {
    it("全件数を出す (絞り込み後の件数ではなく渡された配列の長さ)", async () => {
      const items = Array.from({ length: 3 }, (_, i) =>
        makeItem({ id: `item-${i}` }),
      );

      await buildWardrobePdf(items);

      const header = canvas.canvases[0].ctx
        .texts()
        .find((t) => t.startsWith("生成日:"));
      expect(header).toContain("全 3 件");
    });
  });

  describe("サムネイル", () => {
    it("取得できた画像は描画する", async () => {
      await buildWardrobePdf([makeItem()]);

      expect(canvas.lastCtx().callsOf("drawImage")).toHaveLength(1);
      expect(canvas.lastCtx().texts()).not.toContain("画像なし");
    });

    it("アイコンがあればアイコンを、無ければ元画像を取りに行く", async () => {
      await buildWardrobePdf([
        makeItem({ imageKey: "items/a.jpg", iconKey: "icons/a.png" }),
      ]);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/images/icons/a.png");

      vi.mocked(fetch).mockClear();
      await buildWardrobePdf([
        makeItem({ imageKey: "items/b.jpg", iconKey: null }),
      ]);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/images/items/b.jpg");
    });

    it("画像が 404 ならプレースホルダを描いて処理を続ける", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({ ok: false, blob: () => Promise.resolve(new Blob()) }),
        ),
      );

      await buildWardrobePdf([makeItem()]);

      expect(canvas.lastCtx().texts()).toContain("画像なし");
      expect(canvas.lastCtx().callsOf("drawImage")).toHaveLength(0);
      // 例外にせず PDF は最後まで出す
      expect(pdf.addImage).toHaveBeenCalledTimes(1);
    });

    it("画像がデコードできなくてもプレースホルダで続行する", async () => {
      bitmap.setImpl(() => Promise.reject(new Error("decode failed")));

      await buildWardrobePdf([makeItem()]);

      expect(canvas.lastCtx().texts()).toContain("画像なし");
      expect(pdf.addImage).toHaveBeenCalledTimes(1);
    });

    it("fetch 自体が失敗してもプレースホルダで続行する", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      await buildWardrobePdf([makeItem()]);

      expect(canvas.lastCtx().texts()).toContain("画像なし");
      expect(pdf.addImage).toHaveBeenCalledTimes(1);
    });
  });

  describe("行の内容", () => {
    it("サブカテゴリとブランドを見出しに出す", async () => {
      await buildWardrobePdf([
        makeItem({ subcategory: "パーカー", brand: "Uniqlo" }),
      ]);

      const texts = canvas.lastCtx().texts();
      expect(texts.some((t) => t.includes("パーカー") && t.includes("Uniqlo"))).toBe(
        true,
      );
    });

    it("色スウォッチを色数ぶん描く", async () => {
      await buildWardrobePdf([
        makeItem({
          colors: [
            { name: "白", hex: "#ffffff" },
            { name: "紺", hex: "#1f2a44" },
            { name: "赤", hex: "#ff0000" },
          ],
        }),
      ]);

      expect(canvas.lastCtx().callsOf("arc")).toHaveLength(3);
    });

    it("季節・柄・フォーマリティを 1 行にまとめる", async () => {
      await buildWardrobePdf([
        makeItem({ season: ["spring", "summer"], pattern: "stripe", formality: 2 }),
      ]);

      const detail = canvas
        .lastCtx()
        .texts()
        .find((t) => t.includes("春"));
      expect(detail).toBe("春/夏・ストライプ・カジュアル");
    });

    it("柄が無い場合はその項目を落とす", async () => {
      await buildWardrobePdf([
        makeItem({ season: ["winter"], pattern: null, formality: 4 }),
      ]);

      const detail = canvas
        .lastCtx()
        .texts()
        .find((t) => t.includes("冬"));
      expect(detail).toBe("冬・ビジネス");
    });

    it("幅に収まらない見出しは省略記号付きで切り詰める", async () => {
      const longName = "とても長いサブカテゴリ名がここに入る";

      // 既定の 1 文字 10px では収まってしまうので、幅を広げて必ず溢れさせる。
      // context はテスト対象の内部で生成されるため、mock の設置時に指定する。
      vi.unstubAllGlobals();
      canvas = installCanvasMock({ charWidth: 100 });
      installCreateImageBitmapMock({ width: 200, height: 100 });
      fetchOk();

      await buildWardrobePdf([makeItem({ subcategory: longName })]);

      const title = canvas
        .lastCtx()
        .texts()
        .find((t) => t.endsWith("…"));
      expect(title).toBeDefined();
      expect(longName.startsWith(title!.slice(0, -1))).toBe(true);
      expect(title!.length).toBeLessThan(longName.length);
    });
  });
});
