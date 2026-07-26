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
import { createItem, listItems } from "@/app/_lib/db";
import { isUploadedBy, recordUpload } from "@/app/_lib/uploads";

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
const { DELETE: itemsDELETE } = await import("@/app/api/items/[id]/route");

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

  it("旧バグ由来の不正な行が残っていても、削除で他人の画像を消せない", async () => {
    // 書き込み側のゲートは新しい claim を防ぐが、修正前に作られた行までは
    // 消してくれない。そういう行が残っていても実体を消せないことを確認する。
    await r2.bucket.put(VICTIM_KEY, new Uint8Array([1, 2, 3]));
    await recordUpload(d1.db, ALICE, VICTIM_KEY);
    // ルートを通さず、DB に直接「Bob が Alice の key を指す行」を作る
    await createItem(d1.db, BOB, makeItemInput({ imageKey: VICTIM_KEY }));
    const bobItem = (await listItems(d1.db, BOB))[0];

    const res = await callRoute(itemsDELETE, {
      user: BOB,
      params: { id: bobItem.id },
    });

    expect(res.status).toBe(204); // Bob 自身の行は消えてよい
    expect(await r2.bucket.get(VICTIM_KEY)).not.toBeNull(); // 実体は無事
    expect(await isUploadedBy(d1.db, ALICE, VICTIM_KEY)).toBe(true);
  });

  it("同じ key を共有する 2 アイテムは、片方を消しても残る方の画像が生きている", async () => {
    await r2.bucket.put(VICTIM_KEY, new Uint8Array([1, 2, 3]));
    await recordUpload(d1.db, ALICE, VICTIM_KEY);
    await callRoute(itemsPOST, {
      user: ALICE,
      body: makeItemInput({ imageKey: VICTIM_KEY }),
    });
    await callRoute(itemsPOST, {
      user: ALICE,
      body: makeItemInput({ imageKey: VICTIM_KEY }),
    });
    const [first] = await listItems(d1.db, ALICE);

    await callRoute(itemsDELETE, { user: ALICE, params: { id: first.id } });

    expect(await r2.bucket.get(VICTIM_KEY)).not.toBeNull();
    const read = await callRoute(imagesGET, {
      user: ALICE,
      params: { key: VICTIM_KEY.split("/") },
    });
    expect(read.status).toBe(200);
  });

  it("最後の参照を消したときは実体も所有レコードも片付く", async () => {
    await r2.bucket.put(VICTIM_KEY, new Uint8Array([1, 2, 3]));
    await recordUpload(d1.db, ALICE, VICTIM_KEY);
    const created = await callRoute(itemsPOST, {
      user: ALICE,
      body: makeItemInput({ imageKey: VICTIM_KEY }),
    });
    const { item } = (await created.json()) as { item: { id: string } };

    await callRoute(itemsDELETE, { user: ALICE, params: { id: item.id } });

    expect(await r2.bucket.get(VICTIM_KEY)).toBeNull();
    expect(await isUploadedBy(d1.db, ALICE, VICTIM_KEY)).toBe(false);
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
