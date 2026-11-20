// -----------------------------------------------------------------------------
// The `geonet` widget and the two actions: contents within the core budget
// (validateWidgetContent: an empty array means rendered as sent), the order,
// the names given in Gladys, the settings, the sentences, and the colour of
// the action messages (green for a success, red for a failure).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES, VOLCANO_IDS } from '../src/config.js';
import { MAX_ITEMS } from '../src/widgets.js';
import {
  RUAPEHU,
  TAUPO,
  WHITE_ISLAND,
  createAll,
  createApi,
  createWorld,
  discovered,
} from './helpers/world.js';

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language, settings = {}) =>
  (await w.fake.widgetGet('geonet', { settings, language })).data.content;
const list = (widget) => widget.components.find((c) => c.type === 'card-list');

test('the widget: latest felt earthquake, then the volcanoes, most active first', async (t) => {
  const w = await world(t, { volcanoes: [TAUPO, WHITE_ISLAND] });
  for (const language of LANGUAGES) {
    const widget = await content(w, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    assert.deepEqual(
      list(widget)
        .items.slice(1)
        .map((item) => item.title),
      ['White Island', 'Ruapehu', 'Taupo'],
    );
  }
  const en = await content(w, 'en');
  assert.equal(en.components[0].text, '2 volcanoes at level 1 or more');
  const [quake, island, ruapehu, taupo] = list(en).items;
  assert.equal(quake.title, 'M3.5 · Weak');
  assert.equal(quake.subtitle, '44 km · 20/11, 16:36');
  assert.deepEqual(quake.badge, { text: 'MMI 3', color: 'warning' });
  assert.match(quake.description, /^40 km south-east of Taupo\n42 km deep$/);
  assert.equal(quake.links[0].url, 'https://www.geonet.org.nz/earthquake/2026p874729');
  assert.deepEqual(island.badge, { text: 'Level 2', color: 'warning' });
  assert.deepEqual(ruapehu.badge, { text: 'Level 1', color: 'info' });
  assert.deepEqual(taupo.badge, { text: 'Level 0', color: 'success' });
  assert.equal(island.subtitle, 'Aviation yellow · 162 km');
  assert.match(island.description, /^Moderate to heightened volcanic unrest\.\nVolcanic unrest/);
  assert.equal(island.links[0].url, 'https://www.geonet.org.nz/volcano/whiteisland');
  assert.equal(en.components.at(-1).link.url, 'https://www.geonet.org.nz/volcano');
  const fr = await content(w, 'fr');
  assert.equal(fr.components[0].text, '2 volcans au niveau 1 ou plus');
  assert.equal(list(fr).items[1].subtitle, 'Code aviation jaune · 162 km');
});

test('the settings hide the volcanoes at level 0, the earthquake and the link', async (t) => {
  const w = await world(t, { volcanoes: [TAUPO] });
  const only = await content(w, 'en', {
    only_elevated: true,
    show_quake: false,
    show_link: false,
  });
  assert.deepEqual(
    list(only).items.map((item) => item.title),
    ['White Island', 'Ruapehu'],
  );
  assert.ok(!only.components.some((c) => c.type === 'button'));
  assert.deepEqual(validateWidgetContent(only), []);
});

test('without the New Zealand device, only the followed volcanoes', async (t) => {
  const w = await world(t, { volcanoes: [TAUPO], national: false, quake_radius: '0' });
  assert.deepEqual(
    list(await content(w, 'en')).items.map((item) => item.title),
    ['Taupo'],
  );
});

test('a created device shows the name given in Gladys; 8 rows at most', async (t) => {
  const w = await world(t, { volcanoes: VOLCANO_IDS, language: 'en' });
  const device = discovered(w).find((d) => d.name === 'Volcano Ruapehu');
  await w.fake.deviceCreated({ ...device, name: 'Mount Ruapehu' });
  const widget = await content(w, 'en');
  assert.equal(list(widget).items.length, MAX_ITEMS);
  assert.ok(list(widget).items.some((item) => item.title === 'Mount Ruapehu'));
  assert.deepEqual(validateWidgetContent(widget), []);
});

test('before the first answer: waiting; nothing followed: said', async (t) => {
  const api = createApi();
  api.down = 503;
  const w = await world(t, {}, { api });
  assert.equal((await content(w, 'en')).components[0].text, 'Waiting for GeoNet…');
  const empty = await world(t, { national: false, quake_radius: '0' });
  const widget = await content(empty, 'en');
  assert.equal(widget.components[0].text, 'No volcano followed.');
  assert.deepEqual(validateWidgetContent(widget), []);
});

test('scene action: the sentence, the highest level and the count, in green', async (t) => {
  const w = await world(t, { volcanoes: [RUAPEHU], national: false, language: 'en' });
  const ack = await w.fake.sceneAction('read_geonet', {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    text:
      '1 volcano at level 1 or more: Ruapehu: Level 1 / Green, 79 km away. ' +
      'Latest felt earthquake: M3.5, Weak (MMI 3), 40 km south-east of Taupo (44 km away), 20/11, 16:36.',
    max_level: 1,
    elevated_count: 1,
  });
});

test('scene action: GeoNet down is a failure, in red, in four languages', async (t) => {
  const api = createApi();
  api.down = 'network';
  const w = await world(t, {}, { api });
  const ack = await w.fake.sceneAction('read_geonet', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /GeoNet ne répond pas/);
  assert.deepEqual(Object.keys(ack.error), LANGUAGES);
});

test('configuration action: the levels in every language, in green', async (t) => {
  const w = await world(t, { volcanoes: [WHITE_ISLAND], quake_radius: '25' });
  const ack = await w.fake.action('check_now', {});
  assert.equal(ack.success, true);
  assert.equal(
    ack.data.message.en,
    '2 volcanoes at level 1 or more: White Island: Level 2 / Yellow, 162 km away; Ruapehu: Level 1 / Green, 79 km away. Latest felt earthquake: M3.6, Light (MMI 4), 10 km north-west of Taupo (8 km away), 16/11, 13:58. Checked at 23:10.',
  );
  assert.match(ack.data.message.fr, /^2 volcans au niveau 1 ou plus : White Island : Niveau 2/);
  assert.deepEqual(Object.keys(ack.data.message), LANGUAGES);
});

test('configuration action: GeoNet down is a failure, in red', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  api.down = 503;
  w.clock.advance(10 * 60 * 1000);
  const ack = await w.fake.action('check_now', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /GeoNet ne répond pas/);
  assert.match(ack.error.de, /GeoNet antwortet nicht/);
});

test('a created device makes the widget refresh, a renamed one too', async (t) => {
  const w = await world(t, { volcanoes: [TAUPO] });
  const before = w.fake.widgetRefreshes.length;
  // requestWidgetRefresh is throttled to one call every 10 s.
  w.clock.advance(20000);
  const [device] = await createAll(w);
  w.clock.advance(20000);
  await w.fake.deviceUpdated({ ...device, name: 'Taupō volcano' });
  assert.ok(w.fake.widgetRefreshes.length >= before + 2);
});
