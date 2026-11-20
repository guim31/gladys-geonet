# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-20

### Added

- One device per followed New Zealand volcano: Volcanic Alert Level (0 to 5),
  Aviation Colour Code, activity and distance from the house, read from the
  public GeoNet API (GNS Science).
- A "New Zealand volcanoes" device: highest alert level in the country,
  volcanoes at level 1 or more, and the most active one.
- A "Felt earthquakes" device: magnitude, intensity (MMI), distance and place
  of the latest earthquake within a radius of the house, and how many in the
  last 24 hours.
- A dashboard widget with the latest felt earthquake and the volcanoes, most
  active first.
- Scene triggers when the alert level of a volcano changes and when an
  earthquake is felt nearby, and a scene action reading the levels as one
  sentence.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-geonet/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-geonet/releases/tag/v1.0.0
