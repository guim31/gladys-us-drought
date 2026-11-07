// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minimum share of the county (percent of its area) a category must cover to
// count: the USDM draws its categories on a map, and a sliver of D3 on the
// edge of a large county says little about the house.
export const THRESHOLDS = [0, 1, 5, 10, 25, 50];

// A county is one request; ten keep the daily reads tiny.
export const MAX_COUNTIES = 10;

export const DEFAULT_CONFIG = {
  counties: '',
  threshold: '1',
  language: 'fr',
};

/**
 * County FIPS codes typed by the user: "48201, 36061". A 4-digit code is a
 * 5-digit one whose leading zero a spreadsheet dropped (06037 → 6037).
 * @param {unknown} value
 * @returns {string[]} unique 5-digit codes, in the typed order
 */
export function parseCounties(value) {
  const tokens = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[\s,;]+/);
  const codes = [];
  for (const token of tokens) {
    const digits = token.trim();
    if (!/^\d{4,5}$/.test(digits)) {
      continue;
    }
    const code = digits.padStart(5, '0');
    // 00xxx and xx000 are a state or nothing, never a county.
    if (code.startsWith('00') || code.endsWith('000') || codes.includes(code)) {
      continue;
    }
    codes.push(code);
  }
  return codes.slice(0, MAX_COUNTIES);
}

/**
 * @param {object} raw configuration from Gladys
 * @returns {{codes: string[], threshold: number, language: string}}
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const threshold = Number(config.threshold);
  return {
    codes: parseCounties(config.counties),
    threshold: THRESHOLDS.includes(threshold) ? threshold : Number(DEFAULT_CONFIG.threshold),
    language: LANGUAGES.includes(config.language) ? config.language : DEFAULT_CONFIG.language,
  };
}
