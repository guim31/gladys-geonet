// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action and
// scene messages, scene variables), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object. German
// says "du", Spanish "usted". Volcano names, localities and the activity
// sentences of GeoNet are in English: they are not translated.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';

export const COLOR_NAMES = {
  en: { green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { green: 'Vert', yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { green: 'Grün', yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { green: 'Verde', yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo' },
};

// The words GeoNet gives the intensities (Modified Mercalli).
export const MMI_NAMES = {
  en: ['Unnoticeable', 'Weak', 'Light', 'Moderate', 'Strong', 'Severe', 'Extreme'],
  fr: ['Imperceptible', 'Faible', 'Léger', 'Modéré', 'Fort', 'Sévère', 'Extrême'],
  de: ['Unmerklich', 'Schwach', 'Leicht', 'Mäßig', 'Stark', 'Schwer', 'Extrem'],
  es: ['Imperceptible', 'Débil', 'Ligero', 'Moderado', 'Fuerte', 'Severo', 'Extremo'],
};

/** The word of an intensity: ≤ 2 unnoticeable, 3 weak … 7 severe, ≥ 8 extreme. */
export function mmiName(mmi, language) {
  const names = MMI_NAMES[language] ?? MMI_NAMES.en;
  return names[Math.min(6, Math.max(0, mmi - 2))];
}

/** Colour of an alert level in the closed widget palette. */
export function levelColor(level) {
  if (level === null || level === undefined) {
    return WIDGET_COLORS.NEUTRAL;
  }
  return (
    [WIDGET_COLORS.SUCCESS, WIDGET_COLORS.INFO, WIDGET_COLORS.WARNING][level] ??
    WIDGET_COLORS.DANGER
  );
}

// Values of the text features, and pieces of sentences.
export const PHRASES = {
  en: {
    level: ({ level }) => `Level ${level}`,
    unrated: 'Not rated',
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `${km} km away`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `and ${count} more`,
    elevated: ({ count }) =>
      count === 0
        ? 'All volcanoes at level 0'
        : count === 1
          ? '1 volcano at level 1 or more'
          : `${count} volcanoes at level 1 or more`,
    noneElevated: 'All New Zealand volcanoes at level 0',
    nothing: 'No volcano followed.',
    quake: ({ magnitude, mmi, where, time }) => `M${magnitude}, ${mmi}, ${where}, ${time}`,
    lastQuake: ({ text }) => `Latest felt earthquake: ${text}.`,
    noQuake: ({ km }) => `No recent felt earthquake within ${km} km`,
    depth: ({ km }) => `${km} km deep`,
  },
  fr: {
    level: ({ level }) => `Niveau ${level}`,
    unrated: 'Non évalué',
    item: ({ name, level }) => `${name} : ${level}`,
    away: ({ km }) => `à ${km} km`,
    list: ({ head, items }) => `${head} : ${items.join(' ; ')}.`,
    more: ({ count }) => `et ${count} de plus`,
    elevated: ({ count }) =>
      count === 0
        ? 'Tous les volcans au niveau 0'
        : count === 1
          ? '1 volcan au niveau 1 ou plus'
          : `${count} volcans au niveau 1 ou plus`,
    noneElevated: 'Tous les volcans de Nouvelle-Zélande au niveau 0',
    nothing: 'Aucun volcan suivi.',
    quake: ({ magnitude, mmi, where, time }) => `M${magnitude}, ${mmi}, ${where}, ${time}`,
    lastQuake: ({ text }) => `Dernier séisme ressenti : ${text}.`,
    noQuake: ({ km }) => `Aucun séisme ressenti récent à moins de ${km} km`,
    depth: ({ km }) => `${km} km de profondeur`,
  },
  de: {
    level: ({ level }) => `Stufe ${level}`,
    unrated: 'Nicht bewertet',
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `${km} km entfernt`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `und ${count} weitere`,
    elevated: ({ count }) =>
      count === 0
        ? 'Alle Vulkane auf Stufe 0'
        : count === 1
          ? '1 Vulkan ab Stufe 1'
          : `${count} Vulkane ab Stufe 1`,
    noneElevated: 'Alle Vulkane Neuseelands auf Stufe 0',
    nothing: 'Kein Vulkan verfolgt.',
    quake: ({ magnitude, mmi, where, time }) => `M${magnitude}, ${mmi}, ${where}, ${time}`,
    lastQuake: ({ text }) => `Letztes spürbares Erdbeben: ${text}.`,
    noQuake: ({ km }) => `Kein spürbares Erdbeben im Umkreis von ${km} km in letzter Zeit`,
    depth: ({ km }) => `${km} km tief`,
  },
  es: {
    level: ({ level }) => `Nivel ${level}`,
    unrated: 'Sin evaluar',
    item: ({ name, level }) => `${name}: ${level}`,
    away: ({ km }) => `a ${km} km`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `y ${count} más`,
    elevated: ({ count }) =>
      count === 0
        ? 'Todos los volcanes en nivel 0'
        : count === 1
          ? '1 volcán en nivel 1 o más'
          : `${count} volcanes en nivel 1 o más`,
    noneElevated: 'Todos los volcanes de Nueva Zelanda en nivel 0',
    nothing: 'Ningún volcán seguido.',
    quake: ({ magnitude, mmi, where, time }) => `M${magnitude}, ${mmi}, ${where}, ${time}`,
    lastQuake: ({ text }) => `Último terremoto sentido: ${text}.`,
    noQuake: ({ km }) => `Ningún terremoto sentido reciente a menos de ${km} km`,
    depth: ({ km }) => `${km} km de profundidad`,
  },
};

// Connection status of the Configuration screen, and messages of the actions.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    geonetDown: 'GeoNet does not answer: the levels and earthquakes are not updated.',
    nothing:
      'Nothing to show: follow volcanoes, keep the New Zealand device or choose an earthquake radius.',
    noCenter:
      'No centre for the earthquakes and distances: give your house a location in Gladys (Settings, Houses) or type coordinates.',
    invalidCenter: 'The coordinates are not valid: the location of your house is used.',
    summary: ({ text, time }) => `${text} Checked at ${time}.`,
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    geonetDown: 'GeoNet ne répond pas : les niveaux et les séismes ne sont pas mis à jour.',
    nothing:
      "Rien à afficher : suivez des volcans, gardez l'appareil Nouvelle-Zélande ou choisissez un rayon pour les séismes.",
    noCenter:
      'Aucun centre pour les séismes et les distances : indiquez la position de votre maison dans Gladys (Paramètres, Maisons) ou saisissez des coordonnées.',
    invalidCenter:
      'Les coordonnées ne sont pas valides : la position de votre maison est utilisée.',
    summary: ({ text, time }) => `${text} Vérifié à ${time}.`,
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    geonetDown: 'GeoNet antwortet nicht: Stufen und Erdbeben werden nicht aktualisiert.',
    nothing:
      'Nichts anzuzeigen: Verfolge Vulkane, behalte das Gerät Neuseeland oder wähle einen Radius für die Erdbeben.',
    noCenter:
      'Kein Mittelpunkt für Erdbeben und Entfernungen: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser) oder trage Koordinaten ein.',
    invalidCenter: 'Die Koordinaten sind ungültig: Der Standort deines Hauses wird verwendet.',
    summary: ({ text, time }) => `${text} Geprüft um ${time}.`,
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    geonetDown: 'GeoNet no responde: los niveles y los terremotos no se actualizan.',
    nothing:
      'Nada que mostrar: siga volcanes, conserve el dispositivo Nueva Zelanda o elija un radio para los terremotos.',
    noCenter:
      'Sin centro para los terremotos y las distancias: indique la ubicación de su casa en Gladys (Ajustes, Casas) o introduzca coordenadas.',
    invalidCenter: 'Las coordenadas no son válidas: se usa la ubicación de su casa.',
    summary: ({ text, time }) => `${text} Comprobado a las ${time}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "20/11 16:36". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A time of day, e.g. "18:35". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "1 234" or "3,5". */
export function formatNumber(value, language, digits = 0) {
  return new Intl.NumberFormat(locale(language), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** "Level 2 / Yellow", in words. */
export function levelText(volcano, language) {
  const p = PHRASES[language];
  const level = volcano.level === null ? p.unrated : p.level({ level: volcano.level });
  const color = COLOR_NAMES[language][volcano.color];
  return color ? `${level} / ${color}` : level;
}

export const kmText = (distance, language) =>
  PHRASES[language].away({ km: formatNumber(Math.round(distance), language) });

/** "White Island: Level 2 / Yellow, 92 km away" (the distance when known). */
export function describe(volcano, language, name = volcano.name) {
  const where =
    volcano.distanceKm === null || volcano.distanceKm === undefined
      ? ''
      : `, ${kmText(volcano.distanceKm, language)}`;
  return `${PHRASES[language].item({ name, level: levelText(volcano, language) })}${where}`;
}

/** "M3.5, Weak, 10 km east of Taupō (44 km away), 20/11 16:36". */
export function quakeText(quake, language) {
  const away = quake.distanceKm === null ? '' : ` (${kmText(quake.distanceKm, language)})`;
  return PHRASES[language].quake({
    magnitude: quake.magnitude === null ? '?' : formatNumber(quake.magnitude, language, 1),
    mmi: `${mmiName(quake.mmi, language)} (MMI ${quake.mmi})`,
    where: `${quake.locality}${away}`,
    time: formatDate(quake.time, language),
  });
}

// Volcanoes named in one sentence: a scene that reads it aloud stays short.
export const SENTENCE_VOLCANOES = 5;

/**
 * The volcanoes as one sentence, e.g. "1 volcano at level 1 or more: White
 * Island: Level 2 / Yellow; Taupo: Level 0 / Green." Sorted already.
 */
export function sentence(volcanoes, language) {
  const p = PHRASES[language];
  if (volcanoes.length === 0) {
    return p.nothing;
  }
  const count = volcanoes.filter((volcano) => volcano.level > 0).length;
  const items = volcanoes
    .slice(0, SENTENCE_VOLCANOES)
    .map((volcano) => describe(volcano, language));
  const rest = volcanoes.length - SENTENCE_VOLCANOES;
  if (rest > 0) {
    items.push(p.more({ count: rest }));
  }
  return p.list({ head: p.elevated({ count }), items });
}
