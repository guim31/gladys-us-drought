// -----------------------------------------------------------------------------
// What a county's maps say: the drought level (the strongest category covering
// at least the threshold share of the county), the share of the county in each
// category, and the change over 1 and 4 weeks.
//
// Levels, the state of the `level` feature and of the scene variables:
//   0 no drought, 1 D0 abnormally dry, 2 D1 moderate, 3 D2 severe,
//   4 D3 extreme, 5 D4 exceptional.
// D0 is not a drought for the USDM (it is "going into or coming out of"
// drought), but it is a category of its map, hence a level of its own.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
export const LEVEL_CODES = ['none', 'D0', 'D1', 'D2', 'D3', 'D4'];
export const MAX_LEVEL = LEVEL_CODES.length - 1;

/** The level of a map at a threshold (percent of the county area). */
export function levelOf(map, threshold) {
  for (let category = 4; category >= 0; category -= 1) {
    const share = map[`d${category}`];
    if (threshold === 0 ? share > 0 : share >= threshold) {
      return category + 1;
    }
  }
  return 0;
}

const dayOf = (date) => Date.parse(`${date}T00:00:00Z`);

/** The map drawn `weeks` weeks before `date`, if read. */
function mapBefore(maps, date, weeks) {
  const target = dayOf(date) - weeks * 7 * DAY_MS;
  return maps.find((map) => dayOf(map.date) === target) ?? null;
}

function change(maps, latest, weeks, threshold) {
  const before = mapBefore(maps, latest.date, weeks);
  if (!before) {
    return null;
  }
  return {
    from: levelOf(before, threshold),
    to: levelOf(latest, threshold),
    // Change of the share in drought (D1 or worse), in percentage points.
    points: Math.round((latest.d1 - before.d1) * 100) / 100,
  };
}

/**
 * The snapshot of a county, or null without a map.
 * @param {object|undefined} county see usdm.js parseCounty
 * @param {number} threshold
 */
export function snapshotOf(county, threshold) {
  const latest = county?.maps?.[0];
  if (!latest) {
    return null;
  }
  return {
    date: latest.date,
    level: levelOf(latest, threshold),
    map: latest,
    week: change(county.maps, latest, 1, threshold),
    month: change(county.maps, latest, 4, threshold),
  };
}

/** Milliseconds since the Tuesday of a map. */
export function mapAge(date, now) {
  return now - dayOf(date);
}

/**
 * When the map after `date` is due: its Thursday, 8:30 a.m. in Washington
 * (12:30 or 13:30 UTC), plus a margin. Before, there is nothing new to read.
 */
export function nextMapDue(date) {
  return dayOf(date) + 9 * DAY_MS + 14 * 3600 * 1000;
}
