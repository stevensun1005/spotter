import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const catalogue = async () => new Map(
  (await json("../public/open-gym/index.json")).rows.map((row) => [row.id, row]),
);

test("licensed workout-guide frame sets resolve under the player asset paths and retain their credit", async () => {
  const base = "../public/open-gym/workout-guide/";
  const [catalogueRows, links, attribution, license, credit] = await Promise.all([
    catalogue(),
    json("../features/exercises/workout-guide-motions.json"),
    json(base + "attribution.json"),
    read(base + "LICENSE-ASSETS.txt"),
    read(base + "CREDITS.txt"),
  ]);
  assert.equal(links["1060"], "hip-thrust");
  assert.match(license, /Attribution-ShareAlike 4\.0 International/);
  assert.match(credit, /Bryl Lim.*Everkinetic/);
  for (const [id, slug] of Object.entries(links)) {
    assert.ok(catalogueRows.has(id), id);
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.equal(attribution[slug]?.license, "CC BY-SA 4.0", slug);
    assert.deepEqual(attribution[slug]?.frames.map((frame) => frame.file), ["01.svg", "02.svg", "03.svg"], slug);
  }
  for (const slug of new Set(Object.values(links))) {
    const { frames } = attribution[slug];
    const svg = await Promise.all(frames.map(({ file }) => read(base + slug + "/" + file)));
    for (const contents of svg) {
      assert.match(contents, /^<svg[^>]+viewBox="0 0 512 512"/);
      assert.doesNotMatch(contents, /<script\b|\bon\w+=|\bhref=|url\(/i);
    }
    assert.ok(new Set(svg).size >= 2, slug);
  }
});

test("equivalent atlas motions keep the original equipment and action", async () => {
  const [catalogueRows, links] = await Promise.all([
    catalogue(),
    json("../features/exercises/flow-motion-equivalents.json"),
  ]);
  const action = (name) => name.toLowerCase()
    .replace(/\s*\((?:(?:side|front|back) pov|female|male)\)$/, "")
    .replace(/^shoulder press \(with band\)$/, "band shoulder press")
    .replace(/^side neck stretch$/, "neck side stretch")
    .replace(/\bsingle (arm|leg)\b/g, "one $1")
    .replace(/\bwith rope attachment\b/g, "with rope")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const [id, animation] of Object.entries(links)) {
    const row = catalogueRows.get(id);
    const source = catalogueRows.get(animation);
    assert.ok(row && source?.animation, id);
    assert.equal(row.equipment, source.equipment, id);
    assert.equal(row.type, source.type, id);
    assert.equal(row.target, source.target, id);
    assert.equal(action(row.en), action(source.en), id);
    const asset = await json("../public/open-gym/flow/" + animation + ".json");
    assert.ok(new Set(asset.sequence).size >= 2, id);
  }
});
