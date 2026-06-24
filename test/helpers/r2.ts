// R2 を使うテストの共通セットアップ。
import { Miniflare } from "miniflare";

export type TestR2 = {
  bucket: R2Bucket;
  /** バケット内の全オブジェクトを消す (テスト間分離)。 */
  reset: () => Promise<void>;
  dispose: () => Promise<void>;
};

export async function createTestR2(): Promise<TestR2> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    r2Buckets: { IMAGES: "test-images" },
  });
  const bucket = (await mf.getR2Bucket("IMAGES")) as unknown as R2Bucket;
  return {
    bucket,
    reset: async () => {
      const list = await bucket.list();
      for (const obj of list.objects) {
        await bucket.delete(obj.key);
      }
    },
    dispose: () => mf.dispose(),
  };
}
