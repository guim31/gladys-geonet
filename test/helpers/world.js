// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake GeoNet serving the
// answers recorded on 20/11/2026 (test/fixtures/geonet), a manual clock, a
// temporary /data, and the integration wired on top through registerHandlers.
// Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// The answers were recorded on 20/11/2026 around 22:07 UTC; the newest
// earthquake of the list is from 19:04 UTC.
export const START = Date.parse('2026-11-20T22:10:00Z');

// A house in Taupō (public coordinates of the town centre): Taupō volcano
// 19 km, Tongariro 62 km, Ruapehu 79 km, White Island 162 km. The latest
// earthquake of MMI 3 or more within 100 km: 2026p874729, M3.5, 44 km, at
// 15:36 UTC (6 h 34 min before START); 11 within 100 km in the list.
export const HOUSE = {
  id: 'house-1',
  name: 'Home',
  selector: 'home',
  latitude: -38.6857,
  longitude: 176.0702,
};

export const WHITE_ISLAND = 'whiteisland'; // level 2, Yellow
export const RUAPEHU = 'ruapehu'; // level 1, Green
export const TAUPO = 'taupo'; // level 0, Green
export const LATEST_NEAR_QUAKE = '2026p874729';

/**
 * Fake GeoNet. `api.down`: 'network' (connection refused), a status (503) or
 * false; `api.downOnly`: the one endpoint that fails ('val' or 'quake').
 */
export function createApi() {
  const api = {
    val: fixture('geonet/val-2026-11-20.json'),
    quake: fixture('geonet/quake-mmi3-2026-11-20.json'),
    down: false,
    downOnly: null,
    requests: [],

    volcano(id) {
      return api.val.features.find((f) => f.properties.volcanoID === id).properties;
    },

    /** New level and colour of a volcano. */
    setLevel(id, level, acc) {
      const p = api.volcano(id);
      p.level = level;
      p.acc = acc;
      p.activity = `Test activity at level ${level}.`;
    },

    /** A new earthquake on top of the list, `minutesAgo` before `now` (ms). */
    addQuake({ id, now, minutesAgo = 5, mmi = 4, magnitude = 4.2, latitude, longitude }) {
      api.quake.features.unshift({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: {
          publicID: id,
          time: new Date(now - minutesAgo * 60 * 1000).toISOString(),
          depth: 8,
          magnitude,
          mmi,
          locality: '10 km north of Taupō',
          quality: 'preliminary',
        },
      });
    },

    async fetch(input, init) {
      const url = new URL(input);
      api.requests.push({ url, headers: init?.headers });
      const name =
        url.pathname === '/volcano/val' ? 'val' : url.pathname === '/quake' ? 'quake' : null;
      if (api.down === 'network' && (!api.downOnly || api.downOnly === name)) {
        throw new TypeError('fetch failed');
      }
      if (api.down && (!api.downOnly || api.downOnly === name)) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      if (!name) {
        return { status: 404, text: async () => 'Not Found' };
      }
      return { status: 200, text: async () => JSON.stringify(api[name]) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = { volcanoes: [WHITE_ISLAND, TAUPO] },
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-geonet-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, { store, fetch: api.fetch, timers, now: clock.now });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The devices discovered last. */
export const discovered = (world) => world.fake.discoveredDevices;

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of discovered(world)) {
    await world.fake.deviceCreated(device);
  }
  return discovered(world);
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** The last value published on a feature (state, or text). */
export function lastValue(world, device, key) {
  const id = featureId(device, key);
  const state = world.fake.states.filter((s) => s.device_feature_external_id === id).at(-1);
  return state?.text ?? state?.state;
}

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 2) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
