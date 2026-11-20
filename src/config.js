// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The volcanoes rated by GeoNet (`volcanoID` of the VAL API, 20/11/2026),
// north to south. These ids are the platform ids of the devices and the
// options of the manifest: stable once published. A volcano GeoNet would add
// later is still counted by the "New Zealand" device and the trigger.
export const VOLCANO_IDS = [
  'kermadecislands',
  'northland',
  'aucklandvolcanicfield',
  'mayorisland',
  'whiteisland',
  'okataina',
  'rotorua',
  'taupo',
  'tongariro',
  'ngauruhoe',
  'ruapehu',
  'taranakiegmont',
];

// The Volcanic Alert Level of New Zealand: 0 (no unrest) to 5 (major eruption).
export const MAX_LEVEL = 5;

// The Aviation Colour Code (ICAO), lowest first. `rank` is also the value of
// the "aviation colour code" feature (the risk badge of Gladys: 0 "no risk" …
// 3 "high").
export const COLORS = ['green', 'yellow', 'orange', 'red'];
export const colorRank = (key) => COLORS.indexOf(key);

// Kilometres around the house for the felt earthquakes; 0 turns them off.
export const QUAKE_RADII = ['0', '25', '50', '100', '200', '300'];

// Lowest Modified Mercalli Intensity kept, as GeoNet computes it: 3 weak (felt
// indoors by a few), 4 light, 5 moderate, 6 strong. The API accepts -1 to 8.
export const QUAKE_MMIS = ['3', '4', '5', '6'];

// Minutes between two readings: earthquakes are what needs the short ones.
export const REFRESH_INTERVALS = ['1', '2', '5', '10', '15'];

export const DEFAULT_CONFIG = {
  volcanoes: [],
  national: true,
  quake_radius: '100',
  quake_min_mmi: '3',
  latitude: '',
  longitude: '',
  refresh_interval: '2',
  language: 'fr',
};

/** A coordinate typed by the user (decimal comma accepted), null if blank or invalid. */
export function parseCoordinate(value, limit) {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

/** The followed volcanoes: known ids only, in the order of VOLCANO_IDS. */
export function parseVolcanoes(value) {
  // Gladys stores a multi_select as an array; a string is tolerated.
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,;\s]+/);
  const wanted = new Set(list.map((item) => String(item).trim().toLowerCase()));
  return VOLCANO_IDS.filter((id) => wanted.has(id));
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

const bool = (value, fallback) =>
  value === undefined || value === null || value === ''
    ? fallback
    : value === true || value === 'true';

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const latitude = parseCoordinate(source.latitude, 90);
  const longitude = parseCoordinate(source.longitude, 180);
  // Both or none: half a centre falls back on the house.
  const center = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const typed = String(source.latitude ?? '').trim() + String(source.longitude ?? '').trim();
  return {
    volcanoes: parseVolcanoes(source.volcanoes ?? DEFAULT_CONFIG.volcanoes),
    national: bool(source.national, DEFAULT_CONFIG.national),
    quakeRadiusKm: pick(source.quake_radius, QUAKE_RADII, DEFAULT_CONFIG.quake_radius),
    quakeMinMmi: pick(source.quake_min_mmi, QUAKE_MMIS, DEFAULT_CONFIG.quake_min_mmi),
    center,
    // Something was typed but is not a pair of coordinates: said once in the logs.
    invalidCenter: center === null && typed !== '',
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
