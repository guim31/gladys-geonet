// -----------------------------------------------------------------------------
// The Gladys devices of the integration:
//
//   - one per followed volcano, platform id = its GeoNet `volcanoID` (stable):
//       alert_level    counter-sensor/integer: the Volcanic Alert Level, 0-5
//                      (the risk badge of Gladys stops at 3);
//       aviation_color risk/integer 0 green, 1 yellow, 2 orange, 3 red;
//       activity       text/text: the activity, as GeoNet words it (English);
//       distance       distance-sensor/decimal, km from the centre;
//   - "New Zealand volcanoes" (platform id `nz`), option `national`:
//       highest_level  counter-sensor/integer: the highest level in NZ;
//       elevated_count counter-sensor/integer: volcanoes at level 1 or more;
//       highest_volcano text/text: the volcano concerned and its level;
//   - "Felt earthquakes" (platform id `quakes`), when a radius is set:
//       magnitude      sismic-sensor/decimal: of the latest quake in the radius;
//       mmi            counter-sensor/integer: its intensity (MMI);
//       quake_count    counter-sensor/integer: quakes in the radius, last 24 h;
//       distance       distance-sensor/decimal: its distance, km;
//       latest_quake   text/text: where and when.
//
// Two features of a type on a device let the dashboard show their published
// names (a lone one gets the generic label of its type). Published with
// should_poll: false: the refresh runs in the container (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { MAX_LEVEL } from './config.js';

export const VOLCANO_TYPE = 'volcano';
export const NATIONAL_TYPE = 'national';
export const NATIONAL_PLATFORM_ID = 'nz';
export const QUAKES_TYPE = 'quakes';
export const QUAKES_PLATFORM_ID = 'felt';

export const MAX_COUNT = 1000;
// Half the circumference of the Earth.
export const MAX_DISTANCE_KM = 20040;
// The MMI scale GeoNet uses goes from -1 (unnoticeable) to 12.
export const MIN_MMI = -1;
export const MAX_MMI = 12;
export const MAX_MAGNITUDE = 10;

// Feature and device names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    volcano: 'Volcano',
    national: 'New Zealand volcanoes',
    quakes: 'Felt earthquakes',
    alert_level: 'Volcanic alert level',
    aviation_color: 'Aviation colour code',
    activity: 'Volcanic activity',
    distance: 'Distance',
    highest_level: 'Highest alert level',
    elevated_count: 'Volcanoes at level 1 or more',
    highest_volcano: 'Most active volcano',
    magnitude: 'Magnitude',
    mmi: 'Intensity (MMI)',
    quake_count: 'Felt earthquakes (24 h)',
    quake_distance: 'Distance of the epicentre',
    latest_quake: 'Latest felt earthquake',
  },
  fr: {
    volcano: 'Volcan',
    national: 'Volcans de Nouvelle-Zélande',
    quakes: 'Séismes ressentis',
    alert_level: "Niveau d'alerte volcanique",
    aviation_color: 'Code couleur aviation',
    activity: 'Activité volcanique',
    distance: 'Distance',
    highest_level: "Niveau d'alerte le plus haut",
    elevated_count: 'Volcans au niveau 1 ou plus',
    highest_volcano: 'Volcan le plus actif',
    magnitude: 'Magnitude',
    mmi: 'Intensité (MMI)',
    quake_count: 'Séismes ressentis (24 h)',
    quake_distance: "Distance de l'épicentre",
    latest_quake: 'Dernier séisme ressenti',
  },
  de: {
    volcano: 'Vulkan',
    national: 'Vulkane Neuseelands',
    quakes: 'Spürbare Erdbeben',
    alert_level: 'Vulkan-Warnstufe',
    aviation_color: 'Luftfahrt-Farbcode',
    activity: 'Vulkanische Aktivität',
    distance: 'Entfernung',
    highest_level: 'Höchste Warnstufe',
    elevated_count: 'Vulkane ab Stufe 1',
    highest_volcano: 'Aktivster Vulkan',
    magnitude: 'Magnitude',
    mmi: 'Intensität (MMI)',
    quake_count: 'Spürbare Erdbeben (24 h)',
    quake_distance: 'Entfernung des Epizentrums',
    latest_quake: 'Letztes spürbares Erdbeben',
  },
  es: {
    volcano: 'Volcán',
    national: 'Volcanes de Nueva Zelanda',
    quakes: 'Terremotos sentidos',
    alert_level: 'Nivel de alerta volcánica',
    aviation_color: 'Código de color de aviación',
    activity: 'Actividad volcánica',
    distance: 'Distancia',
    highest_level: 'Nivel de alerta más alto',
    elevated_count: 'Volcanes en nivel 1 o más',
    highest_volcano: 'Volcán más activo',
    magnitude: 'Magnitud',
    mmi: 'Intensidad (MMI)',
    quake_count: 'Terremotos sentidos (24 h)',
    quake_distance: 'Distancia del epicentro',
    latest_quake: 'Último terremoto sentido',
  },
};

