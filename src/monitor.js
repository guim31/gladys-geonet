// -----------------------------------------------------------------------------
// The monitor: reads GeoNet every `refresh_interval` minutes (volcanic alert
// levels, and the felt earthquakes when a radius is set), publishes the
// devices and their states, fires the scene triggers and serves the widget and
// the actions.
//
// Triggers:
//   - `alert_changed` when the alert level or the aviation colour code of any
//     rated volcano changes (the scene filters the volcanoes). The levels are
//     kept under /data, so a restart fires nothing; the very first start only
//     records them;
//   - `quake_felt` for each new earthquake of the list (intensity at least the
//     configured MMI) within the radius of the centre, less than six hours
//     old. The ids already seen are kept under /data; a new radius, intensity
//     or centre only records the list again, without firing.
//
// The centre is the configured coordinates, or the first located house of
// Gladys; it is never logged. States: `publishChangedStates` sends only what
// changed, plus a heartbeat every 12 hours.
// -----------------------------------------------------------------------------

import { createHmac, randomBytes } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { colorRank } from './config.js';
import {
  buildNationalDevice,
  buildQuakeDevice,
  buildVolcanoDevice,
  nationalIds,
  quakeIds,
  volcanoIds,
} from './device.js';
import { distanceKm } from './geo.js';
import { fetchQuakes, fetchVolcanoes, volcanoPage } from './geonet.js';
import {
  COLOR_NAMES,
  PHRASES,
  STATUS,
  clip,
  describe,
  join,
  mmiName,
  quakeText,
  render,
  sentence,
} from './messages.js';

const logger = createLogger({ name: 'geonet' });

export const WIDGET_KEY = 'geonet';
export const ALERT_TRIGGER = 'alert_changed';
export const QUAKE_TRIGGER = 'quake_felt';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
  // The houses of Gladys are read again this often (no update event).
  housesMaxAgeMs: HOUR,
  // An earthquake older than this is news no more: no trigger.
  quakeFreshMs: 6 * HOUR,
  // Window of the "felt earthquakes (24 h)" counter.
  quakeCountMs: 24 * HOUR,
};

// Earthquake ids kept under /data: the list GeoNet returns holds 100.
const SEEN_QUAKES = 300;

