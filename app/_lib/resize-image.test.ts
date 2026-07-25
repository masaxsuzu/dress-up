import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installCanvasMock,
  installCreateImageBitmapMock,
  type BitmapMockHandle,
  type CanvasMockHandle,
} from "@/test/helpers/browser";

// 長辺の上限 (resize-image.ts の MAX_DIMENSION と同値)。
const MAX_DIMENSION = 1568;

let canvas: CanvasMockHandle;
let bitmap: BitmapMockHandle;

// resize-image は imageOrientation 対応可否をモジュールスコープに
// キャッシュする。対応あり/なしを別々に検証するには毎回モジュールごと
// 読み直す必要がある (使い回すと 2 例目が 1 例目のキャッシュを見てしまい、
// 意図した分岐を通らないまま緑になる)。
async function loadModule() {
  vi.resetModules();
  return await import("./resize-image");
}

function jpegFile(name = "photo.jpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

beforeEach(() => {
  canvas = installCanvasMock();
  bitmap = installCreateImageBitmapMock({ width: 100, height: 100 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resizeImageForUpload", () => {
  it("長辺が上限を超える画像は縦横比を保って縮小する (横長)", async () => {
    bitmap.setImpl(() =>
      Promise.resolve({ width: 3000, height: 2000, close: () => undefined }),
    );
    const { resizeImageForUpload } = await loadModule();

    await resizeImageForUpload(jpegFile());

    const drawn = canvas.canvases[0];
    expect(drawn.width).toBe(MAX_DIMENSION);
    // 2000 * (1568/3000) = 1045.33 → 四捨五入
    expect(drawn.height).toBe(1045);
  });

  it("縦長画像でも長辺基準で縮小する", async () => {
    bitmap.setImpl(() =>
      Promise.resolve({ width: 2000, height: 3000, close: () => undefined }),
    );
    const { resizeImageForUpload } = await loadModule();

    await resizeImageForUpload(jpegFile());

    expect(canvas.canvases[0].width).toBe(1045);
    expect(canvas.canvases[0].height).toBe(MAX_DIMENSION);
  });

  it("上限以下の画像は寸法を変えない", async () => {
    bitmap.setImpl(() =>
      Promise.resolve({ width: 800, height: 600, close: () => undefined }),
    );
    const { resizeImageForUpload } = await loadModule();

    await resizeImageForUpload(jpegFile());

    expect(canvas.canvases[0].width).toBe(800);
    expect(canvas.canvases[0].height).toBe(600);
  });

  it("拡張子を .jpg に付け替えた image/jpeg の File を返す", async () => {
    const { resizeImageForUpload } = await loadModule();

    const out = await resizeImageForUpload(jpegFile("IMG_0001.HEIC"));

    expect(out.name).toBe("IMG_0001.jpg");
    expect(out.type).toBe("image/jpeg");
  });

  it("canvas に bitmap を描いてから close する", async () => {
    bitmap.setImpl(() =>
      Promise.resolve({ width: 800, height: 600, close: () => undefined }),
    );
    const { resizeImageForUpload } = await loadModule();

    await resizeImageForUpload(jpegFile());

    const draws = canvas.canvases[0].ctx.callsOf("drawImage");
    expect(draws).toHaveLength(1);
    expect(draws[0].args.slice(1)).toEqual([0, 0, 800, 600]);
  });

  describe("失敗時は元のファイルをそのまま返す", () => {
    it("2D context が取れないとき", async () => {
      canvas.failContext();
      const { resizeImageForUpload } = await loadModule();
      const input = jpegFile();

      const out = await resizeImageForUpload(input);

      expect(out).toBe(input);
    });

    it("toBlob が null を返すとき", async () => {
      canvas.failToBlob();
      const { resizeImageForUpload } = await loadModule();
      const input = jpegFile();

      const out = await resizeImageForUpload(input);

      expect(out).toBe(input);
    });

    it("createImageBitmap が失敗するとき", async () => {
      // 対応検出の probe も本番の変換も両方失敗させる
      bitmap.setImpl(() => Promise.reject(new Error("decode failed")));
      const { resizeImageForUpload } = await loadModule();
      const input = jpegFile();

      const out = await resizeImageForUpload(input);

      expect(out).toBe(input);
    });
  });

  describe("EXIF 向き (imageOrientation) の対応検出", () => {
    it("対応していれば本番の変換にも imageOrientation を渡す", async () => {
      const { resizeImageForUpload } = await loadModule();

      await resizeImageForUpload(jpegFile());

      // 1 回目 = 対応検出の probe、2 回目 = 実ファイルの変換
      expect(bitmap.calls).toHaveLength(2);
      expect(bitmap.calls[1].options).toEqual({
        imageOrientation: "from-image",
      });
    });

    it("非対応なら option 無しで再試行する", async () => {
      // probe (option 付き) だけ失敗させ、option 無しは成功させる
      bitmap.setImpl((_source, options) =>
        options?.imageOrientation
          ? Promise.reject(new Error("unsupported"))
          : Promise.resolve({ width: 100, height: 100, close: () => undefined }),
      );
      const { resizeImageForUpload } = await loadModule();

      const out = await resizeImageForUpload(jpegFile());

      expect(bitmap.calls).toHaveLength(2);
      expect(bitmap.calls[1].options).toBeUndefined();
      // option 無しの経路でも変換自体は成功している
      expect(out.type).toBe("image/jpeg");
    });

    it("検出結果はキャッシュされ、2 回目以降は probe しない", async () => {
      const { resizeImageForUpload } = await loadModule();

      await resizeImageForUpload(jpegFile());
      expect(bitmap.calls).toHaveLength(2); // probe + 変換

      await resizeImageForUpload(jpegFile());
      expect(bitmap.calls).toHaveLength(3); // 変換のみ追加
    });
  });
});
