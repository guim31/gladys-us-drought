# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One device per US county (FIPS code) from the US Drought Monitor: drought level (0 to 5) and
  category, share of the county in D1 or worse, D2 or worse, D3 or worse and D4, change over 1
  and 4 weeks, map date.
- A setting for the share of the county a category must cover to count (1 % by default).
- Scene triggers: the drought gets worse, reaches a level (D0 to D4), improves.
- Scene action: the county map in one sentence, with its figures.
- Dashboard widget: category, shares and changes of a county, with a strip in the official USDM
  colours.
- Texts and documentation in English, French, German and Spanish.
