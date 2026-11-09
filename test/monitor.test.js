// -----------------------------------------------------------------------------
// The monitor against the SDK's fake Gladys and the recorded USDM answers:
// discovery, states, schedule of the reads, triggers, failures, restart.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/messages.js';
import { CYCLE_MS } from '../src/monitor.js';
import {
  HARRIS,
  MIAMI,
  NEW_YORK,
  NOV_7,
  createWorld,
  createdDevice,
  fixtureFetch,
  response,
} from './helpers/world.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const featureId = (world, fips, key) => world.gladys.externalIds('county', fips).feature(key);

test('one device per known county, named after the USDM, polled by the container', async (t) => {
  const world = await createWorld({ config: { counties: `${HARRIS}, 99999, ${NEW_YORK}` } });
  t.after(() => world.cleanup());
  const devices = world.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => d.name),
    ['Harris County, TX', 'New York County, NY'],
  );
  for (const device of devices) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
  // The unknown code is said in the connection status, in four languages.
  const status = world.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message), ['en', 'fr', 'de', 'es']);
  assert.match(status.message.en, /99999/);
});

test('the states of a created county: level, shares, changes, map date', async (t) => {
  const world = await createWorld({
    created: [HARRIS, NEW_YORK],
    config: { counties: `${HARRIS}, ${NEW_YORK}`, language: 'en' },
  });
  t.after(() => world.cleanup());
  const last = (fips, key) => world.fake.lastState(featureId(world, fips, key));
  assert.equal(last(HARRIS, 'level'), 4);
  assert.equal(last(HARRIS, 'level_text'), 'D3 · Extreme drought');
  assert.equal(last(HARRIS, 'd1_area'), 83.16);
  assert.equal(last(HARRIS, 'd3_area'), 1.45);
  assert.equal(last(HARRIS, 'd4_area'), 0);
  assert.equal(last(HARRIS, 'change_4w'), 'D1 → D3, worse · D1+ +13.1 pts');
  assert.equal(last(HARRIS, 'map_date'), 'Nov 3, 2026');
  assert.equal(last(NEW_YORK, 'level'), 0);
  assert.equal(last(NEW_YORK, 'level_text'), 'No drought');
  assert.equal(world.fake.connectionStatus.connected, true);
  // A county not created publishes nothing.
  assert.equal(last(MIAMI, 'level'), undefined);
});

test('everything is published again when a device is created', async (t) => {
  const world = await createWorld();
  t.after(() => world.cleanup());
  assert.equal(world.fake.states.length, 0);
  const device = createdDevice(world.gladys, HARRIS);
  world.fake.devices = [device];
  await world.fake.deviceCreated(device);
  assert.equal(world.fake.states.length, 9);
  assert.ok(world.fake.widgetRefreshes.includes('drought'));
  // Created again (deleted then re-added): published again, not deduplicated.
  await world.fake.deviceCreated(device);
  assert.equal(world.fake.states.length, 18);
});

test('a county is read once a day, and every 3 hours once its next map is due', async (t) => {
  const calls = [];
  const world = await createWorld({ fetch: fixtureFetch({ calls }), config: { counties: HARRIS } });
  t.after(() => world.cleanup());
  assert.equal(calls.length, 1);
  for (let i = 0; i < 23; i += 1) {
    world.clock.now += HOUR;
    await world.monitor.runCycle();
  }
  assert.equal(calls.length, 1);
  world.clock.now += HOUR;
  await world.monitor.runCycle();
  assert.equal(calls.length, 2);
  // Thursday 12 November, 14:00 UTC: the map of 10 November is due.
  world.clock.now = Date.parse('2026-11-12T14:00:00Z');
  await world.monitor.runCycle(); // more than 3 h since the last read
  assert.equal(calls.length, 3);
  world.clock.now += 2 * HOUR;
  await world.monitor.runCycle();
  assert.equal(calls.length, 3);
  world.clock.now += HOUR;
  await world.monitor.runCycle();
  assert.equal(calls.length, 4);
});

test('the container refreshes on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const calls = [];
  const clock = { now: NOV_7 };
  const world = await createWorld({
    fetch: fixtureFetch({ calls }),
    config: { counties: HARRIS },
    created: [HARRIS],
    timers: true,
    clock,
  });
  t.after(() => world.cleanup());
  assert.equal(calls.length, 1);
  clock.now += DAY;
  t.mock.timers.tick(CYCLE_MS);
  await world.monitor.running;
  assert.equal(calls.length, 2);
});

test('triggers: worse, levels reached, better; never on the first map', async (t) => {
  const state = { latest: '2026-10-20' };
  const world = await createWorld({
    fetch: fixtureFetch({ state }),
    created: [HARRIS, MIAMI],
    config: { counties: `${HARRIS}, ${MIAMI}`, threshold: '25', language: 'en' },
    clock: { now: Date.parse('2026-10-24T18:00:00Z') },
  });
  t.after(() => world.cleanup());
  assert.deepEqual(world.fake.sceneEvents, []);
  // At 25 %, from the map of 20 October to the one of 3 November: Harris
  // stays D1 (D2 12 %), Miami-Dade falls from D2 (28.75 %) to D1 (16.95 %).
  state.latest = '2026-11-03';
  world.clock.now = NOV_7;
  await world.monitor.runCycle();
  const events = world.fake.sceneEvents;
  assert.deepEqual(
    events.map((e) => e.key),
    ['drought_improved'],
  );
  const miami = world.gladys.externalIds('county', MIAMI).device;
  assert.deepEqual(events[0].data, {
    county: miami,
    county_name: `Device ${MIAMI}`,
    category: 'D1',
    previous_category: 'D2',
    category_name: 'D1 · Moderate drought',
    drought_level: 2,
    d1_area: 29.03,
    map_date: 'Nov 3, 2026',
  });
});

