// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `geonet`.
//
// A heading with the number of volcanoes shown at level 1 or more, then a
// `card-list` (8 rows at most, the core's cap): the latest felt earthquake in
// the radius first, then the followed volcanoes and those above level 0 with
// the New Zealand device, most active first. A volcano row: its name (the one
// given in Gladys for a created device), the aviation colour and the distance
// as subtitle, the alert level as a coloured badge; its detail panel gives
// GeoNet's activity and hazards sentences and a link to its page. The
// earthquake row: magnitude and intensity, distance and time, a detail panel
// with the locality and depth, and a link to GeoNet. The footer gives the
// source and the time of the last reading, and a link to GeoNet.
// Settings: `only_elevated`, `show_quake`, `show_link`.
// Budget: 2 texts, 1 card-list, 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { volcanoIds } from './device.js';
import { VOLCANO_SITE, volcanoPage } from './geonet.js';
import {
  COLOR_NAMES,
  PHRASES,
  clip,
  formatDate,
  formatNumber,
  levelColor,
  mmiName,
} from './messages.js';
import { WIDGET_KEY, isElevated } from './monitor.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for GeoNet…',
    fr: 'En attente de GeoNet…',
    de: 'Warte auf GeoNet…',
    es: 'Esperando a GeoNet…',
  },
  source: {
    en: 'Source: GeoNet',
    fr: 'Source : GeoNet',
    de: 'Quelle: GeoNet',
    es: 'Fuente: GeoNet',
  },
  page: {
    en: 'Volcano page',
    fr: 'Page du volcan',
    de: 'Vulkanseite',
    es: 'Página del volcán',
  },
  quakePage: {
    en: 'Earthquake page',
    fr: 'Page du séisme',
    de: 'Erdbebenseite',
    es: 'Página del terremoto',
  },
  since: { en: 'Level since', fr: 'Niveau depuis le', de: 'Stufe seit', es: 'Nivel desde' },
  aviation: { en: 'Aviation', fr: 'Code aviation', de: 'Luftfahrt', es: 'Aviación' },
  site: { en: 'GeoNet', fr: 'GeoNet', de: 'GeoNet', es: 'GeoNet' },
};

const t = (text, language) => text[language] ?? text.en;
const truthy = (value, fallback) =>
  value === undefined || value === null ? fallback : value === true || value === 'true';

const km = (distance, language) => `${formatNumber(Math.round(distance), language)} km`;

/** One volcano row of the list, and its detail panel. */
export function volcanoItem(volcano, language, name = volcano.name) {
  const color = COLOR_NAMES[language][volcano.color];
  const p = PHRASES[language];
  return {
    title: clip(name, 60),
    subtitle: clip(
      [
        color ? `${t(TEXT.aviation, language)} ${color.toLowerCase()}` : null,
        volcano.distanceKm === null ? null : km(volcano.distanceKm, language),
      ]
        .filter(Boolean)
        .join(' · ') || 'GeoNet',
      60,
    ),
    badge: {
      text: volcano.level === null ? p.unrated : p.level({ level: volcano.level }),
      color: levelColor(volcano.level),
    },
    // GeoNet writes its sentences in English: shown as they are.
    description: clip(
      [
        volcano.activity,
        volcano.hazards,
        volcano.changedAt
          ? `${t(TEXT.since, language)} ${formatDate(volcano.changedAt, language)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    ),
    links: [{ url: volcanoPage(volcano.id), label: t(TEXT.page, language) }],
  };
}

/** The earthquake row. */
export function quakeItem(quake, language) {
  const magnitude = quake.magnitude === null ? '?' : formatNumber(quake.magnitude, language, 1);
  const strong = quake.mmi >= 5;
  return {
    title: clip(`M${magnitude} · ${mmiName(quake.mmi, language)}`, 60),
    subtitle: clip(`${km(quake.distanceKm, language)} · ${formatDate(quake.time, language)}`, 60),
    badge: {
      text: `MMI ${quake.mmi}`,
      color: strong ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
    },
    description: clip(
      [
        quake.locality,
        quake.depthKm === null ? null : PHRASES[language].depth({ km: quake.depthKm }),
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    ),
    links: [{ url: quake.url, label: t(TEXT.quakePage, language) }],
  };
}

/** The name given in Gladys to the device of a volcano, else GeoNet's name. */
function nameOf(monitor, volcano) {
  const id = volcanoIds(monitor.gladys, volcano.id).device;
  const device = (monitor.gladys.devices ?? []).find((d) => d.external_id === id);
  return device?.name || volcano.name;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en', settings = {} } = {}) {
      const lang = PHRASES[language] ? language : 'en';
      const onlyElevated = truthy(settings.only_elevated, false);
      const showQuake = truthy(settings.show_quake, true);
      const showLink = truthy(settings.show_link, true);
      const updated = monitor.lastSuccessAt;
      const source = t(TEXT.source, lang);
      const shown = monitor.shown();
      const listed = onlyElevated ? shown.filter(isElevated) : shown;
      const items = [];
      // An earthquake read before GeoNet failed is not shown as current.
      const quakes =
        monitor.config.quakeRadiusKm > 0 && !monitor.failing.has('quakes') ? monitor.quakes : null;
      if (showQuake && quakes?.[0]) {
        items.push(quakeItem(quakes[0], lang));
      }
      for (const volcano of listed) {
        items.push(volcanoItem(volcano, lang, nameOf(monitor, volcano)));
      }
      const components = [
        {
          type: 'text',
          variant: 'heading',
          text:
            updated === null
              ? t(TEXT.waiting, lang)
              : shown.length === 0
                ? PHRASES[lang].nothing
                : PHRASES[lang].elevated({
                    count: shown.filter((volcano) => volcano.level > 0).length,
                  }),
        },
      ];
      if (items.length > 0) {
        components.push({ type: 'card-list', display: 'list', items: items.slice(0, MAX_ITEMS) });
      }
      components.push({
        type: 'text',
        variant: 'caption',
        text: updated === null ? source : `${source} · ${formatDate(updated, lang)}`,
      });
      if (showLink) {
        components.push({
          type: 'button',
          label: t(TEXT.site, lang),
          icon: 'external-link',
          link: { url: VOLCANO_SITE },
        });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
