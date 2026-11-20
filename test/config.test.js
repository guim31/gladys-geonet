// -----------------------------------------------------------------------------
// Normalization of the configuration: whatever Gladys stores, the code gets
// numbers, booleans, a list of known volcano ids and a centre or null.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseCoordinate, parseVolcanoes } from '../src/config.js';

test('defaults', () => {
  assert.deepEqual(normalizeConfig({}), {
    volcanoes: [],
    national: true,
    quakeRadiusKm: 100,
    quakeMinMmi: 3,
    center: null,
    invalidCenter: false,
    refreshMinutes: 2,
    language: 'fr',
  });
  assert.deepEqual(normalizeConfig(null), normalizeConfig({}));
});

test('followed volcanoes: known ids only, in a stable order, an array or a string', () => {
  assert.deepEqual(parseVolcanoes(['ruapehu', 'WhiteIsland', 'etna', 'ruapehu']), [
    'whiteisland',
    'ruapehu',
  ]);
  assert.deepEqual(parseVolcanoes('taupo, ruapehu'), ['taupo', 'ruapehu']);
  assert.deepEqual(parseVolcanoes(undefined), []);
});

test('the New Zealand device: a boolean, or its string form', () => {
  assert.equal(normalizeConfig({ national: false }).national, false);
  assert.equal(normalizeConfig({ national: 'false' }).national, false);
  assert.equal(normalizeConfig({ national: 'true' }).national, true);
});

test('coordinates: decimal comma, bounds, both or none', () => {
  assert.equal(parseCoordinate('-41,28', 90), -41.28);
  assert.equal(parseCoordinate('174.77', 180), 174.77);
  assert.equal(parseCoordinate('91', 90), null);
  assert.equal(parseCoordinate('abc', 90), null);
  assert.deepEqual(normalizeConfig({ latitude: '-41,28', longitude: '174,77' }).center, {
    latitude: -41.28,
    longitude: 174.77,
  });
  const half = normalizeConfig({ latitude: '-41.28' });
  assert.equal(half.center, null);
  assert.equal(half.invalidCenter, true);
});

test('unknown select values fall back on the defaults', () => {
  const config = normalizeConfig({
    quake_radius: '42',
    quake_min_mmi: '9',
    refresh_interval: '3',
    language: 'it',
  });
  assert.equal(config.quakeRadiusKm, 100);
  assert.equal(config.quakeMinMmi, 3);
  assert.equal(config.refreshMinutes, 2);
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ quake_radius: '0' }).quakeRadiusKm, 0);
});
