import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeBackground } from "@/lib/photoroom";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jpegBytes(): ArrayBuffer {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).buffer;
}

describe("removeBackground", () => {
  it("成功時は背景除去後の bytes/mimeType を返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    const result = await removeBackground("k", jpegBytes(), "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/jpeg");
    expect(new Uint8Array(result!.bytes).slice(-3)).toEqual(
      new Uint8Array([9, 9, 9]),
    );
  });

  it("非 200 は null", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const result = await removeBackground("k", jpegBytes(), "image/jpeg");
    expect(result).toBeNull();
  });

  it("Content-Type が image/* でないと null", async () => {
    fetchMock.mockResolvedValue(
      new Response("error", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    const result = await removeBackground("k", jpegBytes(), "image/jpeg");
    expect(result).toBeNull();
  });

  it("Content-Type ヘッダ無しなら image/jpeg と仮定する", async () => {
    const res = new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
      status: 200,
    });
    // Response が body から自動付与する Content-Type を消す
    res.headers.delete("Content-Type");
    fetchMock.mockResolvedValue(res);

    const result = await removeBackground("k", jpegBytes(), "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/jpeg");
  });

  it("リクエストに x-api-key と multipart で画像が含まれる", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    await removeBackground("sk-test-photoroom", jpegBytes(), "image/jpeg");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/photoroom\.com/);
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe("sk-test-photoroom");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get("imageFile")).toBeInstanceOf(Blob);
    expect(body.get("background.color")).toBe("FFFFFFFF");
    expect(body.get("export.format")).toBe("jpg");
  });

  it("background: 'transparent' で 00000000 / PNG を要求する", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const result = await removeBackground("k", jpegBytes(), "image/jpeg", {
      background: "transparent",
    });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/png");

    const [, init] = fetchMock.mock.calls[0];
    const body = init.body as FormData;
    expect(body.get("background.color")).toBe("00000000");
    expect(body.get("export.format")).toBe("png");
    expect(init.headers.Accept).toBe("image/png");
  });
});
