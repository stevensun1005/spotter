import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (["./food-photo-model", "./food-photo-request", "./foods"].includes(specifier)) {
    return next(specifier + ".ts", context);
  }
  return next(specifier, context);
} });
const { fetchFoodPhotoConfiguration, recognizeMealPhoto, recognizeProteinPhoto, validatePhotoFile } = await import("../features/nutrition/food-photo-client.ts");
const imageFile = new File(["original pixels plus metadata"], "private-name.jpg", { type: "image/jpeg" });

function mockImageBrowser(t, completeLoad = true) {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  t.after(() => {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  });
  const release = t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(URL, "createObjectURL", () => "blob:meal-photo");
  globalThis.Image = class {
    naturalWidth = 2400;
    naturalHeight = 1200;
    set src(url) {
      assert.equal(url, "blob:meal-photo");
      if (completeLoad) queueMicrotask(() => this.onload?.());
    }
    removeAttribute(name) { assert.equal(name, "src"); }
  };
  const canvas = {
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toDataURL: () => "data:image/jpeg;base64,/9j/AAAAAAAAAAAA",
  };
  globalThis.document = { createElement: (tag) => { assert.equal(tag, "canvas"); return canvas; } };
  return { canvas, release };
}

test("coach attachment uses the meal endpoint with a re-encoded image and the selected owner's portions", async (t) => {
  const { canvas, release } = mockImageBrowser(t);
  const draft = { name: "牛奶和蛋白粉", grams: 280, calories: 260, protein: 33, carbs: 18, fat: 6 };
  const send = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/food-photo");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      expectedOwner: "coach-account",
      mode: "meal",
      image: { mediaType: "image/jpeg", base64: "/9j/AAAAAAAAAAAA" },
      notes: "250 毫升牛奶，一勺蛋白粉",
    });
    assert.doesNotMatch(options.body, /private-name|original pixels/);
    return Response.json({ draft });
  });
  const controller = new AbortController();
  assert.deepEqual(await recognizeMealPhoto(imageFile, " 250 毫升牛奶，一勺蛋白粉 ", "coach-account", controller.signal), { kind: "draft", draft });
  assert.deepEqual([canvas.width, canvas.height], [1600, 800]);
  assert.equal(send.mock.callCount(), 1);
  assert.equal(release.mock.callCount(), 1);
});

test("aborting an attachment during decoding releases it without an upload", async (t) => {
  const { release } = mockImageBrowser(t, false);
  const send = t.mock.method(globalThis, "fetch", async () => assert.fail("aborted attachment was uploaded"));
  const controller = new AbortController();
  const result = recognizeMealPhoto(imageFile, "", "coach-account", controller.signal);
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(release.mock.callCount(), 1);
});

test("photo capability and missing-portion replies remain bound to the requested account", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => options.method === "POST"
    ? Response.json({ needs: ["牛奶的份量"] })
    : Response.json({ enabled: true, owner: "other-account" }));
  const controller = new AbortController();
  await assert.rejects(fetchFoodPhotoConfiguration("coach-account", controller.signal), /登录账号已切换/);
  assert.equal(await fetchFoodPhotoConfiguration("other-account", controller.signal), true);

  mockImageBrowser(t);
  assert.deepEqual(await recognizeMealPhoto(imageFile, "一勺蛋白粉", "coach-account", controller.signal), {
    kind: "needs", needs: ["牛奶的份量"],
  });
  const invalid = new File(["other data"], "document.txt", { type: "text/plain" });
  assert.throws(() => validatePhotoFile(invalid), /请选择 24 MB 以内的图片/);
});

test("protein photo recognition accepts a front-only name and a later back label without sharing meal details", async (t) => {
  mockImageBrowser(t);
  let product = { name: "示例乳清" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/food-photo");
    assert.deepEqual(JSON.parse(options.body), {
      expectedOwner: "coach-account",
      mode: "protein",
      image: { mediaType: "image/jpeg", base64: "/9j/AAAAAAAAAAAA" },
    });
    return Response.json({ product });
  });
  const controller = new AbortController();
  assert.deepEqual(await recognizeProteinPhoto(imageFile, "coach-account", controller.signal), { kind: "product", product });
  product = { scoopGrams: 30 };
  assert.deepEqual(await recognizeProteinPhoto(imageFile, "coach-account", controller.signal), { kind: "product", product });
  product = {};
  await assert.rejects(recognizeProteinPhoto(imageFile, "coach-account", controller.signal), /无法读取蛋白粉包装/);
});
