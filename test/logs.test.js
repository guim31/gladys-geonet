// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a level change, a felt earthquake, GeoNet lost and back, a user action),
// never one line per refresh cycle; a failure that repeats at every cycle is
// logged once, plus one line when it is over. Never the coordinates of the
// centre: the location of the home is the sensitive data here.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE,
  WHITE_ISLAND,
  captureLogs,
  createAll,
  createApi,
  createWorld,
  cycle,
} from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, config = { volcanoes: [WHITE_ISLAND] }, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), ['[INFO] [geonet] Started: GeoNet read every 2 min']);
});

test('normal refresh cycles write nothing at info', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines, []);
});

test('a level change and a felt earthquake are one info line each', async (t) => {
  const api = createApi();
  const w = await world(t, undefined, { api });
  const lines = captureLogs(t, 'info');
  api.setLevel(WHITE_ISLAND, 3, 'Orange');
  api.addQuake({ id: '2026p999001', now: w.clock.now(), latitude: -38.6, longitude: 176.1 });
  await cycle(w);
  await cycle(w);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [geonet] White Island: level 2 / yellow → 3 / orange',
    '[INFO] [geonet] Felt earthquake: M4.2, MMI 4, 10 km away',
  ]);
});

test('LOG_LEVEL=debug shows the cycles, never the coordinates of the centre', async (t) => {
  const lines = captureLogs(t, 'debug');
  const w = await world(t);
  await cycle(w);
  const configured = await world(t, { latitude: '-41.2865', longitude: '174.7762' });
  await cycle(configured);
  assert.ok(
    lines.some((line) =>
      /Refresh cycle: 12 volcano\(es\), 1 followed, 11 earthquake\(s\) in the radius/.test(
        line.text,
      ),
    ),
  );
  const all = lines.map((line) => line.text).join('\n');
  for (const value of [HOUSE.latitude, HOUSE.longitude, -41.2865, 174.7762]) {
    assert.doesNotMatch(all, new RegExp(String(value).replace('.', '\\.')));
  }
});

test('GeoNet down at every cycle: one warning, then one line at recovery', async (t) => {
  const api = createApi();
  const w = await world(t, undefined, { api });
  const lines = captureLogs(t, 'info');
  api.down = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [
      ['warn', '[geonet] GeoNet unreachable (volcanoes): api.geonet.org.nz: HTTP 503'],
      ['warn', '[geonet] GeoNet unreachable (earthquakes): api.geonet.org.nz: HTTP 503'],
    ],
  );
  api.down = false;
  await cycle(w);
  assert.deepEqual(lines.slice(2).map(strip), [
    '[INFO] [geonet] GeoNet answers again (volcanoes)',
    '[INFO] [geonet] GeoNet answers again (earthquakes)',
  ]);
});

test('states refused at every cycle: one warning, then one line at recovery', async (t) => {
  const api = createApi();
  const w = await world(t, undefined, { api });
  await createAll(w);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(w.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.ok(publish.mock.callCount() >= 3);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[geonet] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await cycle(w);
  assert.match(lines.at(-1).text, /\[INFO\].*Publishing the states works again/);
});

test('invalid coordinates are said once, at the start', async (t) => {
  const lines = captureLogs(t, 'info');
  const w = await world(t, { latitude: 'abc', longitude: '2' });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines.map(strip), [
    '[WARN] [geonet] The coordinates of the configuration are not valid: the house is used',
    '[INFO] [geonet] Started: GeoNet read every 2 min',
  ]);
});
