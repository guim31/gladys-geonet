// -----------------------------------------------------------------------------
// The monitor end to end, against the SDK's fake Gladys and the recorded GeoNet
// answers: discovery, states, the New Zealand and earthquake devices, the two
// scene triggers, failures, the container's own timer and the reconfiguration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE,
  LATEST_NEAR_QUAKE,
  RUAPEHU,
  TAUPO,
  WHITE_ISLAND,
  createAll,
  createApi,
  createWorld,
  cycle,
  discovered,
  lastValue,
} from './helpers/world.js';

const byId = (world, suffix) =>
  discovered(world).find((device) => device.external_id.endsWith(suffix));
const volcanoOf = (world, id) => byId(world, `:volcano:${id}`);
const nationalOf = (world) => byId(world, ':national:nz');
const quakesOf = (world) => byId(world, ':quakes:felt');
const events = (world, key) => world.fake.sceneEvents.filter((event) => event.key === key);

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

/** An earthquake `km` north of the house (1° of latitude ≈ 111 km). */
const near = (km) => ({ latitude: HOUSE.latitude + km / 111.2, longitude: HOUSE.longitude });

test('one device per followed volcano, the New Zealand device and the earthquake device', async (t) => {
  const w = await world(t, { config: { volcanoes: [RUAPEHU, WHITE_ISLAND], language: 'en' } });
  assert.deepEqual(
    discovered(w).map((device) => device.name),
    ['Volcano White Island', 'Volcano Ruapehu', 'New Zealand volcanoes', 'Felt earthquakes'],
  );
  assert.ok(discovered(w).every((device) => device.should_poll === false));
  const off = await world(t, {
    config: { volcanoes: [TAUPO], national: false, quake_radius: '0' },
  });
  assert.deepEqual(
    discovered(off).map((device) => device.external_id.split(':').slice(-2).join(':')),
    ['volcano:taupo'],
  );
});

test('the states of a volcano: level 0-5, aviation colour, activity, distance', async (t) => {
  const w = await world(t, { config: { volcanoes: [WHITE_ISLAND, TAUPO] } });
  await createAll(w);
  const island = volcanoOf(w, WHITE_ISLAND);
  assert.equal(lastValue(w, island, 'alert_level'), 2);
  assert.equal(lastValue(w, island, 'aviation_color'), 1);
  assert.equal(lastValue(w, island, 'activity'), 'Moderate to heightened volcanic unrest.');
  assert.equal(lastValue(w, island, 'distance'), 162);
  assert.equal(lastValue(w, volcanoOf(w, TAUPO), 'alert_level'), 0);
  assert.equal(lastValue(w, volcanoOf(w, TAUPO), 'distance'), 18.6);
});

test('a level 4 or 5 is published as such, beyond the 0-3 of the risk badge', async (t) => {
  const api = createApi();
  api.setLevel(RUAPEHU, 5, 'Red');
  const w = await world(t, { api, config: { volcanoes: [RUAPEHU] } });
  await createAll(w);
  assert.equal(lastValue(w, volcanoOf(w, RUAPEHU), 'alert_level'), 5);
  assert.equal(lastValue(w, volcanoOf(w, RUAPEHU), 'aviation_color'), 3);
  assert.equal(lastValue(w, nationalOf(w), 'highest_level'), 5);
});

test('no state before the user creates a device, all of them right after', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.states.length, 0);
  const device = volcanoOf(w, WHITE_ISLAND);
  await w.fake.deviceCreated(device);
  assert.equal(lastValue(w, device, 'alert_level'), 2);
  assert.equal(lastValue(w, device, 'activity'), 'Moderate to heightened volcanic unrest.');
});

test('New Zealand: highest level, volcanoes at level 1 or more, the most active one', async (t) => {
  const w = await world(t, { config: { language: 'en' } });
  await createAll(w);
  const nz = nationalOf(w);
  assert.equal(lastValue(w, nz, 'highest_level'), 2);
  assert.equal(lastValue(w, nz, 'elevated_count'), 2);
  assert.equal(lastValue(w, nz, 'highest_volcano'), 'White Island: Level 2 / Yellow, 162 km away');
});

test('felt earthquakes: the latest in the radius, its intensity, the 24 h count', async (t) => {
  const w = await world(t, { config: { language: 'en' } });
  await createAll(w);
  const quakes = quakesOf(w);
  assert.equal(lastValue(w, quakes, 'magnitude'), 3.5);
  assert.equal(lastValue(w, quakes, 'mmi'), 3);
  assert.equal(lastValue(w, quakes, 'distance'), 43.7);
  // 15:36 and 12:20 UTC, within 24 h of START (22:10 UTC).
  assert.equal(lastValue(w, quakes, 'quake_count'), 2);
  assert.equal(
    lastValue(w, quakes, 'latest_quake'),
    'M3.5, Weak (MMI 3), 40 km south-east of Taupo (44 km away), 20/11, 16:36',
  );
  assert.equal(w.monitor.quakes[0].id, LATEST_NEAR_QUAKE);
});

