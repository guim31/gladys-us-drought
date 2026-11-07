// -----------------------------------------------------------------------------
// The texts the container produces, in the four languages of Gladys. German
// says "du", Spanish "usted". Category names follow the USDM legend.
// -----------------------------------------------------------------------------

// Index: the level (see drought.js).
export const LEVEL_NAMES = {
  en: [
    'No drought',
    'Abnormally dry',
    'Moderate drought',
    'Severe drought',
    'Extreme drought',
    'Exceptional drought',
  ],
  fr: [
    'Pas de sécheresse',
    'Anormalement sec',
    'Sécheresse modérée',
    'Sécheresse sévère',
    'Sécheresse extrême',
    'Sécheresse exceptionnelle',
  ],
  de: [
    'Keine Dürre',
    'Ungewöhnlich trocken',
    'Mäßige Dürre',
    'Schwere Dürre',
    'Extreme Dürre',
    'Außergewöhnliche Dürre',
  ],
  es: [
    'Sin sequía',
    'Anormalmente seco',
    'Sequía moderada',
    'Sequía severa',
    'Sequía extrema',
    'Sequía excepcional',
  ],
};

// Short code of a level in a sentence: "none" is translated, D0–D4 are not.
export const NONE_CODE = { en: 'none', fr: 'aucune', de: 'keine', es: 'ninguna' };

// Change over a period: {from}, {to} (codes), {points} (D1+ share).
export const CHANGE = {
  en: {
    worse: '{from} → {to}, worse · D1+ {points}',
    better: '{from} → {to}, better · D1+ {points}',
    same: 'Unchanged ({to}) · D1+ {points}',
    points: '{value} pts',
  },
  fr: {
    worse: '{from} → {to}, pire · D1+ {points}',
    better: '{from} → {to}, mieux · D1+ {points}',
    same: 'Inchangé ({to}) · D1+ {points}',
    points: '{value} pts',
  },
  de: {
    worse: '{from} → {to}, schlechter · D1+ {points}',
    better: '{from} → {to}, besser · D1+ {points}',
    same: 'Unverändert ({to}) · D1+ {points}',
    points: '{value} Pkt.',
  },
  es: {
    worse: '{from} → {to}, empeora · D1+ {points}',
    better: '{from} → {to}, mejora · D1+ {points}',
    same: 'Sin cambios ({to}) · D1+ {points}',
    points: '{value} pts',
  },
};

// Connection statuses: setConnectionStatus receives the whole object (core 5.2+).
export const STATUS = {
  sourceDown: {
    en: 'The US Drought Monitor data cannot be read for now. Retrying every hour.',
    fr: "Les données de l'US Drought Monitor sont illisibles pour le moment. Nouvel essai toutes les heures.",
    de: 'Die Daten des US Drought Monitor sind gerade nicht lesbar. Neuer Versuch jede Stunde.',
    es: 'Los datos del US Drought Monitor no se pueden leer por ahora. Nuevo intento cada hora.',
  },
  unknownCounty: {
    en: 'The US Drought Monitor does not know these county codes: {codes}. Check the FIPS codes in the configuration.',
    fr: "L'US Drought Monitor ne connaît pas ces codes de comté : {codes}. Vérifiez les codes FIPS dans la configuration.",
    de: 'Der US Drought Monitor kennt diese County-Codes nicht: {codes}. Prüfe die FIPS-Codes in der Konfiguration.',
    es: 'El US Drought Monitor no conoce estos códigos de condado: {codes}. Compruebe los códigos FIPS en la configuración.',
  },
  initFailed: {
    en: 'The integration could not start. See its logs.',
    fr: "L'intégration n'a pas pu démarrer. Consultez ses journaux.",
    de: 'Die Integration konnte nicht starten. Sieh dir ihre Protokolle an.',
    es: 'La integración no pudo iniciarse. Consulte sus registros.',
  },
};

