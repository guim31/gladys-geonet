// -----------------------------------------------------------------------------
// The scene action `read_geonet` and the configuration action `check_now`.
// Both read GeoNet again when the last cycle is older than one interval, and
// answer with the volcanoes shown (followed, and those above level 0 with the
// New Zealand device) and the latest felt earthquake, as one sentence:
// something a scene can send by message or read aloud.
//
// Gladys shows in green what a handler returns and in red what it throws: a
// failure throws an ActionFailure carrying the four languages.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS, formatTime, render } from './messages.js';

const logger = createLogger({ name: 'geonet-actions' });

export const SCENE_ACTION = 'read_geonet';
export const CONFIG_ACTION = 'check_now';

/** An action failure: `message` is the multi-language text Gladys shows in red. */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** Scene action: outputs `text`, `max_level` and `elevated_count`. */
export async function readGeonet(monitor) {
  const { volcanoes, ok } = await monitor.fresh();
  if (!ok) {
    throw new ActionFailure(render(STATUS, 'geonetDown'));
  }
  return {
    text: monitor.sentence(monitor.config.language),
    max_level: Math.max(0, ...volcanoes.map((volcano) => volcano.level ?? 0)),
    elevated_count: volcanoes.filter((volcano) => volcano.level > 0).length,
  };
}

/** Configuration action: the volcanoes and the latest earthquake now, in every language. */
export async function checkNow(monitor) {
  const { volcanoes, ok } = await monitor.fresh();
  logger.info(`Check requested: ${ok ? `${volcanoes.length} volcano(es) shown` : 'GeoNet down'}`);
  if (!ok) {
    throw new ActionFailure(render(STATUS, 'geonetDown'));
  }
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      render(STATUS, 'summary', {
        text: monitor.sentence(language),
        time: formatTime(monitor.lastSuccessAt, language),
      })[language],
    ]),
  );
}
