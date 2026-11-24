
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return next(source.href, context);
    }
    return next(specifier, context);
  },
});

const { ankleFootIllustrations: illustrations } = await import("../features/exercises/ankle-foot-illustrations.ts");

test("ankle resistance opposes the working forefoot without moving the heel", () => {
  for (const [eversion, inversion] of [["3127", "3128"], ["6745", "6746"], ["8611", "8612"]]) {
    for (const id of [eversion, inversion]) {
      const [initial, end] = illustrations[id].frames;
      assert.deepEqual(end[8], initial[8], id);
      assert.deepEqual(end[7], initial[7], id);
      const [, , anchor] = illustrations[id].dynamic.at(-2);
      assert.equal(Math.sign(end[11][0] - initial[11][0]), Math.sign(initial[11][0] - anchor), id);
    }
  }
  for (const id of ["10003", "10366"]) {
    const [initial, end] = illustrations[id].frames;
    assert.deepEqual(end[8], initial[8], id);
    assert.ok(end[11][1] < initial[11][1], id);
    assert.ok(illustrations[id].dynamic.at(-1)[3] >= initial[11][1], id);
  }
});

test("calf and ankle stretches preserve the designated toe or heel contact", () => {
  for (const id of ["1886", "3872"]) {
    const [initial, stretch] = illustrations[id].frames;
    assert.deepEqual(stretch[11], initial[11], id);
    assert.ok(stretch[8][1] > 140, id);
  }
  for (const id of ["1887", "2104", "1969", "2936"]) {
    const [initial, stretch] = illustrations[id].frames;
    assert.deepEqual(stretch[8], initial[8], id);
    assert.deepEqual(stretch[10], initial[10], id);
  }
});

test("foot resistance equipment and crossed-toe directions are distinct", () => {
  assert.ok(illustrations["10367"].dynamic.some(([type]) => type === "kettlebell"));
  assert.ok(illustrations["6559"].dynamic.some(([type]) => type === "plate"));
  for (const id of ["1962", "1963", "1964"]) assert.ok(illustrations[id].frames[1][13][1] > illustrations[id].frames[0][13][1], id);
  for (const id of ["1965", "1966", "1967"]) assert.ok(illustrations[id].frames[1][13][1] < illustrations[id].frames[0][13][1], id);
});