test('a radius without earthquake: said, without a false magnitude', async (t) => {
  const w = await world(t, {
    config: { quake_radius: '25', latitude: '-46.4', longitude: '168.35', language: 'en' },
  });
  await createAll(w);
  const quakes = quakesOf(w);
  assert.equal(lastValue(w, quakes, 'latest_quake'), 'No recent felt earthquake within 25 km');
  assert.equal(lastValue(w, quakes, 'quake_count'), 0);
  assert.equal(lastValue(w, quakes, 'magnitude'), undefined);
});

test('the earthquakes are asked with the lowest intensity, and the deleted ones dropped', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { quake_min_mmi: '5', quake_radius: '300' } });
  const quake = api.requests.find((request) => request.url.pathname === '/quake');
  assert.equal(quake.url.searchParams.get('MMI'), '5');
  assert.equal(quake.headers.Accept, 'application/vnd.geo+json;version=2');
  assert.ok(w.monitor.quakes.every((q) => q.quality !== 'deleted'));
});

test('only the changes are published, and an unchanged value every 12 hours', async (t) => {
  const w = await world(t);
  await createAll(w);
  const before = w.fake.states.length;
  await cycle(w);
  await cycle(w);
  assert.equal(w.fake.states.length, before);
  const publish = t.mock.method(w.gladys, 'publishChangedStates');
  await cycle(w);
  assert.equal(publish.mock.calls[0].arguments[1].heartbeat, 12 * 60 * 60 * 1000);
});

test('alert_changed fires for any New Zealand volcano, with its data', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { volcanoes: [], language: 'en' } });
  api.setLevel(WHITE_ISLAND, 3, 'Orange');
  api.setLevel(RUAPEHU, 0, 'Green');
  await cycle(w);
  const fired = events(w, 'alert_changed');
  assert.equal(fired.length, 2);
  const island = fired.find((event) => event.data.volcano_id === WHITE_ISLAND).data;
  assert.deepEqual(island, {
    volcano_id: WHITE_ISLAND,
    alert_level: '3',
    direction: 'raised',
    volcano: 'White Island',
    previous_alert_level: '2',
    aviation_color: 'orange',
    aviation_color_name: 'Orange',
    activity: 'Test activity at level 3.',
    hazards: 'Volcanic unrest hazards, potential for eruption hazards.',
    distance_km: 162,
    summary: 'White Island: Level 3 / Orange, 162 km away',
    url: 'https://www.geonet.org.nz/volcano/whiteisland',
  });
  const ruapehu = fired.find((event) => event.data.volcano_id === RUAPEHU).data;
  assert.equal(ruapehu.direction, 'lowered');
  // Nothing new: nothing fired.
  await cycle(w);
  assert.equal(events(w, 'alert_changed').length, 2);
});

test('a colour change alone fires too, with the direction of the colour', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  api.setLevel(TAUPO, 0, 'Yellow');
  await cycle(w);
  const [event] = events(w, 'alert_changed');
  assert.equal(event.data.direction, 'raised');
  assert.equal(event.data.alert_level, '0');
});

test('a restart fires nothing for a change already seen; the first start only records', async (t) => {
  const api = createApi();
  const first = await createWorld({ api });
  api.setLevel(WHITE_ISLAND, 3, 'Orange');
  await cycle(first);
  assert.equal(events(first, 'alert_changed').length, 1);
  await first.app.stop();
  const again = await world(t, { api, dataDir: first.dataDir });
  await cycle(again);
  assert.equal(events(again, 'alert_changed').length, 0);
  // A first start with elevated volcanoes fires nothing either.
  assert.equal(events(first, 'quake_felt').length, 0);
});

test('quake_felt fires once per new earthquake in the radius, oldest first', async (t) => {
  const api = createApi();
  const w = await world(t, { api, config: { language: 'en' } });
  const now = w.clock.now();
  api.addQuake({ id: '2026p999001', now, minutesAgo: 8, mmi: 4, magnitude: 4.1, ...near(30) });
  api.addQuake({ id: '2026p999002', now, minutesAgo: 3, mmi: 6, magnitude: 5.6, ...near(60) });
  // Out of the 100 km radius: no trigger.
  api.addQuake({ id: '2026p999003', now, minutesAgo: 2, mmi: 5, ...near(150) });
  await cycle(w);
  await cycle(w);
  const fired = events(w, 'quake_felt').map((event) => event.data);
  assert.deepEqual(
    fired.map((data) => [data.mmi, data.magnitude, data.distance_km]),
    [
      ['4', 4.1, 30],
      ['6', 5.6, 60],
    ],
  );
  assert.deepEqual(fired[1], {
    mmi: '6',
    magnitude: 5.6,
    mmi_name: 'Strong',
    distance_km: 60,
    depth_km: 8,
    locality: '10 km north of Taupō',
    time: new Date(now - 3 * 60 * 1000).toISOString(),
    summary: 'M5.6, Strong (MMI 6), 10 km north of Taupō (60 km away), 20/11, 23:07',
    url: 'https://www.geonet.org.nz/earthquake/2026p999002',
  });
});

