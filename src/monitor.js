// -----------------------------------------------------------------------------
// The heart of the integration: reads the followed counties, publishes the
// states of the created devices, fires the scene triggers and keeps the
// connection status.
//
// Requests (one per county): a county is read once a day, and every 3 hours
// from the moment its next weekly map is due (Thursday, see drought.js) until
// it is there. A failed read waits for the next hourly cycle; an unknown FIPS
// code is asked again once a day. The maps, the read times and the trigger
// references survive restarts (src/store.js).
//
// Triggers, on a map newer than the last one seen for a county (never on the
// very first one, which only sets the reference), comparing the levels:
//   - drought_worsened / drought_improved: the level went up / down;
//   - drought_level_reached: one event per level crossed upwards.
// A threshold change only moves the reference, it fires nothing.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat
// every 12 hours (Gladys shows "no recent value" after 48 hours), and nothing
// once the latest map is more than 3 weeks old (the source is down: the values
// are not kept alive). Everything is published again in onDeviceCreated, and
// on a reconnection.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildDevice, countyIds, countyName, deviceStates, fipsOfExternalId } from './devices.js';
import { LEVEL_CODES, mapAge, nextMapDue, snapshotOf } from './drought.js';
import { dateText, fill, levelText, STATUS } from './messages.js';
import { drawShares } from './png.js';
import { UsdmClient } from './usdm.js';

const logger = createLogger({ name: 'us-drought-monitor' });

export const WIDGET_KEY = 'drought';
export const TRIGGERS = {
  WORSENED: 'drought_worsened',
  IMPROVED: 'drought_improved',
  LEVEL_REACHED: 'drought_level_reached',
};
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const CYCLE_MS = HOUR;
export const HEARTBEAT_MS = 12 * HOUR;
const DAILY_MS = DAY;
const DUE_RETRY_MS = 3 * HOUR;
// A cycle triggered by a reconfiguration does not ask again a county that
// just failed: it waits for the hourly cycle.
const FAILED_RETRY_MS = 50 * MINUTE;
const STALE_MS = 21 * DAY;
const MAX_REFERENCE_GAP_MS = 21 * DAY;
// requestWidgetRefresh is rate-limited to one call every 10 s by the core.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;

