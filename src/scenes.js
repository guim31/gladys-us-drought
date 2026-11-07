// -----------------------------------------------------------------------------
// Scene action (manifest `scene_actions`, Gladys 5.1+): `get_drought_summary`.
//
// Returns the latest map of a county in one sentence, ready for a
// notification, and its figures for the following actions of the scene. A
// scene action does not receive the user's language: the sentence is in the
// configured `language`.
// -----------------------------------------------------------------------------

import { AREA_KEYS, fipsOfExternalId } from './devices.js';
import { LEVEL_CODES } from './drought.js';
import { SUMMARY, dateText, fill, levelText, percentText } from './messages.js';

export const GET_DROUGHT_SUMMARY = 'get_drought_summary';

/** The sentence of a county's snapshot (see drought.js snapshotOf). */
export function summaryText(countyLabel, snapshot, language) {
  const texts = SUMMARY[language] ?? SUMMARY.fr;
  if (!snapshot) {
    return fill(texts.noData, { county: countyLabel });
  }
  const values = {
    county: countyLabel,
    date: dateText(snapshot.date, language),
    level: levelText(snapshot.level, language),
    share: percentText(snapshot.map.d1, language),
  };
  let sentence;
  if (snapshot.map.d1 > 0) {
    sentence = fill(texts.drought, values);
  } else if (snapshot.level > 0) {
    sentence = fill(texts.dry, values);
  } else {
    sentence = fill(texts.none, values);
  }
  const month = snapshot.month;
  if (month) {
    const kind = month.to > month.from ? 'worse' : month.to < month.from ? 'better' : 'same';
    sentence = `${sentence} ${texts[kind]}`;
  }
  return sentence;
}

export const SCENE_ACTIONS = {
  /**
   * @param {object} monitor
   * @param {object} fields { county?: device external id }
   */
  async [GET_DROUGHT_SUMMARY](monitor, fields = {}) {
    const language = monitor.config.language;
    const created = monitor.created();
    let fips = created[0] ?? null;
    if (typeof fields.county === 'string' && fields.county) {
      fips = fipsOfExternalId(monitor.gladys, fields.county);
      if (fips === null || !monitor.config.codes.includes(fips)) {
        throw new Error('This county is not followed by the integration');
      }
    }
    if (fips === null) {
      throw new Error('No county followed yet: create a device in the Discover tab');
    }
    const snapshot = monitor.freshSnapshot(fips);
    const name = monitor.deviceName(fips);
    const outputs = { summary: summaryText(name, snapshot, language), county_name: name };
    if (snapshot) {
      outputs.category = LEVEL_CODES[snapshot.level];
      outputs.drought_level = snapshot.level;
      outputs.map_date = dateText(snapshot.date, language);
      for (const key of AREA_KEYS) {
        outputs[key] = snapshot.map[key.slice(0, 2)];
      }
    }
    return outputs;
  },
};
