// -----------------------------------------------------------------------------
// Client of the data services of the US Drought Monitor (National Drought
// Mitigation Center, USDA, NOAA): https://usdmdataservices.unl.edu/api/, no
// key, JSON when asked by the Accept header.
//
// One request per county: the county statistics in percent of area,
// cumulative (`statisticsType=1`: D1 is "D1 or worse"), one row per weekly
// map. The map is drawn with the data of Tuesday (`mapDate`) and published on
// Thursday. No documented quota: requests are sequential, and a county is read
// once a day at most (more often only when a new map is due, see monitor.js).
// -----------------------------------------------------------------------------

export const API_BASE = 'https://usdmdataservices.unl.edu/api';
const PATH = '/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent';
const TIMEOUT_MS = 30 * 1000;
const DAY_MS = 24 * 3600 * 1000;
// Seven weeks back from today: the latest map (up to 9 days old on a
// Wednesday, more when a map is late) and the one 4 weeks before it.
export const WINDOW_DAYS = 49;

export class SourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceError';
  }
}

/** "11/7/2026": the date format the API expects (month/day/year). */
export function apiDate(ms) {
  const date = new Date(ms);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

/** The request URL of a county, for the weeks up to `now`. */
export function countyUrl(fips, now) {
  const params = new URLSearchParams({
    aoi: fips,
    startdate: apiDate(now - WINDOW_DAYS * DAY_MS),
    enddate: apiDate(now),
    statisticsType: '1',
  });
  return `${API_BASE}${PATH}?${params}`;
}

const percent = (value) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 100.01
    ? Math.min(100, Math.round(number * 100) / 100)
    : null;
};

/**
 * The rows of a county answer: { name, state, maps: [{ date, none, d0..d4 }] },
 * the maps newest first, d0..d4 cumulative percents. An empty answer is an
 * unknown county (null); malformed rows are skipped.
 */
export function parseCounty(body, fips) {
  if (!Array.isArray(body)) {
    throw new SourceError('unexpected answer of the USDM data services (not a list)');
  }
  const maps = new Map();
  let name = null;
  let state = null;
  for (const row of body) {
    if (String(row?.fips ?? '') !== fips) {
      continue;
    }
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(String(row.mapDate ?? ''))?.[1];
    const values = ['none', 'd0', 'd1', 'd2', 'd3', 'd4'].map((key) => percent(row[key]));
    if (!date || values.includes(null)) {
      continue;
    }
    const [none, d0, d1, d2, d3, d4] = values;
    maps.set(date, { date, none, d0, d1, d2, d3, d4 });
    if (typeof row.county === 'string' && row.county.trim()) {
      name = row.county.trim().slice(0, 40);
    }
    if (typeof row.state === 'string' && /^[A-Z]{2}$/.test(row.state)) {
      state = row.state;
    }
  }
  if (maps.size === 0) {
    if (body.length === 0) {
      return null;
    }
    throw new SourceError('unexpected answer of the USDM data services (no valid row)');
  }
  return {
    name: name ?? `County ${fips}`,
    state,
    maps: [...maps.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export class UsdmClient {
  /**
   * @param {object} options
   * @param {Function} [options.fetch]
   * @param {Function} [options.now] clock (ms)
   */
  constructor({ fetch, now } = {}) {
    this.fetch = fetch ?? globalThis.fetch;
    this.now = now ?? (() => Date.now());
  }

  /** The recent maps of a county; null if the USDM does not know it. */
  async county(fips) {
    let res;
    try {
      res = await this.fetch(countyUrl(fips, this.now()), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new SourceError(`USDM data services unreachable (${err.message})`);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new SourceError(`USDM data services answered HTTP ${res.status}`);
    }
    let body;
    try {
      body = JSON.parse(await res.text());
    } catch {
      throw new SourceError('USDM data services answered something that is not JSON');
    }
    return parseCounty(body, fips);
  }
}