/** Image key of a county's map: changes with the map, as the core caches images by key. */
export function imageKey(fips, date) {
  return `usdm-${fips}-${date.replaceAll('-', '')}`;
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store see store.js
   * @param {Function} [options.fetch]
   * @param {boolean} [options.timers] false in tests: no interval, no delayed refresh
   * @param {Function} [options.now] clock (ms)
   */
  constructor({ gladys, store, fetch, timers = true, now }) {
    this.gladys = gladys;
    this.store = store;
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.client = new UsdmClient({ fetch, now: this.now });
    this.config = { codes: [], threshold: 1, language: 'fr' };
    // fips → { name, state, maps, fetchedAt }
    this.counties = {};
    // fips → time the USDM answered it does not know the code
    this.unknown = {};
    // fips → time of the last failed read
    this.failedAt = {};
    // fips → { date, level, threshold }: the reference of the triggers
    this.seen = {};
    this.lastCycleAt = null;
    this.running = null;
    this.failing = null; // null, 'source' or 'unknown'
    this.failingCodes = '';
    this.statusPublished = false;
    this.cycleTimer = null;
    this.refreshTimer = null;
    this.lastWidgetRefresh = 0;
  }

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    for (const [fips, county] of Object.entries(saved.counties ?? {})) {
      if (
        /^\d{5}$/.test(fips) &&
        Array.isArray(county?.maps) &&
        Number.isFinite(county.fetchedAt)
      ) {
        this.counties[fips] = county;
      }
    }
    for (const [fips, at] of Object.entries(saved.unknown ?? {})) {
      if (Number.isFinite(at)) {
        this.unknown[fips] = at;
      }
    }
    for (const [fips, entry] of Object.entries(saved.seen ?? {})) {
      if (
        typeof entry?.date === 'string' &&
        Number.isInteger(entry?.level) &&
        Number.isFinite(entry?.threshold)
      ) {
        this.seen[fips] = entry;
      }
    }
    await this.publishDiscovered();
    await this.publishStates(this.created());
    await this.runCycle();
    if (this.timers && !this.cycleTimer) {
      this.cycleTimer = setInterval(() => this.runCycle(), CYCLE_MS);
      this.cycleTimer.unref?.();
    }
  }

  /** Gladys restarted: publish the devices and every state again. */
  async resync(config) {
    this.config = config;
    this.gladys.forgetPublishedStates();
    this.statusPublished = false;
    await this.publishDiscovered();
    await this.publishStates(this.created());
    await this.publishStatus();
  }

  async reconfigure(config) {
    const changed =
      config.language !== this.config.language || config.threshold !== this.config.threshold;
    this.config = config;
    if (changed) {
      this.gladys.forgetPublishedStates();
    }
    await this.publishDiscovered();
    // A cycle in progress still uses the old configuration: one more after it
    // (it reads only the counties added).
    await this.running;
    await this.runCycle();
    this.refreshWidget();
  }

  /** The counties of the configuration the USDM answered for. */
  known() {
    return this.config.codes.filter((fips) => this.counties[fips]);
  }

  async publishDiscovered() {
    const devices = this.known().map((fips) =>
      buildDevice(this.gladys, fips, this.counties[fips], this.config.language),
    );
    await this.gladys.publishDiscoveredDevices(devices);
  }

  /** FIPS codes of the counties whose device the user created, in configuration order. */
  created() {
    const codes = [];
    for (const device of this.gladys.devices ?? []) {
      const fips = fipsOfExternalId(this.gladys, device.external_id);
      // A device of a county removed from the configuration is no longer read.
      if (fips !== null && !codes.includes(fips) && this.config.codes.includes(fips)) {
        codes.push(fips);
      }
    }
    const rank = (fips) => this.config.codes.indexOf(fips);
    return codes.sort((a, b) => rank(a) - rank(b));
  }

  /** The name the user gave the device in Gladys, else the county's. */
  deviceName(fips) {
    const { device } = countyIds(this.gladys, fips);
    const found = (this.gladys.devices ?? []).find((d) => d.external_id === device);
    return found?.name || countyName(this.counties[fips], fips);
  }

  snapshot(fips) {
    return snapshotOf(this.counties[fips], this.config.threshold);
  }

  /** The snapshot, unless its map is too old to be shown as current. */
  freshSnapshot(fips) {
    const snapshot = this.snapshot(fips);
    return snapshot && mapAge(snapshot.date, this.now()) <= STALE_MS ? snapshot : null;
  }

  /** True if the county should be read now. */
  due(fips, now) {
    if (now - (this.unknown[fips] ?? -Infinity) < DAILY_MS && now >= this.unknown[fips]) {
      return false;
    }
    if (now - (this.failedAt[fips] ?? -Infinity) < FAILED_RETRY_MS && now >= this.failedAt[fips]) {
      return false;
    }
    const county = this.counties[fips];
    if (!county || county.fetchedAt > now) {
      return true;
    }
    const elapsed = now - county.fetchedAt;
    if (elapsed >= DAILY_MS) {
      return true;
    }
    const latest = county.maps[0];
    return Boolean(latest) && now >= nextMapDue(latest.date) && elapsed >= DUE_RETRY_MS;
  }

  /** One cycle at a time: a call during a cycle waits for it. */
  runCycle() {
    if (!this.running) {
      this.running = this.cycle()
        .catch((err) => logger.error('Refresh failed', err))
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  async cycle() {
    const now = this.now();
    this.lastCycleAt = now;
    let failure = null;
    let read = false;
    let newMap = false;
    let newCounty = false;
    for (const fips of this.config.codes) {
      if (!this.due(fips, now)) {
        continue;
      }
      read = true;
      try {
        const county = await this.client.county(fips);
        delete this.failedAt[fips];
        if (!county) {
          if (!this.unknown[fips]) {
            logger.warn(`The US Drought Monitor does not know the county code ${fips}`);
          }
          this.unknown[fips] = this.now();
          continue;
        }
        delete this.unknown[fips];
        const previous = this.counties[fips];
        newCounty ||= !previous || countyName(previous, fips) !== countyName(county, fips);
        newMap ||= previous?.maps?.[0]?.date !== county.maps[0].date;
        this.counties[fips] = { ...county, fetchedAt: this.now() };
        logger.debug(`Read county ${fips} (map of ${county.maps[0].date})`);
      } catch (err) {
        this.failedAt[fips] = this.now();
        failure ??= err;
      }
    }
    // A cycle that read nothing (a county that just failed is skipped) says
    // nothing about the source: a failure stays a failure until a read succeeds.
    const stillFailing = this.config.codes.some((fips) => this.failedAt[fips]);
    if (read || !stillFailing || this.failing !== 'source') {
      await this.setFailure(failure);
    }
    const fired = await this.checkTriggers();
    if (read || fired) {
      await this.save();
    }
    if (newCounty) {
      await this.publishDiscovered();
    }
    await this.publishStates(this.created());
    if (newMap || newCounty) {
      this.refreshWidget();
    }
  }

  /** Fires the triggers of the new maps of the created counties. True if a reference moved. */
  async checkTriggers() {
    let moved = false;
    for (const fips of this.created()) {
      const snapshot = this.freshSnapshot(fips);
      if (!snapshot) {
        continue;
      }
      const threshold = this.config.threshold;
      const previous = this.seen[fips];
      const reference = { date: snapshot.date, level: snapshot.level, threshold };
      if (previous && previous.threshold !== threshold) {
        // Another threshold: the old level is not comparable, the reference
        // only follows, nothing fires.
        this.seen[fips] = reference;
        moved = true;
        continue;
      }
      if (previous && snapshot.date <= previous.date) {
        continue;
      }
      // At least once: a crash between the event and the save fires it again.
      this.seen[fips] = reference;
      moved = true;
      // A reference more than 3 weeks old (county followed again, long outage)
      // says nothing about this week: it is only replaced.
      if (
        previous &&
        mapAge(previous.date, 0) - mapAge(snapshot.date, 0) <= MAX_REFERENCE_GAP_MS &&
        previous.level !== snapshot.level
      ) {
        await this.fireTriggers(fips, previous.level, snapshot);
      }
    }
    return moved;
  }

  async fireTriggers(fips, before, snapshot) {
    const language = this.config.language;
    const after = snapshot.level;
    const common = {
      county: countyIds(this.gladys, fips).device,
      county_name: this.deviceName(fips),
      category: LEVEL_CODES[after],
      previous_category: LEVEL_CODES[before],
      category_name: levelText(after, language),
      drought_level: after,
      d1_area: snapshot.map.d1,
      map_date: dateText(snapshot.date, language),
    };
    const events = [[after > before ? TRIGGERS.WORSENED : TRIGGERS.IMPROVED, common]];
    for (let level = before + 1; level <= after; level += 1) {
      events.push([TRIGGERS.LEVEL_REACHED, { ...common, level: LEVEL_CODES[level] }]);
    }
    for (const [key, data] of events) {
      try {
        await this.gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
    }
  }

  async setFailure(err) {
    const unknown = this.config.codes.filter((fips) => this.unknown[fips]);
    const kind = err ? 'source' : unknown.length > 0 ? 'unknown' : null;
    const codes = unknown.join(', ');
    if (kind !== this.failing || (kind === 'unknown' && codes !== this.failingCodes)) {
      if (kind === 'source') {
        // One line at the first failure, one at the recovery.
        logger.warn(`Cannot read the US Drought Monitor data: ${err.message}`);
      } else if (this.failing === 'source') {
        logger.info('The US Drought Monitor data are readable again');
      }
      this.failing = kind;
      this.failingCodes = codes;
      this.statusPublished = false;
    } else if (err) {
      logger.debug(`Still cannot read the US Drought Monitor data: ${err.message}`);
    }
    await this.publishStatus();
  }

  async publishStatus() {
    if (this.statusPublished) {
      return;
    }
    let message;
    if (this.failing === 'source') {
      message = STATUS.sourceDown;
    } else if (this.failing === 'unknown') {
      message = Object.fromEntries(
        Object.entries(STATUS.unknownCounty).map(([lang, text]) => [
          lang,
          fill(text, { codes: this.failingCodes }),
        ]),
      );
    }
    try {
      await this.gladys.setConnectionStatus(!this.failing, message);
      this.statusPublished = true;
    } catch (err) {
      logger.debug(`Cannot publish the connection status: ${err.message}`);
    }
  }

  async publishStates(codes, { force = false } = {}) {
    const states = codes.flatMap((fips) =>
      deviceStates(this.gladys, fips, this.freshSnapshot(fips), this.config.language),
    );
    if (states.length === 0) {
      return;
    }
    if (force) {
      for (const fips of codes) {
        this.gladys.forgetPublishedStates(countyIds(this.gladys, fips).device);
      }
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    } catch (err) {
      // Sent again by the next cycle: publishChangedStates only remembers accepted values.
      logger.warn(`Cannot publish the states: ${err.message}`);
    }
  }

  /** Gladys polls a device (only if it was created with a poll frequency). */
  async poll(device) {
    const fips = fipsOfExternalId(this.gladys, device?.external_id);
    if (fips === null) {
      return;
    }
    if (this.lastCycleAt === null || this.now() - this.lastCycleAt >= CYCLE_MS / 2) {
      await this.runCycle();
    } else {
      await this.publishStates([fips]);
    }
  }

  async onDeviceCreated(device) {
    const fips = fipsOfExternalId(this.gladys, device?.external_id);
    if (fips !== null) {
      await this.publishStates([fips], { force: true });
      // The reference of the triggers: the map the device shows now.
      if (await this.checkTriggers()) {
        await this.save();
      }
    }
    this.refreshWidget();
  }

  /** A device renamed or deleted: the widget shows Gladys' names and devices. */
  onDeviceChanged() {
    this.refreshWidget();
  }

  /** Raw base64 PNG of an image key (see imageKey), or null if unknown. */
  image(key) {
    const match = /^usdm-(\d{5})-(\d{4})(\d{2})(\d{2})$/.exec(String(key));
    if (!match) {
      return null;
    }
    const [, fips, year, month, day] = match;
    const map = this.counties[fips]?.maps?.find((m) => m.date === `${year}-${month}-${day}`);
    return map ? drawShares(map).toString('base64') : null;
  }

  refreshWidget() {
    const elapsed = this.now() - this.lastWidgetRefresh;
    if (elapsed >= WIDGET_REFRESH_GAP_MS || !this.timers) {
      this.lastWidgetRefresh = this.now();
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch((err) =>
        logger.debug(`Widget refresh refused: ${err.message}`),
      );
      return;
    }
    if (!this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.refreshWidget();
      }, WIDGET_REFRESH_GAP_MS - elapsed);
      this.refreshTimer.unref?.();
    }
  }

  save() {
    // Only the counties still followed: a removed one is read again if added back.
    const kept = (table) =>
      Object.fromEntries(
        Object.entries(table).filter(([fips]) => this.config.codes.includes(fips)),
      );
    return this.store.save({
      counties: kept(this.counties),
      unknown: kept(this.unknown),
      seen: kept(this.seen),
    });
  }

  async stop() {
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    this.refreshTimer = null;
    await this.running;
    await this.store.flush();
  }
}
