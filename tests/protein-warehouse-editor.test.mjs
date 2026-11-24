import assert from "node:assert/strict";
import test from "node:test";

const { mergeProteinPhotoIntoEditor } = await import("../features/settings/protein-warehouse-editor.ts");
const blank = { id: "new", name: "", editing: false, scoopGrams: "", cupMl: "" };
const whey = {
  id: "original", name: "Allmax ISO-Flex Strawberry",
  scoopGrams: 30, cupMl: 600, scoopEstimated: true, powderEstimated: true,
  powder: { calories: 380, protein: 75, carbs: 6, fat: 3 },
  mixer: { name: "2% 牛奶", per100ml: { calories: 52, protein: 3.4, carbs: 4.9, fat: 2 } },
};

test("a readable front label reaches the warehouse editor without requiring nutrition", () => {
  const editor = mergeProteinPhotoIntoEditor(blank, { name: "Example Whey Strawberry" }, []);
  assert.equal(editor.name, "Example Whey Strawberry");
  assert.equal(editor.powder, undefined);
  assert.equal(editor.scoopGrams, "");
  assert.equal(editor.cupMl, "");
});

test("recognized spelling and punctuation variations keep the original warehouse recipe", () => {
  const editor = mergeProteinPhotoIntoEditor(blank, { name: "ALLMAX ISOFLEX Strawberry" }, [whey]);
  assert.equal(editor.editing, true);
  assert.equal(editor.id, whey.id);
  assert.equal(editor.name, whey.name);
  assert.equal(editor.cupMl, "600");
  assert.equal(editor.mixer.name, "2% 牛奶");
  assert.equal(editor.powderEstimated, true);
  assert.equal(editor.scoopEstimated, true);
  assert.equal(mergeProteinPhotoIntoEditor(blank, { name: "Allmax ISO-Flex Chocolate" }, [whey]).id, blank.id);
});

test("a later back label can fill exact scoop weight and nutrition without changing the recipe", () => {
  const editor = mergeProteinPhotoIntoEditor(blank, { name: whey.name }, [whey]);
  const read = mergeProteinPhotoIntoEditor(editor, { scoopGrams: 31, per100g: { calories: 370, protein: 90, carbs: 2, fat: 1 } }, [whey]);
  assert.equal(read.id, whey.id);
  assert.equal(read.scoopGrams, "31");
  assert.equal(read.powder.protein, "90");
  assert.equal(read.powderEstimated, undefined);
  assert.equal(read.scoopEstimated, undefined);
  assert.equal(read.cupMl, "600");
  assert.equal(read.mixer.name, "2% 牛奶");
});
