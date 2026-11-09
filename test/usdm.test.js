// -----------------------------------------------------------------------------
// The USDM client and the reading of the maps, on the real answers recorded
// on 7 November 2026 (test/fixtures/usdm/).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseCounties } from '../src/config.js';
import { levelOf, nextMapDue, snapshotOf } from '../src/drought.js';
import { changeText, dateText, levelText, percentText } from '../src/messages.js';
import { apiDate, countyUrl, parseCounty, SourceError, UsdmClient } from '../src/usdm.js';
import { HARRIS, MIAMI, NEW_YORK, NOV_7, fixtureRows, response } from './helpers/world.js';

const county = async (fips) => parseCounty(await fixtureRows(fips), fips);

test('the request asks six weeks of cumulative county statistics in JSON', async () => {
  assert.equal(apiDate(NOV_7), '11/7/2026');
  const url = new URL(countyUrl(HARRIS, NOV_7));
  assert.equal(url.pathname, '/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    aoi: HARRIS,
    startdate: '9/19/2026',
    enddate: '11/7/2026',
    statisticsType: '1',
  });
  const calls = [];
  const client = new UsdmClient({
    fetch: async (u, options) => {
      calls.push(options);
      return response(200, JSON.stringify(await fixtureRows(HARRIS)));
    },
    now: () => NOV_7,
  });
  const result = await client.county(HARRIS);
  assert.equal(calls[0].headers.Accept, 'application/json');
  assert.equal(result.name, 'Harris County');
  assert.equal(result.state, 'TX');
  assert.equal(result.maps.length, 7);
  assert.deepEqual(result.maps[0], {
    date: '2026-11-03',
    none: 0,
    d0: 100,
    d1: 83.16,
    d2: 12.08,
    d3: 1.45,
    d4: 0,
  });
});

test('an unknown county is an empty list (null), errors are SourceErrors', async () => {
  assert.equal(parseCounty([], '99999'), null);
  const fails = async (answer) => {
    const client = new UsdmClient({ fetch: async () => answer, now: () => NOV_7 });
    await assert.rejects(client.county(HARRIS), SourceError);
  };
  await fails(response(500));
  await fails(response(200, '<html>'));
  await fails(response(200, '{"message":"error"}'));
  await fails(response(200, JSON.stringify([{ fips: HARRIS, mapDate: 'x' }])));
  const offline = new UsdmClient({
    fetch: async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    },
  });
  await assert.rejects(offline.county(HARRIS), /unreachable/);
});

test('the level is the strongest category covering the threshold share', async () => {
  const harris = (await county(HARRIS)).maps[0]; // D3 1.45 %, D2 12.08 %
  assert.equal(levelOf(harris, 0), 4);
  assert.equal(levelOf(harris, 1), 4);
  assert.equal(levelOf(harris, 5), 3);
  assert.equal(levelOf(harris, 25), 2);
  assert.equal(levelOf((await county(NEW_YORK)).maps[0], 0), 0);
  const miami = (await county(MIAMI)).maps[0]; // D0 50.26, D1 29.03, D2 16.95
  assert.equal(levelOf(miami, 1), 3);
  assert.equal(levelOf(miami, 50), 1);
});

test('the snapshot compares with the maps of 1 and 4 weeks before', async () => {
  const harris = snapshotOf(await county(HARRIS), 1);
  assert.equal(harris.date, '2026-11-03');
  assert.deepEqual(harris.week, { from: 4, to: 4, points: 0 });
  // 6 October: D1 70.09 %, no D2.
  assert.deepEqual(harris.month, { from: 2, to: 4, points: 13.07 });
  assert.equal(changeText(harris.month, 'en'), 'D1 → D3, worse · D1+ +13.1 pts');
  assert.equal(changeText(harris.month, 'fr'), 'D1 → D3, pire · D1+ +13,1 pts');
  assert.equal(changeText(harris.week, 'de'), 'Unverändert (D3) · D1+ 0 Pkt.');
  const miami = snapshotOf(await county(MIAMI), 25);
  assert.deepEqual(miami.week, { from: 3, to: 2, points: -43.51 });
  assert.equal(changeText(miami.week, 'es'), 'D2 → D1, mejora · D1+ -43,5 pts');
  const newYork = snapshotOf(await county(NEW_YORK), 1);
  assert.equal(changeText(newYork.week, 'fr'), 'Inchangé (aucune) · D1+ 0 pts');
  assert.equal(snapshotOf(undefined, 1), null);
});

test('the texts of a level, a date and a share', () => {
  assert.equal(levelText(0, 'en'), 'No drought');
  assert.equal(levelText(4, 'fr'), 'D3 · Sécheresse extrême');
  assert.equal(levelText(5, 'de'), 'D4 · Außergewöhnliche Dürre');
  assert.equal(dateText('2026-11-03', 'en'), 'Nov 3, 2026');
  assert.equal(dateText('2026-11-03', 'fr'), '3 nov. 2026');
  assert.equal(percentText(83.16, 'en'), '83.2%');
  assert.equal(percentText(83.16, 'fr'), '83,2 %');
});

test('the next map is due on the Thursday after next Tuesday, in the afternoon UTC', () => {
  assert.equal(new Date(nextMapDue('2026-11-03')).toISOString(), '2026-11-12T14:00:00.000Z');
});

test('the configuration accepts FIPS codes typed by hand', () => {
  assert.deepEqual(parseCounties('48201, 6037;36061 48201 abc 00123 48000'), [
    '48201',
    '06037',
    '36061',
  ]);
  assert.deepEqual(parseCounties(undefined), []);
  assert.equal(parseCounties(Array.from({ length: 12 }, (_, i) => 48001 + 2 * i)).length, 10);
  assert.deepEqual(normalizeConfig({}), { codes: [], threshold: 1, language: 'fr' });
  assert.deepEqual(normalizeConfig({ counties: '48201', threshold: '25', language: 'xx' }), {
    codes: ['48201'],
    threshold: 25,
    language: 'fr',
  });
  assert.equal(normalizeConfig({ threshold: '7' }).threshold, 1);
});
