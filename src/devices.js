// -----------------------------------------------------------------------------
// One Gladys device per followed county (5-digit FIPS code, the platform id).
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - level: risk/integer, 0 (no drought) to 5 (D4), see drought.js;
//   - level_text: text/text, "D2 · Severe drought";
//   - d1_area, d2_area, d3_area, d4_area: level-sensor/liquid-level-percent,
//     share of the county in D1 or worse, D2 or worse, D3 or worse, D4 (the
//     generic percent sensor of Gladys);
//   - change_1w, change_4w: text/text, level change and D1+ change;
//   - map_date: text/text, the Tuesday the map describes.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { MAX_LEVEL } from './drought.js';
import { changeText, dateText, levelText } from './messages.js';

export const DEVICE_TYPE = 'county';
export const AREA_KEYS = ['d1_area', 'd2_area', 'd3_area', 'd4_area'];
export const FEATURE_KEYS = [
  'level',
  'level_text',
  ...AREA_KEYS,
  'change_1w',
  'change_4w',
  'map_date',
];

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    level: 'Drought level (0–5)',
    level_text: 'Drought category',
    d1_area: 'Area in D1 or worse',
    d2_area: 'Area in D2 or worse',
    d3_area: 'Area in D3 or worse',
    d4_area: 'Area in D4',
    change_1w: 'Change over 1 week',
    change_4w: 'Change over 4 weeks',
    map_date: 'Map date',
  },
  fr: {
    level: 'Niveau de sécheresse (0–5)',
    level_text: 'Catégorie de sécheresse',
    d1_area: 'Surface en D1 ou pire',
    d2_area: 'Surface en D2 ou pire',
    d3_area: 'Surface en D3 ou pire',
    d4_area: 'Surface en D4',
    change_1w: 'Évolution sur 1 semaine',
    change_4w: 'Évolution sur 4 semaines',
    map_date: 'Date de la carte',
  },
  de: {
    level: 'Dürrestufe (0–5)',
    level_text: 'Dürrekategorie',
    d1_area: 'Fläche in D1 oder schlimmer',
    d2_area: 'Fläche in D2 oder schlimmer',
    d3_area: 'Fläche in D3 oder schlimmer',
    d4_area: 'Fläche in D4',
    change_1w: 'Änderung in 1 Woche',
    change_4w: 'Änderung in 4 Wochen',
    map_date: 'Datum der Karte',
  },
  es: {
    level: 'Nivel de sequía (0–5)',
    level_text: 'Categoría de sequía',
    d1_area: 'Superficie en D1 o peor',
    d2_area: 'Superficie en D2 o peor',
    d3_area: 'Superficie en D3 o peor',
    d4_area: 'Superficie en D4',
    change_1w: 'Evolución en 1 semana',
    change_4w: 'Evolución en 4 semanas',
    map_date: 'Fecha del mapa',
  },
};

/** Feature name in a language. */
export function featureName(key, language) {
  return (NAMES[language] ?? NAMES.fr)[key];
}

/** External ids of a county device and of its features. */
export function countyIds(gladys, fips) {
  const ids = gladys.externalIds(DEVICE_TYPE, String(fips));
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

/** The FIPS code of a device or feature external id (null if not ours). */
export function fipsOfExternalId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const fips = externalId.slice(prefix.length).split(':')[0];
  return /^\d{5}$/.test(fips) ? fips : null;
}

/** "Harris County, TX". */
export function countyName(county, fips) {
  if (!county) {
    return `County ${fips}`;
  }
  return county.state ? `${county.name}, ${county.state}` : county.name;
}

function feature(key, ids, language) {
  const base = {
    name: featureName(key, language),
    external_id: ids[key],
    read_only: true,
    has_feedback: false,
  };
  if (key === 'level') {
    return {
      ...base,
      category: CATEGORIES.RISK,
      type: TYPES.RISK.INTEGER,
      keep_history: true,
      min: 0,
      max: MAX_LEVEL,
    };
  }
  if (AREA_KEYS.includes(key)) {
    return {
      ...base,
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT,
      unit: UNITS.PERCENT,
      keep_history: true,
      min: 0,
      max: 100,
    };
  }
  return {
    ...base,
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    keep_history: false,
    min: 0,
    max: 0,
  };
}

/** The discovery payload of a county. */
export function buildDevice(gladys, fips, county, language = 'fr') {
  const ids = countyIds(gladys, fips);
  return {
    name: countyName(county, fips),
    external_id: ids.device,
    model: 'US Drought Monitor',
    should_poll: false,
    params: [{ name: 'FIPS', value: String(fips) }],
    features: FEATURE_KEYS.map((key) => feature(key, ids, language)),
  };
}

/**
 * States of a county device; nothing without a map (values are not invented).
 * @param {object} gladys
 * @param {string} fips
 * @param {object|null} snapshot see drought.js snapshotOf
 * @param {string} language
 */
export function deviceStates(gladys, fips, snapshot, language) {
  if (!snapshot) {
    return [];
  }
  const ids = countyIds(gladys, fips);
  const states = [
    { device_feature_external_id: ids.level, state: snapshot.level },
    { device_feature_external_id: ids.level_text, text: levelText(snapshot.level, language) },
  ];
  for (const key of AREA_KEYS) {
    states.push({ device_feature_external_id: ids[key], state: snapshot.map[key.slice(0, 2)] });
  }
  for (const [key, change] of [
    ['change_1w', snapshot.week],
    ['change_4w', snapshot.month],
  ]) {
    const text = changeText(change, language);
    if (text) {
      states.push({ device_feature_external_id: ids[key], text });
    }
  }
  states.push({
    device_feature_external_id: ids.map_date,
    text: dateText(snapshot.date, language),
  });
  return states;
}
