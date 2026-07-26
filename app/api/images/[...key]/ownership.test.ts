// 「他人の imageKey を自分のものとして申告する」攻撃の回帰テスト。
//
// 修正前は所有判定が「その key を含む行が自分の user_email で存在するか」
// だけだったため、他人の key を自分のアイテム / プロフィールとして登録すれば
// 所有者になれた。読み取りだけでなく、旧画像を消す経路を通じて他ユーザーの
// R2 オブジェクトを削除することもできた。
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import {
  ALICE,
  BOB,
  makeItemInput,
  makeProfileInput,
} from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";
import { recordUpload } from "@/app/_lib/uploads";

let d1: TestD1;
let r2: TestR2;

beforeAll(async () => {
  d1 = await createTestD1();
  r2 = await createTestR2();
});
afterAll(async () => {
  await d1.dispose();
  await r2.dispose();
});
beforeEach(async () => {
  await d1.reset();
  await r2.reset();
  setTestEnv({ DB: d1.db, IMAGES: r2.bucket });
});

const { POST: itemsPOST } = await import("@/app/api/items/route");
const { PUT: profilePUT } = await import("@/app/api/profile/route");
const { GET: imagesGET } = await import("@/app/api/images/[...key]/route");

const VICTIM_KEY = "items/alice-secret.png";

/** Alice が画像をアップロードし、自分のアイテムとして登録済みの状態を作る。 */
async function givenAliceOwnsAnImage() {
  await r2.bucket.put(VICTIM_KEY, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/png" },
  });
  await recordUpload(d1.db, ALICE, VICTIM_KEY);
  const res = await callRoute(itemsPOST, {
    user: ALICE,
    body: makeItemInput({ imageKey: VICTIM_KEY }),
  });
  expect(res.status).toBe(201);
}

describe("他人の画像キーの横取り", () => {
  it("Bob は Alice の key を自分のアイテムとして登録できない", async () => {
    await givenAliceOwnsAnImage();

    const res = await callRoute(itemsPOST, {
      user: BOB,
      body: makeItemInput({ imageKey: VICTIM_KEY }),
    });

    expect(res.status).toBe(400);
    // 登録できない以上、読み取りも当然できない
    const read = await callRoute(imagesGET, {
      user: BOB,
      params: { key: VICTIM_KEY.split("/") },
    });
    expect(read.status).toBe(404);
  });

  it("Bob は Alice の key を自分のプロフィール参考画像にできない", async () => {
    await givenAliceOwnsAnImage();

    const res = await callRoute(profilePUT, {
      user: BOB,
      body: makeProfileInput({ referenceImageKey: VICTIM_KEY }),
    });

    expect(res.status).toBe(400);
  });

  it("プロフィール経由で Alice の R2 オブジェクトを消せない", async () => {
    await givenAliceOwnsAnImage();

    // 参考画像に指定 → 別の値に差し替え、で「旧画像を消す」経路を狙う
    await callRoute(profilePUT, {
      user: BOB,
      body: makeProfileInput({ referenceImageKey: VICTIM_KEY }),
    });
    await callRoute(profilePUT, {
      user: BOB,
      body: makeProfileInput({ referenceImageKey: null }),
    });

    expect(await r2.bucket.get(VICTIM_KEY)).not.toBeNull();
  });

  it("Alice 自身は自分の画像を読める (正常系が壊れていないこと)", async () => {
    await givenAliceOwnsAnImage();

    const res = await callRoute(imagesGET, {
      user: ALICE,
      params: { key: VICTIM_KEY.split("/") },
    });

    expect(res.status).toBe(200);
  });
});
