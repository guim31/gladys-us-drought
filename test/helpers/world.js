// -----------------------------------------------------------------------------
// Test world: the SDK's fake Gladys, the real wiring (src/app.js), and a fake
// fetch serving the real answers of the USDM data services recorded under
// test/fixtures/usdm/ (7 November 2026, latest map 2026-11-03): Harris County,
// Texas (48201, in drought), New York County (36061, no drought) and
// Miami-Dade County, Florida (12086, improving). No network.
//
// `state.latest` hides the maps after a date: the data as they were the weeks
// before, to see a new map arrive.
// -----------------------------------------------------------------------------

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { API_BASE } from '../../src/usdm.js';
import { Store } from '../../src/store.js';

const FIXTURES = new URL('../fixtures/usdm/', import.meta.url);

// Saturday 7 November 2026, 18:00 UTC: the map of Tuesday 3 November is out.
export const NOV_7 = Date.parse('2026-11-07T18:00:00Z');
export const LATEST_MAP = '2026-11-03';
export const HARRIS = '48201';
export const NEW_YORK = '36061';
export const MIAMI = '12086';

export function response(status, body = '') {
  return { status, headers: { get: () => null }, text: async () => body };
}

export async function fixtureRows(fips) {
  return JSON.parse(await readFile(new URL(`county-${fips}.json`, FIXTURES), 'utf8'));
}

// "11/7/2026" → "2026-11-07"
const isoOf = (text) => {
  const [month, day, year] = text.split('/').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * A fetch serving the fixtures (an empty list for any other county, like the
 * real service). `state.latest` can change during a test; `overrides` maps a
 * predicate on the URL to a response, for the error cases.
 */
export function fixtureFetch({ state = { latest: LATEST_MAP }, overrides = [], calls = [] } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    for (const [match, answer] of overrides) {
      if (match(url)) {
        return typeof answer === 'function' ? answer(url) : answer;
      }
    }
    if (!url.startsWith(`${API_BASE}/CountyStatistics/`)) {
      return response(404);
    }
    const params = new URL(url).searchParams;
    const from = isoOf(params.get('startdate'));
    const to = isoOf(params.get('enddate'));
    const all = await fixtureRows(params.get('aoi')).catch(() => []);
    const rows = all.filter((row) => {
      const date = row.mapDate.slice(0, 10);
      return date >= from && date <= to && date <= state.latest;
    });
    return response(200, JSON.stringify(rows));
  };
}

/** A device of the fake Gladys, as the user created it. */
export function createdDevice(gladys, fips, name = `Device ${fips}`) {
  return { name, external_id: gladys.externalIds('county', fips).device, features: [] };
}

/**
 * Starts the integration against the fake Gladys.
 * @param {object} [options]
 * @param {object} [options.config] integration configuration
 * @param {string[]} [options.created] FIPS codes whose device the user created
 * @param {Function} [options.fetch]
 * @param {object} [options.clock] { now } mutable clock
 * @param {string} [options.dataDir] reuse a /data directory (restart)
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  config = { counties: `${HARRIS}, ${NEW_YORK}, ${MIAMI}` },
  created = [],
  fetch = fixtureFetch(),
  clock = { now: NOV_7 },
  dataDir,
  timers = false,
} = {}) {
  const directory = dataDir ?? (await mkdtemp(join(tmpdir(), 'gladys-us-drought-')));
  const gladys = createFakeGladys({ config });
  gladys.fake.devices = created.map((fips) => createdDevice(gladys, fips));
  const app = registerHandlers(gladys, {
    store: new Store(directory),
    fetch,
    timers,
    now: () => clock.now,
  });
  await gladys.connect();
  await app.ready;
  return {
    gladys,
    fake: gladys.fake,
    app,
    monitor: app.monitor,
    clock,
    directory,
    async cleanup() {
      await app.stop();
      if (!dataDir) {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

/** Captures what the SDK logger writes (console.log / console.error) at `level`. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
