# Storm Tracks

[Explore Storm Tracks](https://coolcode.ca/stormtracks/) · [CoolCode catalogue](https://coolcode.ca/)

Replay North Atlantic cyclone tracks, compare their sustained winds and estimate how close storm centres came to a community. Start around Halifax or choose Sydney, Sable Island, Yarmouth, Charlottetown, Moncton, St. John’s, Bermuda or custom coordinates. Select **Whole basin** to search the entire archive by year, name or NOAA storm ID.

The first snapshot covers 2,275 storms and 126,132 positions from 1851–2025. Storm Tracks starts on Juan in 2003. Play the timeline or step through in UTC, compare a second storm on the map and the elapsed-days wind chart, and open Weather Archive for Canadian station observations. The URL remembers selected storm IDs. Searches and map coordinates stay in the browser. All maps and records load from this site.

## Sources and interpretation

- NOAA National Centers for Environmental Information, International Best Track Archive for Climate Stewardship v04r01, [DOI 10.25921/82ty-9e16](https://doi.org/10.25921/82ty-9e16). [Archive](https://www.ncei.noaa.gov/products/international-best-track-archive), [North Atlantic CSV](https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NA.list.v04r01.csv), [column definitions](https://www.ncei.noaa.gov/sites/default/files/2025-09/IBTrACS_v04r01_column_documentation.pdf).
- The importer keeps primary tracks, North Atlantic positions and calendar seasons before the retrieval year. It excludes alternate/spur and provisional tracks. A storm can change physical type over its lifetime. Historical coverage is incomplete, particularly at sea during early decades.
- Coordinates and times are IBTrACS consensus centres in degrees and UTC. US one-minute wind and pressure come from USA_WIND (kt) and USA_PRES (mb/hPa). The UI preserves missing measurements and uses USA_STATUS or a labelled IBTrACS nature fallback. The source may interpolate positions or measurements between agency observations.
- Distances use endpoints and finite great-circle arcs between fixes up to 12 hours apart on a sphere (mean Earth radius 6,371.0088 km). A track centre's closest approach cannot establish local wind, rainfall, impact or landfall. Replay advances one recorded position per step. Durations and chart coordinates use actual UTC times.
- Public-domain [Natural Earth 1:50m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson), retrieved November 18, 2026. The bundled polygon geometry rounds coordinates to 0.001°. Leaflet 1.9.4 is bundled with its licence in web/vendor.

## Development and refresh

Run `node --test tests/*.test.mjs`, `python3 -m unittest discover -s tests -v`, then `python3 scripts/build.py`. Serve `dist/` with a local HTTP server. To run the browser smoke test, install `tests/browser-requirements.txt` and Playwright Chromium, then run `python3 tests/browser_smoke.py`. Set `CHROMIUM_PATH` only for a system Chromium installation.

The normal build is offline. `python3 scripts/refresh.py` fetches the official CSV, validates the schema, units, coverage and timestamps, and atomically replaces the compressed snapshot. Metadata records NOAA’s source modification date, retrieval date and raw-file SHA-256. The build expands the two JSON files and emits the catalogue date badge from the retrieval date. GitHub Actions checks monthly for source changes. A validated change is committed to main and passes the normal browser tests before Pages deployment. Source publication, snapshot retrieval and application build dates are distinct.