const namesOf = (language) => NAMES[language] ?? NAMES.fr;

/** External ids of a volcano device and of its features. */
export function volcanoIds(gladys, id) {
  const ids = gladys.externalIds(VOLCANO_TYPE, id);
  return {
    device: ids.device,
    level: ids.feature('alert_level'),
    color: ids.feature('aviation_color'),
    activity: ids.feature('activity'),
    distance: ids.feature('distance'),
  };
}

/** External ids of the New Zealand device and of its features. */
export function nationalIds(gladys) {
  const ids = gladys.externalIds(NATIONAL_TYPE, NATIONAL_PLATFORM_ID);
  return {
    device: ids.device,
    level: ids.feature('highest_level'),
    count: ids.feature('elevated_count'),
    volcano: ids.feature('highest_volcano'),
  };
}

/** External ids of the earthquake device and of its features. */
export function quakeIds(gladys) {
  const ids = gladys.externalIds(QUAKES_TYPE, QUAKES_PLATFORM_ID);
  return {
    device: ids.device,
    magnitude: ids.feature('magnitude'),
    mmi: ids.feature('mmi'),
    count: ids.feature('quake_count'),
    distance: ids.feature('distance'),
    text: ids.feature('latest_quake'),
  };
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const counter = (name, externalId, min, max) =>
  sensor(name, externalId, CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
    keep_history: true,
    min,
    max,
  });

const text = (name, externalId) =>
  sensor(name, externalId, CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
    keep_history: false,
    min: 0,
    max: 0,
  });

const distance = (name, externalId) =>
  sensor(name, externalId, CATEGORIES.DISTANCE_SENSOR, TYPES.SENSOR.DECIMAL, {
    keep_history: false,
    unit: UNITS.KM,
    min: 0,
    max: MAX_DISTANCE_KM,
  });

/** The discovery payload of one volcano. */
export function buildVolcanoDevice(gladys, volcano, language = 'fr') {
  const ids = volcanoIds(gladys, volcano.id);
  const names = namesOf(language);
  return {
    name: `${names.volcano} ${volcano.name}`,
    external_id: ids.device,
    model: 'GeoNet VAL',
    should_poll: false,
    params: [{ name: 'volcano_id', value: volcano.id }],
    features: [
      counter(names.alert_level, ids.level, 0, MAX_LEVEL),
      sensor(names.aviation_color, ids.color, CATEGORIES.RISK, TYPES.RISK.INTEGER, {
        keep_history: true,
        min: 0,
        max: 3,
      }),
      text(names.activity, ids.activity),
      distance(names.distance, ids.distance),
    ],
  };
}

/** The discovery payload of the New Zealand device. */
export function buildNationalDevice(gladys, language = 'fr') {
  const ids = nationalIds(gladys);
  const names = namesOf(language);
  return {
    name: names.national,
    external_id: ids.device,
    model: 'GeoNet VAL',
    should_poll: false,
    params: [],
    features: [
      counter(names.highest_level, ids.level, 0, MAX_LEVEL),
      counter(names.elevated_count, ids.count, 0, MAX_COUNT),
      text(names.highest_volcano, ids.volcano),
    ],
  };
}

/** The discovery payload of the earthquake device. */
export function buildQuakeDevice(gladys, language = 'fr') {
  const ids = quakeIds(gladys);
  const names = namesOf(language);
  return {
    name: names.quakes,
    external_id: ids.device,
    model: 'GeoNet Quakes',
    should_poll: false,
    params: [],
    features: [
      sensor(names.magnitude, ids.magnitude, CATEGORIES.SISMIC_SENSOR, TYPES.SENSOR.DECIMAL, {
        keep_history: true,
        min: 0,
        max: MAX_MAGNITUDE,
      }),
      counter(names.mmi, ids.mmi, MIN_MMI, MAX_MMI),
      counter(names.quake_count, ids.count, 0, MAX_COUNT),
      distance(names.quake_distance, ids.distance),
      text(names.latest_quake, ids.text),
    ],
  };
}
