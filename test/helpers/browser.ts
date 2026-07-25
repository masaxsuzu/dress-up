// canvas / createImageBitmap などブラウザ専用 API の fake。
// vitest の environment は "node" なので document も createImageBitmap も無い。
// jsdom を入れても canvas の描画は未実装 (別途 node-canvas が要る) なので、
// 必要な API だけを記録付きスタブで生やす方針にしている。
//
// 差し替えは `vi.stubGlobal` で行うため、後片付けはテスト側の
// `afterEach(() => vi.unstubAllGlobals())` 一行で足りる。
import { vi } from "vitest";

export type Ctx2DCall = { method: string; args: unknown[] };

/** 2D context の fake。メソッド呼び出しを `calls` に記録する。 */
export interface FakeCtx2D {
  calls: Ctx2DCall[];
  /** 指定メソッドの呼び出しだけ抜き出す */
  callsOf: (method: string) => Ctx2DCall[];
  /** `fillText` に渡された文字列の一覧 */
  texts: () => string[];
  /** measureText が返す 1 文字あたりの幅。文字列切り詰めの検証で使う */
  charWidth: number;
  measureText: (text: string) => { width: number };
  // 描画スタイル (呼び出し側が代入するだけなので通常のフィールドで足りる)
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  // 記録対象のメソッド
  fillRect: (...args: unknown[]) => void;
  strokeRect: (...args: unknown[]) => void;
  fillText: (...args: unknown[]) => void;
  drawImage: (...args: unknown[]) => void;
  beginPath: () => void;
  arc: (...args: unknown[]) => void;
  fill: () => void;
  stroke: () => void;
  moveTo: (...args: unknown[]) => void;
  lineTo: (...args: unknown[]) => void;
}

function createFakeCtx2D(): FakeCtx2D {
  const calls: Ctx2DCall[] = [];
  const rec =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const ctx: FakeCtx2D = {
    calls,
    callsOf: (method) => calls.filter((c) => c.method === method),
    texts: () =>
      calls.filter((c) => c.method === "fillText").map((c) => String(c.args[0])),
    charWidth: 10,
    measureText: (text: string) => {
      calls.push({ method: "measureText", args: [text] });
      return { width: text.length * ctx.charWidth };
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect: rec("fillRect"),
    strokeRect: rec("strokeRect"),
    fillText: rec("fillText"),
    drawImage: rec("drawImage"),
    beginPath: rec("beginPath"),
    arc: rec("arc"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
  };
  return ctx;
}

export interface FakeCanvas {
  width: number;
  height: number;
  ctx: FakeCtx2D;
  /** `toBlob` に渡されたエンコード指定 (形式・品質の検証用) */
  toBlobArgs: { type?: string; quality?: number }[];
  getContext: (id: string) => FakeCtx2D | null;
  toDataURL: (type?: string, quality?: number) => string;
  toBlob: (
    cb: (b: Blob | null) => void,
    type?: string,
    quality?: number,
  ) => void;
}

export interface CanvasMockHandle {
  /** `document.createElement("canvas")` で作られた canvas を生成順に保持 */
  canvases: FakeCanvas[];
  /** 最後に作られた canvas の 2D context */
  lastCtx: () => FakeCtx2D;
  /** 以降に作る canvas の `getContext("2d")` を null にする */
  failContext: () => void;
  /** `toBlob` が null を返すようにする */
  failToBlob: () => void;
}

/**
 * `document.createElement("canvas")` を fake canvas に差し替える。
 * canvas 以外のタグは、黙って壊れるより落ちた方が良いので投げる。
 */
export function installCanvasMock(
  options: {
    /**
     * 生成する全 context の `measureText` の 1 文字あたり幅。
     * context はテスト対象の内部で作られるため後から差し替えられない。
     * 文字列の切り詰めを検証したいときはここで大きめの値を渡す。
     */
    charWidth?: number;
  } = {},
): CanvasMockHandle {
  const canvases: FakeCanvas[] = [];
  let contextFails = false;
  let blob: Blob | null = new Blob(["fake-jpeg"], { type: "image/jpeg" });

  const createElement = (tag: string) => {
    if (tag !== "canvas") {
      throw new Error(`installCanvasMock: 未対応の要素 <${tag}>`);
    }
    const ctx = createFakeCtx2D();
    if (options.charWidth !== undefined) ctx.charWidth = options.charWidth;
    const canvas: FakeCanvas = {
      width: 0,
      height: 0,
      ctx,
      toBlobArgs: [],
      getContext: (id) => (id === "2d" && !contextFails ? ctx : null),
      toDataURL: () => "data:image/jpeg;base64,ZmFrZQ==",
      toBlob: (cb, type, quality) => {
        canvas.toBlobArgs.push({ type, quality });
        cb(blob);
      },
    };
    canvases.push(canvas);
    return canvas;
  };

  vi.stubGlobal("document", { createElement: vi.fn(createElement) });

  return {
    canvases,
    lastCtx: () => {
      const last = canvases.at(-1);
      if (!last) throw new Error("canvas がまだ生成されていない");
      return last.ctx;
    },
    failContext: () => {
      contextFails = true;
    },
    failToBlob: () => {
      blob = null;
    },
  };
}

export interface FakeBitmap {
  width: number;
  height: number;
  close: () => void;
}

export type CreateImageBitmapImpl = (
  source: unknown,
  options?: { imageOrientation?: string },
) => Promise<FakeBitmap>;

export interface BitmapMockHandle {
  /** 呼び出し引数を生成順に保持 */
  calls: { source: unknown; options?: { imageOrientation?: string } }[];
  /** bitmap の `close()` が呼ばれた回数 */
  closed: () => number;
  /** 振る舞いを差し替える (向き検出の分岐を個別に試すのに使う) */
  setImpl: (impl: CreateImageBitmapImpl) => void;
}

/**
 * グローバルの `createImageBitmap` を差し替える。既定は指定サイズの
 * bitmap を返すだけ。`setImpl` で拒否や引数依存の振る舞い
 * (imageOrientation 非対応の再現など) に変えられる。
 */
export function installCreateImageBitmapMock(
  size: { width: number; height: number } = { width: 100, height: 100 },
): BitmapMockHandle {
  const calls: BitmapMockHandle["calls"] = [];
  let closed = 0;

  let impl: CreateImageBitmapImpl = () =>
    Promise.resolve({
      width: size.width,
      height: size.height,
      close: () => {
        closed += 1;
      },
    });

  vi.stubGlobal(
    "createImageBitmap",
    vi.fn((source: unknown, options?: { imageOrientation?: string }) => {
      calls.push({ source, options });
      return impl(source, options);
    }),
  );

  return {
    calls,
    closed: () => closed,
    setImpl: (next) => {
      impl = next;
    },
  };
}
