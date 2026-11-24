import assert from "node:assert/strict";
import { test } from "node:test";
import {
  proteinDrinkIntent,
  proteinDrinkSelection,
  resolveProteinProduct,
} from "../features/ai-coach/protein-dialogue.ts";

const products = [
  { id: "strawberry", name: "ALLMAX ISOFLEX 草莓味乳清蛋白粉" },
  { id: "chocolate", name: "ALLMAX ISOFLEX 巧克力味乳清蛋白粉" },
];

test("understands plain completed drinks and explicit logging requests", () => {
  for (const message of ["喝了蛋白粉", "我喝了蛋白粉。", "我刚喝了一杯蛋白粉！", "帮我记一杯蛋白粉", "我已经喝完了一杯乳清蛋白粉", "喝了蛋白粉，帮我记一下", "我喝了这杯蛋白粉"]) {
    assert.deepEqual(proteinDrinkIntent(message), { kind: "drink", servings: 1, repeat: false }, message);
  }
  assert.deepEqual(resolveProteinProduct(products.slice(0, 1)), { kind: "selected", id: "strawberry" });
  assert.deepEqual(resolveProteinProduct(products), { kind: "ambiguous" });
  assert.deepEqual(resolveProteinProduct([]), { kind: "unmatched" });
});

test("honors explicit names and requires a selection for ambiguous names", () => {
  const named = proteinDrinkIntent("我喝了 ALLMAX ISOFLEX 草莓味的蛋白粉");
  assert.equal(named.kind, "drink");
  assert.deepEqual(resolveProteinProduct(products, named.selector), { kind: "selected", id: "strawberry" });
  assert.deepEqual(resolveProteinProduct(products, proteinDrinkIntent("我喝了蛋白粉（巧克力味）").selector), { kind: "selected", id: "chocolate" });
  assert.deepEqual(resolveProteinProduct(products, "ALLMAX"), { kind: "ambiguous" });
  assert.deepEqual(resolveProteinProduct(products.slice(0, 1), "ON 香草味"), { kind: "unmatched" });
});

test("allows a selection by label or number, without swallowing the next chat task", () => {
  assert.deepEqual(proteinDrinkSelection("第二款", products), { kind: "selected", id: "chocolate" });
  assert.deepEqual(proteinDrinkSelection("1号", products), { kind: "selected", id: "strawberry" });
  assert.deepEqual(proteinDrinkSelection("我喝的是草莓味", products), { kind: "selected", id: "strawberry" });
  assert.deepEqual(proteinDrinkSelection("我喝的是草莓味蛋白粉", products), { kind: "selected", id: "strawberry" });
  assert.deepEqual(proteinDrinkSelection("选 ALLMAX", products), { kind: "ambiguous" });
  assert.deepEqual(proteinDrinkSelection("我喝的是 ON 香草味", products), { kind: "unmatched" });
  assert.deepEqual(proteinDrinkSelection("第三款", products), { kind: "unmatched" });
  assert.deepEqual(proteinDrinkSelection("算了", products), { kind: "cancel" });
  for (const message of ["我要看今天训练统计", "我喝了两杯蛋白粉", "草莓味怎么样", "帮我记录晚饭"]) {
    assert.equal(proteinDrinkSelection(message, products), undefined, message);
  }
});

test("understands dates, counts and an explicitly separate cup", () => {
  assert.deepEqual(proteinDrinkIntent("昨天我喝了两杯蛋白粉"), { kind: "drink", servings: 2, repeat: false, dayOffset: -1 });
  assert.deepEqual(proteinDrinkIntent("我 2026-11-8 喝了半杯蛋白粉"), { kind: "drink", servings: 0.5, repeat: false, date: "2026-11-08" });
  assert.deepEqual(proteinDrinkIntent("我刚才又喝了一杯蛋白粉"), { kind: "drink", servings: 1, repeat: true });
  assert.deepEqual(proteinDrinkIntent("喝了第二杯蛋白粉"), { kind: "drink", servings: 1, repeat: true });
  assert.equal(proteinDrinkIntent("2026-02-31 喝了蛋白粉").kind, "clarify");
  assert.equal(proteinDrinkIntent("上周喝了蛋白粉").kind, "clarify");
  assert.equal(proteinDrinkIntent("昨天今天喝了蛋白粉").kind, "clarify");
});

test("honors measurable recipe changes and asks instead of guessing ambiguous changes", () => {
  assert.deepEqual(proteinDrinkIntent("今天喝了蛋白粉，粉量 25 克，用 300 毫升 2% 牛奶冲的"), {
    kind: "drink", dayOffset: 0, servings: 1, repeat: false, powderGrams: 25, mixerName: "2% 牛奶", mixerMl: 300,
  });
  assert.deepEqual(proteinDrinkIntent("喝了蛋白粉用水冲的"), { kind: "drink", servings: 1, repeat: false, mixerName: "水" });
  assert.deepEqual(proteinDrinkIntent("喝了250ml牛奶加蛋白粉").kind, "clarify");
  for (const message of ["喝了蛋白粉，用2勺", "喝了蛋白粉，用了一些牛奶冲的", "喝了蛋白粉，用 300ml 牛奶，用水"]) {
    assert.equal(proteinDrinkIntent(message).kind, "clarify", message);
  }
});

test("does not interpret questions, future intent, negations or other people's drinks as writes", () => {
  for (const message of [
    "怎么喝蛋白粉", "蛋白粉要喝吗？", "我喝了蛋白粉吗?", "我喝了多少蛋白粉", "我没喝蛋白粉", "我喝了蛋白粉，别记",
    "我喝了蛋白粉，已经记了", "我打算喝蛋白粉", "我会喝蛋白粉", "她喝了蛋白粉", "如果我喝了蛋白粉",
    "我需要记蛋白粉怎么弄", "帮我看蛋白粉仓库", "把蛋白粉加到仓库", "喝了蛋白粉以后怎么安排训练",
  ]) {
    assert.equal(proteinDrinkIntent(message), undefined, message);
  }
});
