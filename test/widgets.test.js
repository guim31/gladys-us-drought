// -----------------------------------------------------------------------------
// The `drought` widget and the `get_drought_summary` scene action, against the
// fake Gladys: contents valid for the core, the picture served, the settings.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { exclusiveShares, HEIGHT, WIDTH } from '../src/png.js';
import { HARRIS, MIAMI, NEW_YORK, createWorld } from './helpers/world.js';

const deviceId = (world, fips) => world.gladys.externalIds('county', fips).device;

async function widget(world, options) {
  const ack = await world.fake.widgetGet('drought', options);
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), [], JSON.stringify(ack.data));
  return ack.data.content.components;
}

test('the widget shows the first county: name, picture, status lines, map date', async (t) => {
  const world = await createWorld({ created: [HARRIS, NEW_YORK] });
  t.after(() => world.cleanup());
  const components = await widget(world, { language: 'en' });
  assert.deepEqual(
    components.map((c) => c.type),
    ['text', 'image', 'status', 'text'],
  );
  assert.equal(components[0].text, `Device ${HARRIS}`);
  assert.equal(components[1].key, 'usdm-48201-20261103');
  const items = components[2].items;
  assert.deepEqual(
    items.map((i) => [i.label, i.value]),
    [
      ['Category', 'D3 · Extreme drought'],
      ['D1 or worse', '83.2%'],
      ['D2 or worse', '12.1%'],
      ['D3 or worse', '1.5%'],
      ['D4', '0%'],
      ['1 week', 'Unchanged (D3) · D1+ 0 pts'],
      ['4 weeks', 'D1 → D3, worse · D1+ +13.1 pts'],
    ],
  );
  assert.equal(items[0].color, 'danger');
  assert.equal(components[3].text, 'Map of Nov 3, 2026 · US Drought Monitor');

  // The picture: a valid PNG of the 16:9 frame.
  const image = await world.fake.widgetGetImage(components[1].key);
  assert.equal(image.success, true, image.error);
  const raw = typeof image.data === 'string' ? image.data : image.data.image;
  assert.deepEqual(validateWidgetImage(raw), []);
  const png = Buffer.from(raw, 'base64');
  assert.equal(png.readUInt32BE(16), WIDTH);
  assert.equal(png.readUInt32BE(20), HEIGHT);
  assert.equal((await world.fake.widgetGetImage('usdm-48201-20200101')).success, false);
});

test('the shares of the picture add up to the county', () => {
  const shares = exclusiveShares({ none: 49.74, d0: 50.26, d1: 29.03, d2: 16.95, d3: 0, d4: 0 });
  const total = shares.reduce((sum, [, share]) => sum + share, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('settings: chosen county, hidden picture, changes and caption; gone and empty', async (t) => {
  const world = await createWorld({
    created: [HARRIS, NEW_YORK],
    config: { counties: `${HARRIS}, ${NEW_YORK}` },
  });
  t.after(() => world.cleanup());
  const settings = {
    county: deviceId(world, NEW_YORK),
    show_picture: false,
    show_changes: false,
    show_source: false,
  };
  const components = await widget(world, { language: 'fr', settings });
  assert.deepEqual(
    components.map((c) => c.type),
    ['text', 'status'],
  );
  assert.equal(components[1].items.length, 5);
  assert.equal(components[1].items[0].value, 'Pas de sécheresse');
  assert.equal(components[1].items[0].color, 'success');

  const gone = await widget(world, { settings: { county: deviceId(world, MIAMI) } });
  assert.match(gone[0].text, /no longer followed/);
  for (const device of [...world.gladys.devices]) {
    world.fake.devices = world.fake.devices.filter((d) => d !== device);
    await world.fake.deviceDeleted(device);
  }
  const empty = await widget(world, { language: 'de' });
  assert.match(empty[0].text, /FIPS-Code/);
});

test('the scene action returns the county in one sentence and its figures', async (t) => {
  const world = await createWorld({
    created: [HARRIS, NEW_YORK],
    config: { counties: `${HARRIS}, ${NEW_YORK}`, language: 'en' },
  });
  t.after(() => world.cleanup());
  const ack = await world.fake.sceneAction('get_drought_summary', {});
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    summary: `Device ${HARRIS}, map of Nov 3, 2026: D3 · Extreme drought, 83.2% of the county in drought (D1+). Worse than 4 weeks ago.`,
    county_name: `Device ${HARRIS}`,
    category: 'D3',
    drought_level: 4,
    map_date: 'Nov 3, 2026',
    d1_area: 83.16,
    d2_area: 12.08,
    d3_area: 1.45,
    d4_area: 0,
  });
  const newYork = await world.fake.sceneAction('get_drought_summary', {
    county: deviceId(world, NEW_YORK),
  });
  assert.equal(
    newYork.data.outputs.summary,
    `Device ${NEW_YORK}, map of Nov 3, 2026: no drought. Same level as 4 weeks ago.`,
  );
  const other = await world.fake.sceneAction('get_drought_summary', {
    county: deviceId(world, MIAMI),
  });
  assert.equal(other.success, false);
});
