// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `drought`.
//
// One county (the one chosen, else the first followed): a heading with its
// name (the one given in Gladys), a picture of the shares of the county in
// each category in the official USDM colours (src/png.js), status lines (the
// category, D1+ to D4 shares, change over 1 and 4 weeks) and a caption with
// the map date. Settings hide the picture, the changes and the caption.
// Budget: 2 texts, 1 image, 1 status.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { AREA_KEYS, fipsOfExternalId } from './devices.js';
import { changeText, dateText, fill, levelText, percentText } from './messages.js';
import { imageKey, WIDGET_KEY } from './monitor.js';

export const TTL_SECONDS = 1800;
const MAX_STATUS_TEXT = 40;

export const TEXT = {
  empty: {
    en: 'No county yet: type its FIPS code in the configuration of the integration, then create the device in the Discover tab.',
    fr: "Aucun comté pour l'instant : saisissez son code FIPS dans la configuration de l'intégration, puis créez l'appareil dans l'onglet Découverte.",
    de: 'Noch kein County: Gib seinen FIPS-Code in der Konfiguration der Integration ein und lege dann das Gerät im Tab „Entdecken“ an.',
    es: 'Aún no hay condado: escriba su código FIPS en la configuración de la integración y, después, cree el dispositivo en la pestaña Descubrir.',
  },
  gone: {
    en: 'This county is no longer followed.',
    fr: "Ce comté n'est plus suivi.",
    de: 'Dieses County wird nicht mehr verfolgt.',
    es: 'Este condado ya no se sigue.',
  },
  noData: {
    en: 'No recent US Drought Monitor map for this county.',
    fr: 'Pas de carte récente de l’US Drought Monitor pour ce comté.',
    de: 'Keine aktuelle Karte des US Drought Monitor für dieses County.',
    es: 'No hay un mapa reciente del US Drought Monitor para este condado.',
  },
  caption: {
    en: 'Map of {date} · US Drought Monitor',
    fr: 'Carte du {date} · US Drought Monitor',
    de: 'Karte vom {date} · US Drought Monitor',
    es: 'Mapa del {date} · US Drought Monitor',
  },
  alt: {
    en: 'Share of the county in each drought category',
    fr: 'Part du comté dans chaque catégorie de sécheresse',
    de: 'Anteil des Countys in jeder Dürrekategorie',
    es: 'Parte del condado en cada categoría de sequía',
  },
};

// Status line labels.
export const LABELS = {
  en: {
    level: 'Category',
    d1_area: 'D1 or worse',
    d2_area: 'D2 or worse',
    d3_area: 'D3 or worse',
    d4_area: 'D4',
    week: '1 week',
    month: '4 weeks',
  },
  fr: {
    level: 'Catégorie',
    d1_area: 'D1 ou pire',
    d2_area: 'D2 ou pire',
    d3_area: 'D3 ou pire',
    d4_area: 'D4',
    week: '1 semaine',
    month: '4 semaines',
  },
  de: {
    level: 'Kategorie',
    d1_area: 'D1 oder schlimmer',
    d2_area: 'D2 oder schlimmer',
    d3_area: 'D3 oder schlimmer',
    d4_area: 'D4',
    week: '1 Woche',
    month: '4 Wochen',
  },
  es: {
    level: 'Categoría',
    d1_area: 'D1 o peor',
    d2_area: 'D2 o peor',
    d3_area: 'D3 o peor',
    d4_area: 'D4',
    week: '1 semana',
    month: '4 semanas',
  },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/** Colour of a level (closed palette of the widgets). */
export function levelColor(level) {
  if (level === 0) {
    return WIDGET_COLORS.SUCCESS;
  }
  if (level === 1) {
    return WIDGET_COLORS.INFO;
  }
  return level <= 3 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

function changeItem(change, label, language) {
  const kind = change.to > change.from ? 'worse' : change.to < change.from ? 'better' : 'same';
  return {
    label,
    value: clip(changeText(change, language)),
    color: { worse: WIDGET_COLORS.WARNING, better: WIDGET_COLORS.SUCCESS }[kind] ?? 'neutral',
    icon: { worse: 'trending-up', better: 'trending-down' }[kind] ?? 'minus',
  };
}

function countyContent(monitor, fips, language, settings) {
  const components = [{ type: 'text', variant: 'heading', text: clip(monitor.deviceName(fips)) }];
  const snapshot = monitor.freshSnapshot(fips);
  if (!snapshot) {
    components.push({ type: 'text', variant: 'body', text: t(TEXT.noData, language) });
    return components;
  }
  const labels = LABELS[language];
  if (settings.show_picture !== false) {
    components.push({
      type: 'image',
      key: imageKey(fips, snapshot.date),
      alt: t(TEXT.alt, language),
      fit: 'contain',
    });
  }
  const items = [
    {
      label: labels.level,
      value: clip(levelText(snapshot.level, language)),
      color: levelColor(snapshot.level),
      icon: snapshot.level === 0 ? 'check-circle' : 'sun',
    },
    ...AREA_KEYS.map((key) => ({
      label: labels[key],
      value: percentText(snapshot.map[key.slice(0, 2)], language),
      color: WIDGET_COLORS.NEUTRAL,
      icon: 'pie-chart',
    })),
  ];
  if (settings.show_changes !== false) {
    if (snapshot.week) {
      items.push(changeItem(snapshot.week, labels.week, language));
    }
    if (snapshot.month) {
      items.push(changeItem(snapshot.month, labels.month, language));
    }
  }
  components.push({ type: 'status', items });
  if (settings.show_source !== false) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: fill(t(TEXT.caption, language), { date: dateText(snapshot.date, language) }),
    });
  }
  return components;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' } = {}) {
      const lang = LABELS[language] ? language : 'en';
      const created = monitor.created();
      const chosen =
        typeof settings?.county === 'string' && settings.county ? settings.county : null;
      let fips = created[0] ?? null;
      if (chosen) {
        fips = fipsOfExternalId(monitor.gladys, chosen);
        if (fips === null || !created.includes(fips)) {
          return {
            ttl_seconds: TTL_SECONDS,
            components: [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }],
          };
        }
      }
      if (fips === null) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return {
        ttl_seconds: TTL_SECONDS,
        components: countyContent(monitor, fips, lang, settings ?? {}),
      };
    },
  },
};