// Scene action summary. {county}, {date}, {level}, {share}, {change}.
export const SUMMARY = {
  en: {
    drought: '{county}, map of {date}: {level}, {share} of the county in drought (D1+).',
    dry: '{county}, map of {date}: {level}, no drought (D1+) yet.',
    none: '{county}, map of {date}: no drought.',
    worse: 'Worse than 4 weeks ago.',
    better: 'Better than 4 weeks ago.',
    same: 'Same level as 4 weeks ago.',
    noData: 'No US Drought Monitor map yet for {county}.',
  },
  fr: {
    drought: '{county}, carte du {date} : {level}, {share} du comté en sécheresse (D1+).',
    dry: '{county}, carte du {date} : {level}, pas encore de sécheresse (D1+).',
    none: '{county}, carte du {date} : pas de sécheresse.',
    worse: 'Pire qu’il y a 4 semaines.',
    better: 'Mieux qu’il y a 4 semaines.',
    same: 'Même niveau qu’il y a 4 semaines.',
    noData: 'Pas encore de carte US Drought Monitor pour {county}.',
  },
  de: {
    drought: '{county}, Karte vom {date}: {level}, {share} des Countys in Dürre (D1+).',
    dry: '{county}, Karte vom {date}: {level}, noch keine Dürre (D1+).',
    none: '{county}, Karte vom {date}: keine Dürre.',
    worse: 'Schlechter als vor 4 Wochen.',
    better: 'Besser als vor 4 Wochen.',
    same: 'Gleiche Stufe wie vor 4 Wochen.',
    noData: 'Noch keine Karte des US Drought Monitor für {county}.',
  },
  es: {
    drought: '{county}, mapa del {date}: {level}, {share} del condado en sequía (D1+).',
    dry: '{county}, mapa del {date}: {level}, todavía sin sequía (D1+).',
    none: '{county}, mapa del {date}: sin sequía.',
    worse: 'Peor que hace 4 semanas.',
    better: 'Mejor que hace 4 semanas.',
    same: 'Mismo nivel que hace 4 semanas.',
    noData: 'Aún no hay mapa del US Drought Monitor para {county}.',
  },
};

export const fill = (text, values) =>
  Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text);

/** "D2", or "none" in the language. */
export function levelCode(level, language) {
  return level === 0 ? (NONE_CODE[language] ?? NONE_CODE.en) : `D${level - 1}`;
}

/** "D2 · Severe drought" / "No drought" (40 characters at most). */
export function levelText(level, language) {
  const names = LEVEL_NAMES[language] ?? LEVEL_NAMES.en;
  return level === 0 ? names[0] : `D${level - 1} · ${names[level]}`;
}

const LOCALES = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "Nov 3, 2026" / "3 nov. 2026": the Tuesday of a map ("2026-11-03"). */
export function dateText(date, language) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "83.2 %" / "83,2 %" (at most one decimal). */
export function percentText(value, language) {
  const number = new Intl.NumberFormat(LOCALES[language] ?? LOCALES.en, {
    maximumFractionDigits: 1,
  }).format(value);
  return language === 'en' ? `${number}%` : `${number} %`;
}

/** "+4.2 pts" / "−3 pts" / "0 pts". */
export function pointsText(value, language) {
  const texts = CHANGE[language] ?? CHANGE.en;
  const rounded = Math.round(value * 10) / 10;
  const number = new Intl.NumberFormat(LOCALES[language] ?? LOCALES.en, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(rounded);
  return fill(texts.points, { value: number });
}

/** "D2 → D3, worse · D1+ +0.3 pts", or null without the older map. */
export function changeText(change, language) {
  if (!change) {
    return null;
  }
  const texts = CHANGE[language] ?? CHANGE.en;
  const kind = change.to > change.from ? 'worse' : change.to < change.from ? 'better' : 'same';
  return fill(texts[kind], {
    from: levelCode(change.from, language),
    to: levelCode(change.to, language),
    points: pointsText(change.points, language),
  });
}
