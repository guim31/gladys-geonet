# GeoNet for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that follows the volcanic
alert levels of New Zealand and the earthquakes felt around your house, from
[GeoNet](https://www.geonet.org.nz/) (GNS Science).

- **One device per followed volcano**: Volcanic Alert Level (0 to 5), Aviation Colour Code (Green to
  Red), activity and distance from the house, with their history.
- **New Zealand volcanoes**: the highest alert level in the country, the number of volcanoes at level 1
  or more, and the most active one.
- **Felt earthquakes**: magnitude, intensity (Modified Mercalli, computed by GeoNet), distance and place
  of the latest earthquake within a radius of your house, and how many in the last 24 hours.
- **Dashboard widget**: the latest felt earthquake and your volcanoes, most active first.
- **Scene triggers** `alert_changed` (filters: volcano, new level, raised or lowered) and `quake_felt`
  (filter: intensity).
- **Scene action** `read_geonet`: the levels and the latest earthquake as one sentence.

No account, no API key: the data come from the public [GeoNet API](https://api.geonet.org.nz/). For the
earthquakes of the whole world, see [EMSC Earthquakes](https://github.com/guim31/gladys-emsc); GeoNet
gives the official data of New Zealand, with the felt intensity and the volcanoes. This is not a safety
alert system. Not affiliated with GeoNet nor GNS Science.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from the Gladys host (`api.geonet.org.nz`).
- For the earthquakes and distances: a location for your house in Gladys, or coordinates in the
  configuration.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-geonet` (or install it from the catalog once it is listed). The
   install screen shows the **location** access it asks for (the centre of the radius).
2. In **Configuration**, choose the volcanoes to follow, the earthquake radius and lowest intensity, then
   save. **Show the current levels** checks what your settings catch.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ api.geonet.org.nz   (Accept: application/vnd.geo+json;version=2)
      │ SDK (WebSocket + host API)        /volcano/val      every refresh
      ▼                                   /quake?MMI=<n>    every refresh, with a radius
Gladys core ── devices, states,
               scene events, widget
```

- Every 1 to 15 minutes (2 by default) the container reads the alert levels and the 100 latest
  earthquakes of the chosen intensity or more, then keeps those within the radius. The devices are
  published with `should_poll: false`: the container refreshes them on its own timer.
- The levels of every volcano and the ids of the earthquakes seen are kept under `/data`: a restart fires
  no trigger again; a new radius, intensity or centre records the list without firing; an earthquake
  more than six hours old is no news.

## Limitations

- New Zealand only. The intensity is the one GeoNet computes for the earthquake, not a measure at your
  house; an earthquake appears a few minutes after it happens and its values may be revised.
- GeoNet's sentences (activity, hazards, places) are in English.
- Developed and tested against the real GeoNet API and the SDK's fake Gladys, without a real Gladys
  instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake GeoNet serving the real answers recorded on
20/11/2026 (`test/fixtures/geonet/`): never the network.

## Credits

- Data: [GeoNet](https://www.geonet.org.nz/), GNS Science, under
  [CC BY 3.0 NZ](https://creativecommons.org/licenses/by/3.0/nz/). The GeoNet logo on the cover (white version from geonet.org.nz) belongs
  to GeoNet / GNS Science and is used only to name the source.
- Inspired by the Home Assistant integrations `geonetnz_volcano` and `geonetnz_quakes` and their library
  [`aio_geojson_geonetnz_volcano`](https://github.com/exxamalte/python-aio-geojson-geonetnz-volcano)
  (Apache 2.0, by Malte Franken); no code is copied.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and the
  official JavaScript template.

## License

[Apache 2.0](LICENSE).
