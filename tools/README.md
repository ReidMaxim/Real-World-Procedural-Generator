# Geographic acquisition and offline conversion
Do not download proprietary satellite tiles or claim the synthetic fixture is real.

Suggested sources:
- USGS 3DEP DEM (GeoTIFF elevation raster, public-domain U.S. data). Record exact product URL, vertical reference and acquisition date.
- OpenStreetMap roads and building polygons (GeoJSON export). Preserve ODbL attribution and comply with its terms.

Install offline conversion requirements separately: `python -m pip install rasterio pyproj`. Source geographic layers must be WGS84 GeoJSON and a real DEM supported by rasterio. The converter reprojects the DEM into a local metric CRS and samples a 101 × 101 grid; roads and footprints are converted from WGS84 long/lat with pyproj. Input areas must overlap. It does not invent missing buildings or missing DEM readings.

Example (after sourcing DEM and exported GeoJSON):
```sh
python tools/prepare_world.py --dem inputs/elevation.tif --osm inputs/map.geojson --lon YOUR_LONGITUDE --lat YOUR_LATITUDE --label "Downtown study site" --out public/data/world.json
```
Use `?world=data/world.json` when exploring locally. For an actual location, document the source URLs and verify the input's elevation units and vertical datum. Simplified conversion assumes DEM height measurements are meters; reject or convert any other units first. Buffer/clipping near the world boundary is intentionally minimal.