test('a level rising by two fires worse and one event per level crossed', async (t) => {
  const state = { latest: '2026-10-20' };
  const world = await createWorld({
    fetch: fixtureFetch({ state }),
    created: [HARRIS],
    config: { counties: HARRIS, threshold: '0' },
    clock: { now: Date.parse('2026-10-24T18:00:00Z') },
  });
  t.after(() => world.cleanup());
  // 20 October at any share: D2. Change the threshold to 1 %: still D2, nothing.
  await world.fake.configUpdated({ counties: HARRIS, threshold: '1' });
  assert.deepEqual(world.fake.sceneEvents, []);
  // Threshold at 25 %: D1, the reference follows without firing.
  await world.fake.configUpdated({ counties: HARRIS, threshold: '25' });
  assert.deepEqual(world.fake.sceneEvents, []);
  // Back to any share, and the map of 27 October (D3 1.45 %): D1 → D3.
  await world.fake.configUpdated({ counties: HARRIS, threshold: '0' });
  assert.deepEqual(world.fake.sceneEvents, []);
  state.latest = '2026-10-27';
  world.clock.now = Date.parse('2026-10-31T18:00:00Z');
  await world.monitor.runCycle();
  const events = world.fake.sceneEvents;
  assert.deepEqual(
    events.map((e) => [e.key, e.data.level]),
    [
      ['drought_worsened', undefined],
      ['drought_level_reached', 'D3'],
    ],
  );
  assert.equal(events[0].data.previous_category, 'D2');
  assert.equal(events[0].data.category, 'D3');
  // The same map read again fires nothing.
  world.clock.now += DAY;
  await world.monitor.runCycle();
  assert.equal(world.fake.sceneEvents.length, 2);
});

test('the source down: status in four languages, one retry per hour, nothing invented', async (t) => {
  const calls = [];
  const world = await createWorld({
    fetch: fixtureFetch({ calls, overrides: [[() => true, response(503)]] }),
    created: [HARRIS],
  });
  t.after(() => world.cleanup());
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: STATUS.sourceDown });
  assert.deepEqual(world.fake.discoveredDevices, []);
  assert.deepEqual(world.fake.states, []);
  const before = calls.length;
  // A reconfiguration right after does not ask again.
  await world.fake.configUpdated({ counties: `${HARRIS}, ${NEW_YORK}, ${MIAMI}` });
  assert.equal(calls.length, before);
  world.clock.now += HOUR;
  await world.monitor.runCycle();
  assert.equal(calls.length, 2 * before);
});

test('a map older than three weeks is no longer published', async (t) => {
  const world = await createWorld({ created: [HARRIS], config: { counties: HARRIS } });
  t.after(() => world.cleanup());
  const published = world.fake.states.length;
  assert.ok(published > 0);
  // The service now answers 503 for weeks: the map of 3 November is shown
  // for 21 days, then no longer kept alive.
  world.monitor.client.fetch = async () => response(503);
  world.gladys.forgetPublishedStates();
  world.clock.now = Date.parse('2026-11-23T18:00:00Z');
  await world.monitor.runCycle();
  assert.ok(world.fake.states.length > published, 'still shown within 3 weeks');
  const shown = world.fake.states.length;
  world.gladys.forgetPublishedStates();
  world.clock.now = Date.parse('2026-11-24T18:00:00Z');
  await world.monitor.runCycle();
  assert.equal(world.fake.states.length, shown);
});

test('a restart reads nothing for a day and publishes the saved maps', async (t) => {
  const first = await createWorld({ created: [HARRIS], config: { counties: HARRIS } });
  await first.app.stop();
  const calls = [];
  const second = await createWorld({
    created: [HARRIS],
    config: { counties: HARRIS },
    fetch: fixtureFetch({ calls }),
    dataDir: first.directory,
    clock: { now: NOV_7 + 2 * HOUR },
  });
  t.after(async () => {
    await second.cleanup();
    await first.cleanup();
  });
  assert.equal(calls.length, 0);
  assert.equal(second.fake.lastState(featureId(second, HARRIS, 'level')), 4);
});

test('a cycle that skips a county that just failed keeps the failure status', async (t) => {
  let down = false;
  const fetch = fixtureFetch({ overrides: [[() => down, () => response(503)]] });
  const world = await createWorld({ created: [HARRIS], config: { counties: HARRIS }, fetch });
  t.after(() => world.cleanup());
  down = true;
  world.clock.now += DAY;
  await world.monitor.runCycle();
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: STATUS.sourceDown });
  const count = world.fake.connectionStatuses.length;
  world.clock.now += 20 * 60 * 1000;
  await world.fake.configUpdated({ counties: HARRIS, language: 'en' });
  assert.equal(world.fake.connectionStatuses.length, count);
  down = false;
  world.clock.now += HOUR;
  await world.monitor.runCycle();
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a threshold changed while a new map arrives fires nothing', async (t) => {
  const state = { latest: '2026-10-27' };
  const world = await createWorld({
    fetch: fixtureFetch({ state }),
    created: [MIAMI],
    config: { counties: MIAMI, threshold: '1' },
    clock: { now: Date.parse('2026-10-31T18:00:00Z') },
  });
  t.after(() => world.cleanup());
  // 27 October at 1 %: D2. New map (D2 16.95 %) read with a threshold of
  // 25 % (D1): the levels are not comparable, nothing improved.
  state.latest = '2026-11-03';
  world.clock.now = NOV_7;
  await world.fake.configUpdated({ counties: MIAMI, threshold: '25' });
  assert.deepEqual(world.fake.sceneEvents, []);
});