/** Highest alert level first, then colour, then nearest, then name. */
export const byActivity = (a, b) =>
  (b.level ?? -1) - (a.level ?? -1) ||
  colorRank(b.color) - colorRank(a.color) ||
  (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
  a.name.localeCompare(b.name);

export const isElevated = (volcano) => volcano.level > 0 || colorRank(volcano.color) > 0;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // Every rated volcano of the last successful cycle, with its distance.
    this.volcanoes = [];
    this.followed = [];
    // The earthquakes within the radius, newest first; null when not read.
    this.quakes = null;
    this.centerUsed = null;
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.house = undefined;
    this.houseReadAt = -Infinity;
    this.statusMessage = undefined;
    this.discoveredSignature = null;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.widgetSignature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  /** GeoNet answered the last cycle, for what it was asked. */
  get geonetOk() {
    return (
      this.lastSuccessAt !== null && !this.failing.has('volcanoes') && !this.failing.has('quakes')
    );
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1 && saved.known && typeof saved.known === 'object') {
      this.data = { ...emptyData(), ...saved };
    }
    this.warnAboutConfig();
    logger.info(`Started: GeoNet read every ${config.refreshMinutes} min`);
    await this.runCycle();
    this.schedule();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.houseReadAt = -Infinity;
    await this.publishDiscovered(true);
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration first.
    await this.running;
    this.config = config;
    this.houseReadAt = -Infinity;
    logger.info('Configuration saved');
    this.warnAboutConfig();
    this.schedule();
    await this.runCycle();
    // The language may have changed: the names of new devices follow it.
    await this.publishDiscovered(true);
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    if (this.config.invalidCenter) {
      logger.warn('The coordinates of the configuration are not valid: the house is used');
    }
  }

  /**
   * The devices to discover: the followed volcanoes (known by their id even
   * before GeoNet answered, named after it once it did), the New Zealand
   * device and the earthquake device.
   */
  discoveredDevices() {
    const language = this.config.language;
    const devices = this.config.volcanoes.map((id) => {
      const volcano = this.volcanoes.find((v) => v.id === id) ?? this.data.names?.[id];
      return buildVolcanoDevice(this.gladys, { id, name: volcano?.name ?? id }, language);
    });
    if (this.config.national) {
      devices.push(buildNationalDevice(this.gladys, language));
    }
    if (this.config.quakeRadiusKm > 0) {
      devices.push(buildQuakeDevice(this.gladys, language));
    }
    return devices;
  }

  /** Publish the discovered devices when they changed (or always, `force`). */
  async publishDiscovered(force = false) {
    const devices = this.discoveredDevices();
    const signature = JSON.stringify(devices);
    if (!force && signature === this.discoveredSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discoveredSignature = signature;
      this.recovered('discovery', 'Publishing the discovered devices works again');
    } catch (err) {
      this.failed('discovery', 'warn', `Publishing the discovered devices failed: ${err.message}`);
    }
  }

  /** What is created in Gladys: the volcano ids, and the two other devices. */
  created() {
    const ids = new Set();
    let national = false;
    let quakes = false;
    const nationalId = nationalIds(this.gladys).device;
    const quakesId = quakeIds(this.gladys).device;
    const prefix = volcanoIds(this.gladys, '').device;
    for (const device of this.gladys.devices ?? []) {
      const id = device?.external_id ?? '';
      if (id === nationalId) {
        national = true;
      } else if (id === quakesId) {
        quakes = true;
      } else if (id.startsWith(prefix)) {
        ids.add(id.slice(prefix.length));
      }
    }
    return { ids, national, quakes };
  }

  // --- Centre ------------------------------------------------------------------

  /** The centre: the configured coordinates, else the first located house. */
  async center() {
    if (this.config.center) {
      return this.config.center;
    }
    if (this.now() - this.houseReadAt >= this.timings.housesMaxAgeMs) {
      try {
        const houses = await this.gladys.getHouses();
        this.house =
          houses.find(
            (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
          ) ?? null;
        this.houseReadAt = this.now();
        this.recovered('houses', 'The houses of Gladys are readable again');
      } catch (err) {
        this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      }
    }
    return this.house ? { latitude: this.house.latitude, longitude: this.house.longitude } : null;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    const center = await this.center();
    this.centerUsed = center;
    const away = (item) =>
      center && item.latitude !== null
        ? distanceKm(center.latitude, center.longitude, item.latitude, item.longitude)
        : null;

    let volcanoes = null;
    try {
      volcanoes = await fetchVolcanoes(this.fetch);
      this.recovered('volcanoes', 'GeoNet answers again (volcanoes)');
    } catch (err) {
      this.failed('volcanoes', 'warn', `GeoNet unreachable (volcanoes): ${err.message}`);
    }

    let quakes = null;
    const radius = this.config.quakeRadiusKm;
    if (radius > 0) {
      try {
        const all = await fetchQuakes(this.fetch, this.config.quakeMinMmi);
        this.recovered('quakes', 'GeoNet answers again (earthquakes)');
        quakes = center
          ? all
              .map((quake) => ({ ...quake, distanceKm: away(quake) }))
              .filter((quake) => quake.distanceKm <= radius)
          : null;
      } catch (err) {
        this.failed('quakes', 'warn', `GeoNet unreachable (earthquakes): ${err.message}`);
      }
    } else {
      this.failing.delete('quakes');
    }

    if (volcanoes) {
      this.volcanoes = volcanoes.map((volcano) => {
        const known = this.data.known[volcano.id];
        return {
          ...volcano,
          changedAt: known && known.level === volcano.level ? (known.changedAt ?? null) : null,
          distanceKm: away(volcano),
        };
      });
      this.followed = this.volcanoes
        .filter((volcano) => this.config.volcanoes.includes(volcano.id))
        .sort(byActivity);
      await this.detectChanges();
    }
    // Kept while GeoNet fails: the last list stays shown, but not as fresh.
    if (quakes || radius === 0 || !center) {
      this.quakes = quakes;
      if (quakes) {
        await this.detectQuakes(quakes, center);
      }
    }
    if (volcanoes) {
      this.lastSuccessAt = this.now();
    }
    this.recovered('cycle', 'Refresh cycles work again');
    logger.debug(
      `Refresh cycle: ${this.volcanoes.length} volcano(es), ${this.followed.length} followed, ${this.quakes?.length ?? 'no'} earthquake(s) in the radius`,
    );
    this.store.save(this.data);
    await this.publishDiscovered();
    await this.publishStates();
    await this.updateConnectionStatus();
    const signature = JSON.stringify([
      this.shown().map((v) => [v.id, v.level, v.color]),
      this.quakes?.[0]?.id,
      this.geonetOk,
    ]);
    if (signature !== this.widgetSignature) {
      this.widgetSignature = signature;
      this.requestRefresh();
    }
  }

  /** The volcanoes the widget and the sentences list: followed, and all elevated with `national`. */
  shown() {
    const list = new Map(this.followed.map((volcano) => [volcano.id, volcano]));
    if (this.config.national) {
      for (const volcano of this.volcanoes) {
        if (isElevated(volcano)) {
          list.set(volcano.id, volcano);
        }
      }
    }
    return [...list.values()].sort(byActivity);
  }

  /** Fire `alert_changed`, and remember the levels and names of every volcano. */
  async detectChanges() {
    const now = this.now();
    const known = this.data.known;
    // The very first start only records: nothing changed yet.
    const seed = Object.keys(known).length === 0;
    const changes = [];
    this.data.names = Object.fromEntries(this.volcanoes.map((v) => [v.id, { name: v.name }]));
    for (const volcano of this.volcanoes) {
      const before = known[volcano.id];
      if (!before) {
        known[volcano.id] = { level: volcano.level, color: volcano.color, changedAt: null };
        continue;
      }
      if (before.level === volcano.level && before.color === volcano.color) {
        continue;
      }
      const changedAt = before.changedAt;
      if (before.level !== volcano.level) {
        before.changedAt = now;
        volcano.changedAt = now;
      }
      const previous = { level: before.level, color: before.color, changedAt };
      before.level = volcano.level;
      before.color = volcano.color;
      // A level GeoNet stops giving (null) and gives back is not a change.
      if (!seed && volcano.level !== null && previous.level !== null) {
        changes.push({ volcano, previous });
      }
    }
    for (const change of changes) {
      if (!(await this.fireAlert(change))) {
        // Not delivered: the change stays news, fired again at the next cycle.
        Object.assign(known[change.volcano.id], change.previous);
      }
    }
  }

  async fireAlert({ volcano, previous }) {
    const fired = await this.fire(ALERT_TRIGGER, this.alertData(volcano, previous));
    if (fired) {
      logger.info(
        `${volcano.name}: level ${previous.level} / ${previous.color} → ${volcano.level} / ${volcano.color}`,
      );
    }
    return fired;
  }

  /** Publish a scene event; false when Gladys did not take it. */
  async fire(trigger, data) {
    try {
      await this.gladys.publishSceneEvent(trigger, data);
      this.recovered('scene', 'Scene triggers work again');
      return true;
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
      return false;
    }
  }

  /** The flat data of an `alert_changed` event (fields, then variables of the manifest). */
  alertData(volcano, previous) {
    const language = this.config.language;
    const raised =
      volcano.level - previous.level || colorRank(volcano.color) - colorRank(previous.color);
    return {
      volcano_id: volcano.id,
      alert_level: String(volcano.level),
      direction: raised > 0 ? 'raised' : 'lowered',
      volcano: volcano.name,
      previous_alert_level: String(previous.level),
      aviation_color: volcano.color ?? '',
      aviation_color_name: COLOR_NAMES[language][volcano.color] ?? '',
      // The core refuses a string field over 1000 characters.
      activity: clip(volcano.activity, 1000),
      hazards: clip(volcano.hazards, 1000),
      distance_km: volcano.distanceKm === null ? null : Math.round(volcano.distanceKm),
      summary: describe(volcano, language),
      url: volcanoPage(volcano.id),
    };
  }

  /** Fire `quake_felt` for the new, recent earthquakes of the radius. */
  async detectQuakes(quakes, center) {
    // A salted hash: the location of the house cannot be read back from /data.
    this.data.salt ??= randomBytes(16).toString('hex');
    const key = createHmac('sha256', this.data.salt)
      .update(
        JSON.stringify([
          this.config.quakeRadiusKm,
          this.config.quakeMinMmi,
          Math.round(center.latitude * 100),
          Math.round(center.longitude * 100),
        ]),
      )
      .digest('hex')
      .slice(0, 16);
    const seen = new Set(Array.isArray(this.data.seenQuakes) ? this.data.seenQuakes : []);
    // First reading, or another radius, intensity or centre: recorded only.
    const seed = this.data.quakeKey !== key;
    this.data.quakeKey = key;
    const fresh = this.now() - this.timings.quakeFreshMs;
    const news = quakes.filter((quake) => !seen.has(quake.id) && quake.time >= fresh).reverse();
    for (const quake of quakes) {
      seen.add(quake.id);
    }
    this.data.seenQuakes = [...seen].slice(-SEEN_QUAKES);
    if (seed) {
      return;
    }
    for (const quake of news) {
      if (await this.fire(QUAKE_TRIGGER, this.quakeData(quake))) {
        logger.info(
          `Felt earthquake: M${quake.magnitude}, MMI ${quake.mmi}, ${Math.round(quake.distanceKm)} km away`,
        );
      } else {
        // Not delivered: still news at the next cycle (within its six hours).
        seen.delete(quake.id);
      }
    }
    this.data.seenQuakes = [...seen].slice(-SEEN_QUAKES);
  }

  /** The flat data of a `quake_felt` event. */
  quakeData(quake) {
    const language = this.config.language;
    return {
      mmi: String(quake.mmi),
      magnitude: quake.magnitude,
      mmi_name: mmiName(quake.mmi, language),
      distance_km: Math.round(quake.distanceKm),
      depth_km: quake.depthKm,
      locality: clip(quake.locality, 1000),
      time: new Date(quake.time).toISOString(),
      summary: quakeText(quake, language),
      url: quake.url,
    };
  }

  // --- States ------------------------------------------------------------------

  statesOf() {
    const language = this.config.language;
    const created = this.created();
    const states = [];
    // GeoNet down: the old values are not renewed by the heartbeat as if fresh.
    if (this.lastSuccessAt !== null && !this.failing.has('volcanoes')) {
      for (const volcano of this.volcanoes) {
        if (!created.ids.has(volcano.id)) {
          continue;
        }
        const ids = volcanoIds(this.gladys, volcano.id);
        // An unknown level is no level: nothing published rather than a false one.
        if (volcano.level !== null) {
          states.push({ device_feature_external_id: ids.level, state: volcano.level });
        }
        if (volcano.color) {
          states.push({ device_feature_external_id: ids.color, state: colorRank(volcano.color) });
        }
        states.push({
          device_feature_external_id: ids.activity,
          text: volcano.activity || PHRASES[language].unrated,
        });
        if (volcano.distanceKm !== null) {
          states.push({
            device_feature_external_id: ids.distance,
            state: Math.round(volcano.distanceKm * 10) / 10,
          });
        }
      }
      if (created.national && this.config.national && this.volcanoes.length > 0) {
        const ids = nationalIds(this.gladys);
        const sorted = [...this.volcanoes].sort(byActivity);
        const elevated = sorted.filter((volcano) => volcano.level > 0);
        const top = elevated[0];
        states.push(
          {
            device_feature_external_id: ids.level,
            state: Math.max(0, ...this.volcanoes.map((volcano) => volcano.level ?? 0)),
          },
          { device_feature_external_id: ids.count, state: elevated.length },
          {
            device_feature_external_id: ids.volcano,
            text: top ? describe(top, language) : PHRASES[language].noneElevated,
          },
        );
      }
    }
    if (created.quakes && this.quakes && !this.failing.has('quakes')) {
      const ids = quakeIds(this.gladys);
      const since = this.now() - this.timings.quakeCountMs;
      const latest = this.quakes[0];
      states.push({
        device_feature_external_id: ids.count,
        state: this.quakes.filter((quake) => quake.time >= since).length,
      });
      if (latest) {
        if (latest.magnitude !== null) {
          states.push({ device_feature_external_id: ids.magnitude, state: latest.magnitude });
        }
        if (latest.mmi !== null) {
          states.push({ device_feature_external_id: ids.mmi, state: latest.mmi });
        }
        states.push(
          {
            device_feature_external_id: ids.distance,
            state: Math.round(latest.distanceKm * 10) / 10,
          },
          { device_feature_external_id: ids.text, text: quakeText(latest, language) },
        );
      } else {
        states.push({
          device_feature_external_id: ids.text,
          text: PHRASES[language].noQuake({ km: this.config.quakeRadiusKm }),
        });
      }
    }
    return states;
  }

  async publishStates() {
    const states = this.statesOf();
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.failing.has('volcanoes') || this.failing.has('quakes')) {
      parts.push(render(STATUS, 'geonetDown'));
    }
    const { volcanoes, national, quakeRadiusKm, center, invalidCenter } = this.config;
    if (volcanoes.length === 0 && !national && quakeRadiusKm === 0) {
      parts.push(render(STATUS, 'nothing'));
    }
    if ((quakeRadiusKm > 0 || volcanoes.length > 0) && !center && !this.house) {
      parts.push(render(STATUS, 'noCenter'));
    } else if (invalidCenter) {
      parts.push(render(STATUS, 'invalidCenter'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = this.geonetOk;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  isOurs(device) {
    const id = device?.external_id ?? '';
    return (
      id.startsWith(volcanoIds(this.gladys, '').device) ||
      id === nationalIds(this.gladys).device ||
      id === quakeIds(this.gladys).device
    );
  }

  async onDeviceCreated(device) {
    if (!this.isOurs(device)) {
      return;
    }
    if (this.lastSuccessAt === null) {
      await this.runCycle();
    }
    // The SDK forgot the states of the created device: they are published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.isOurs(device)) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The current data, read again if the last cycle is older than one interval. */
  async fresh() {
    if (this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    } else {
      await this.running;
    }
    // The last cycle failed: the levels are not current, the actions say so.
    // The earthquakes alone down: the levels are current, the sentence skips them.
    return {
      volcanoes: this.shown(),
      ok: this.lastSuccessAt !== null && !this.failing.has('volcanoes'),
    };
  }

  /** The sentence of the actions: the volcanoes, then the latest felt earthquake. */
  sentence(language) {
    const parts = [sentence(this.shown(), language)];
    if (this.config.quakeRadiusKm > 0 && this.quakes && !this.failing.has('quakes')) {
      const latest = this.quakes[0];
      parts.push(
        latest
          ? PHRASES[language].lastQuake({ text: quakeText(latest, language) })
          : `${PHRASES[language].noQuake({ km: this.config.quakeRadiusKm })}.`,
      );
    }
    return parts.join(' ');
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

function emptyData() {
  return { version: 1, known: {}, names: {}, seenQuakes: [], quakeKey: null };
}