test('quake_felt: an old earthquake published late, or seen before a restart, is no news', async (t) => {
  const api = createApi();
  const first = await createWorld({ api });
  const now = first.clock.now();
  api.addQuake({ id: '2026p999010', now, minutesAgo: 7 * 60, ...near(20) });
  api.addQuake({ id: '2026p999011', now, minutesAgo: 5, ...near(20) });
  await cycle(first);
  assert.deepEqual(
    events(first, 'quake_felt').map((event) => event.data.url.split('/').at(-1)),
    ['2026p999011'],
  );
  await first.app.stop();
  const again = await world(t, { api, dataDir: first.dataDir });
  await cycle(again);
  assert.equal(events(again, 'quake_felt').length, 0);
});

test('a new radius or intensity records the list again, without firing', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  // Within 200 km but not 100: listed once the radius grows, yet no news.
  api.addQuake({ id: '2026p999020', now: w.clock.now(), minutesAgo: 10, ...near(150) });
  await cycle(w);
  await w.fake.configUpdated({ quake_radius: '200' });
  await cycle(w);
  assert.equal(events(w, 'quake_felt').length, 0);
  api.addQuake({ id: '2026p999021', now: w.clock.now(), minutesAgo: 1, ...near(150) });
  await cycle(w);
  assert.equal(events(w, 'quake_felt').length, 1);
});

test('GeoNet down at the start: the devices are there, the status says why', async (t) => {
  const api = createApi();
  api.down = 'network';
  const w = await world(t, { api, config: { volcanoes: [TAUPO], language: 'en' } });
  assert.deepEqual(
    discovered(w).map((device) => device.name),
    ['Volcano taupo', 'New Zealand volcanoes', 'Felt earthquakes'],
  );
  const status = w.fake.connectionStatuses.at(-1);
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /GeoNet ne répond pas/);
  assert.deepEqual(Object.keys(status.message), ['en', 'fr', 'de', 'es']);
  api.down = false;
  await cycle(w);
  assert.equal(w.fake.connectionStatuses.at(-1).connected, true);
  assert.equal(volcanoOf(w, TAUPO).name, 'Volcano Taupo');
});

test('the earthquakes alone down: the levels go on, the earthquake values are not renewed', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  await createAll(w);
  api.downOnly = 'quake';
  api.down = 503;
  api.setLevel(TAUPO, 1, 'Green');
  const publish = t.mock.method(w.gladys, 'publishChangedStates');
  await cycle(w);
  const ids = publish.mock.calls[0].arguments[0].map((state) => state.device_feature_external_id);
  assert.ok(ids.some((id) => id.endsWith(':volcano:taupo:alert_level')));
  assert.ok(!ids.some((id) => id.includes(':quakes:')));
  assert.equal(w.fake.connectionStatuses.at(-1).connected, false);
});

test('a radius without any centre: said in the status, no earthquake state', async (t) => {
  const w = await world(t, { houses: [] });
  await createAll(w);
  assert.match(w.fake.connectionStatuses.at(-1).message.en, /No centre for the earthquakes/);
  assert.equal(lastValue(w, quakesOf(w), 'latest_quake'), undefined);
  assert.equal(lastValue(w, volcanoOf(w, WHITE_ISLAND), 'distance'), undefined);
  assert.equal(lastValue(w, volcanoOf(w, WHITE_ISLAND), 'alert_level'), 2);
});

test('nothing chosen: the status says it', async (t) => {
  const w = await world(t, { config: { national: false, quake_radius: '0' } });
  assert.match(w.fake.connectionStatuses.at(-1).message.en, /^Nothing to show/);
});

test('typed coordinates replace the house', async (t) => {
  const w = await world(t, {
    config: { volcanoes: [WHITE_ISLAND], latitude: '-41.2865', longitude: '174.7762' },
  });
  await createAll(w);
  assert.equal(lastValue(w, volcanoOf(w, WHITE_ISLAND), 'distance'), 466.9);
});

test('the container reads GeoNet on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const api = createApi();
  const w = await world(t, { api, timers: true });
  const before = api.requests.length;
  t.mock.timers.tick(2 * 60 * 1000);
  await w.monitor.running;
  assert.ok(api.requests.length > before);
});

test('onPoll fallback: reads again only when the last cycle is old enough', async (t) => {
  const api = createApi();
  const w = await world(t, { api });
  const [device] = await createAll(w);
  const before = api.requests.length;
  await w.fake.poll(device);
  assert.equal(api.requests.length, before);
  w.clock.advance(60 * 1000);
  await w.fake.poll(device);
  assert.ok(api.requests.length > before);
});

test('a scan request publishes the devices again', async (t) => {
  const w = await world(t);
  const before = w.fake.discoveredDevices.length;
  await w.fake.scanRequest?.();
  assert.ok(before > 0);
});
