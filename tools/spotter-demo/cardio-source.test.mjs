import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { cardioCatalogueIds, cardioCatalogueRecipe } from '../../skills/spotter-exercise-demo/lib/cardio-motion.js';

const sample = (id, phase) => prepareRecipe(cardioCatalogueRecipe(id)).sample(phase);
const length = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

test('original cardio recipes provide unique, bounded v1 movements', () => {
  assert(cardioCatalogueIds.includes('0684'));
  assert.equal(new Set(cardioCatalogueIds).size, cardioCatalogueIds.length);
  assert.equal(cardioCatalogueRecipe('unreviewed'), undefined);
  assert.equal(cardioCatalogueRecipe('constructor'), undefined);
  for (const id of cardioCatalogueIds) {
    const raw = cardioCatalogueRecipe(id);
    const recipe = prepareRecipe(raw);
    assert(raw.keyframes.length <= 65);
    const marks = [.04, .14, .29, .43, .64].map(phase => {
      const p = recipe.sample(phase);
      return JSON.stringify([p.hips, p.lw, p.rw, p.la, p.ra]);
    });
    assert(new Set(marks).size >= 3, id);
  }
});

test('public cardio variants preserve intended gear and mechanical differences', () => {
  assert(sample('0798', .10).hips[1] > sample('2138', .10).hips[1] + .075, 'off-saddle lead');
  assert(prepareRecipe(cardioCatalogueRecipe('5099')).options.singleCarry);
  assert(prepareRecipe(cardioCatalogueRecipe('2918')).options.suitcaseBar);
  assert(prepareRecipe(cardioCatalogueRecipe('5496')).options.heelPlates);
  assert.equal(sample('3636', .07).lw[2], .536);
  assert.equal(sample('7455', .025).planted.l, 0);
  assert.equal(sample('7455', .025).planted.r, undefined);
  assert.equal(sample('11782', .018).planted.l, 0);
  assert.equal(sample('11782', .018).planted.r, 0);
  assert(sample('11782', .09).la[1] > .151 && sample('11782', .09).ra[1] > .151);
  const low = Array.from({ length: 56 }, (_, i) => sample('2993', .24 + i * .01));
  assert(Math.min(...low.map(p => length(p.le, p.lk))) < .10, 'left elbow approaches knee');
  assert(Math.min(...low.map(p => length(p.re, p.rk))) < .10, 'right elbow approaches knee');
  assert(Math.max(...low.map(p => p.hips[0])) - Math.min(...low.map(p => p.hips[0])) > .095, 'wide stance rocks in the low position');
});

test('passing, slamming and double-unders preserve physical motion events', () => {
  let wall = -Infinity, floor = Infinity;
  for (const frame of cardioCatalogueRecipe('1302').keyframes) wall = Math.max(wall, frame.ballCenter[2]);
  for (const frame of cardioCatalogueRecipe('1354').keyframes) floor = Math.min(floor, frame.ballCenter[1]);
  assert(Math.abs(wall - 1.254) < 1e-6);
  assert(Math.abs(floor - .111) < 1e-6);
  const doubleUnder = prepareRecipe(cardioCatalogueRecipe('3885'));
  for (const pass of [.55, 1.55]) {
    const points = Array.from({ length: 251 }, (_, step) => doubleUnder.sample(step / 1000));
    const atPass = points.reduce((a, b) => Math.abs(a.machineTravel - pass) < Math.abs(b.machineTravel - pass) ? a : b);
    assert(Math.abs(atPass.machineTravel - pass) < .013);
    assert(atPass.la[1] > .17 && atPass.ra[1] > .17);
  }
});
