// -----------------------------------------------------------------------------
// GeoNet client (GNS Science, New Zealand): the public, keyless GeoJSON API of
// https://api.geonet.org.nz, asked for its version 2 by the Accept header.
//
//   - /volcano/val: the Volcanic Alert Level of the ~12 rated volcanoes or
//     volcanic fields, with the aviation colour code, the activity and the
//     hazards in one English sentence each, and the position;
//   - /quake?MMI=<n>: the 100 latest earthquakes whose intensity (Modified
//     Mercalli, computed by GeoNet) is at least n, NZ-wide. A quake removed
//     by the analysts stays in the list with `quality: "deleted"`: dropped.
//
// Data under CC BY 3.0 NZ (credited in the docs). No header carries a secret.
// -----------------------------------------------------------------------------

import { COLORS, MAX_LEVEL } from './config.js';

export const API_BASE = 'https://api.geonet.org.nz';
export const VAL_URL = `${API_BASE}/volcano/val`;
export const quakeUrl = (mmi) => `${API_BASE}/quake?MMI=${mmi}`;
export const VOLCANO_SITE = 'https://www.geonet.org.nz/volcano';
export const quakePage = (id) => `https://www.geonet.org.nz/earthquake/${encodeURIComponent(id)}`;
export const volcanoPage = (id) => `${VOLCANO_SITE}/${encodeURIComponent(id)}`;
export const ACCEPT = 'application/vnd.geo+json;version=2';
export const USER_AGENT =
  'gladys-geonet (Gladys Assistant integration; +https://github.com/guim31/gladys-geonet)';

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error or a bad body
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * GET `url` and parse its JSON body.
 * @param {Function} fetchImpl fetch
 * @param {string} url
 */
export async function getJson(fetchImpl, url, { timeoutMs = 30000 } = {}) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: ACCEPT, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new HttpError(`${host}: ${reason}`);
  }
  if (response.status !== 200) {
    throw new HttpError(`${host}: HTTP ${response.status}`, response.status);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`${host}: the answer is not JSON`, response.status);
  }
}

const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** [longitude, latitude] of a GeoJSON point, or null. */
function position(feature) {
  const [longitude, latitude] = feature?.geometry?.coordinates ?? [];
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/**
 * One feature of /volcano/val as a plain volcano, or null without an id.
 * `level` is null when GeoNet gives none in 0-5, `color` when not a known code.
 */
export function parseVolcano(feature) {
  const p = feature?.properties ?? {};
  const id =
    typeof p.volcanoID === 'string' && /^[a-z0-9]+$/.test(p.volcanoID) ? p.volcanoID : null;
  if (!id) {
    return null;
  }
  const level = Number.isInteger(p.level) && p.level >= 0 && p.level <= MAX_LEVEL ? p.level : null;
  const color = clean(p.acc).toLowerCase();
  const where = position(feature);
  return {
    id,
    name: clean(p.volcanoTitle) || id,
    level,
    color: COLORS.includes(color) ? color : null,
    activity: clean(p.activity),
    hazards: clean(p.hazards),
    latitude: where?.latitude ?? null,
    longitude: where?.longitude ?? null,
  };
}

/** One feature of /quake as a plain earthquake, or null if unusable or deleted. */
export function parseQuake(feature) {
  const p = feature?.properties ?? {};
  const time = Date.parse(p.time);
  const where = position(feature);
  if (typeof p.publicID !== 'string' || !p.publicID || !Number.isFinite(time) || !where) {
    return null;
  }
  if (p.quality === 'deleted') {
    return null;
  }
  return {
    id: p.publicID,
    time,
    magnitude: Number.isFinite(p.magnitude) ? Math.round(p.magnitude * 10) / 10 : null,
    mmi: Number.isInteger(p.mmi) ? p.mmi : null,
    depthKm: Number.isFinite(p.depth) ? Math.round(p.depth) : null,
    locality: clean(p.locality),
    quality: clean(p.quality),
    ...where,
    url: quakePage(p.publicID),
  };
}

const featuresOf = (body, url) => {
  if (!Array.isArray(body?.features)) {
    throw new HttpError(`${new URL(url).host}: unexpected answer`);
  }
  return body.features;
};

/** The rated volcanoes; throws an HttpError when GeoNet fails. */
export async function fetchVolcanoes(fetchImpl) {
  const features = featuresOf(await getJson(fetchImpl, VAL_URL), VAL_URL);
  return features.map(parseVolcano).filter(Boolean);
}

/** The latest earthquakes of intensity `mmi` or more, newest first. */
export async function fetchQuakes(fetchImpl, mmi) {
  const url = quakeUrl(mmi);
  const features = featuresOf(await getJson(fetchImpl, url), url);
  return features
    .map(parseQuake)
    .filter(Boolean)
    .sort((a, b) => b.time - a.time);
}
