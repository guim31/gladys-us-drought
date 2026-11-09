# US Drought Monitor for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
drought level of your US county into Gladys, from the **US Drought Monitor** (USDM), the weekly
drought map produced by the National Drought Mitigation Center (University of Nebraska-Lincoln),
the USDA and NOAA. Public data, no account, no key.

> The USDM describes drought; it does **not** set water restrictions, which depend on each city or
> water utility. Not affiliated with the US Drought Monitor.

## What it does

- One device per county you follow (5-digit FIPS code), with its drought level (0 to 5), its
  category ("D2 · Severe drought"), the share of the county in D1 or worse, D2 or worse, D3 or
  worse and D4, the change over 1 and 4 weeks, and the date of the map.
- Scene triggers: **Drought gets worse**, **Drought reaches a level** (D0 to D4) and **Drought
  improves**, fired once per new weekly map.
- A scene action: **the county map in one sentence**, ready for a notification.
- A dashboard widget: the category, the shares and the changes of a county, with a strip in the
  official colours of the USDM legend.

Full user documentation: [English](docs/en.md), [français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md).

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- United States only: the county FIPS codes of the US Census.

## Installation

In Gladys: **Integrations → Install from GitHub**, address of this repository:
`https://github.com/guim31/gladys-us-drought`. Type the FIPS codes of your counties in the
configuration (Harris County, Texas: `48201`), save, then create the devices in the **Discover**
tab.

## How it works

The data come from the public
[USDM data services](https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx):
county statistics in percent of area, cumulative (D1 is "D1 or worse"), one row per weekly map,
six weeks back. The map is drawn with the data of Tuesday and published on Thursday: the
integration reads each county once a day, every 3 hours from Thursday afternoon (UTC) until the
new map is there, keeps the maps under `/data`, and publishes only what changed. The level of a
county is the strongest category covering at least a share of its area (1 % by default, set in
the configuration).

## Limits

- **Developed without a running Gladys**: tested against the real USDM data services and the fake
  Gladys of the SDK. Feedback welcome.
- County level only (no city or ZIP code), and weekly data.
- The county is chosen by its FIPS code, not deduced from the position of the house: that would
  need a third-party geocoding service.
- After three weeks without a new map (service down), the devices stop receiving values.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
```

The tests run against the fake Gladys of the SDK and real answers of the USDM data services
recorded under `test/fixtures/usdm/` (7 November 2026: Harris County, Texas; New York County, New
York; Miami-Dade County, Florida); they never touch the network.

## Credits

- Data: The U.S. Drought Monitor is jointly produced by the National Drought Mitigation Center at
  the University of Nebraska-Lincoln, the United States Department of Agriculture, and the
  National Oceanic and Atmospheric Administration. Map courtesy of NDMC. Some answers of the data
  services are recorded in `test/fixtures/usdm/` as test data.
- Cover: the site icon of the US Drought Monitor (the map of the United States, vector version
  `safari-pinned-tab.svg` of [droughtmonitor.unl.edu](https://droughtmonitor.unl.edu/)) on its
  brand colour, used to identify the data source.
- Built on the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js).

Not affiliated with, nor endorsed by, the US Drought Monitor, the National Drought Mitigation
Center, the USDA or NOAA.

## License

[Apache-2.0](LICENSE)
