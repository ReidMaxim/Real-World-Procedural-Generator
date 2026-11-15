#!/usr/bin/env python3
"""Offline 500 m measured terrain + OSM GeoJSON converter. Requires rasterio and pyproj."""
import argparse
import json
import math
from pathlib import Path

def convert(dem_path, osm_path, lon, lat, label, output, size=500, samples=101):
    import rasterio
    from pyproj import Transformer, CRS
    utm_zone = int((lon + 180) // 6) + 1
    target = CRS.from_epsg((32600 if lat >= 0 else 32700) + utm_zone)
    to_m = Transformer.from_crs("EPSG:4326", target, always_xy=True)
    center_x, center_y = to_m.transform(lon, lat)
    to_geo = Transformer.from_crs(target, "EPSG:4326", always_xy=True)
    heights = []
    with rasterio.open(dem_path) as ds:
        if ds.crs is None: raise ValueError("DEM has no CRS")
        if ds.nodata is None: print("Warning: DEM has no nodata marker; verify values manually")
        from rasterio.warp import transform
        from rasterio.transform import rowcol
        # Sample using reprojected coordinates and dataset.sample in source CRS.
        coords = []
        for j in range(samples):
            for i in range(samples):
                x = center_x + (i / (samples - 1) - 0.5) * size
                y = center_y + (j / (samples - 1) - 0.5) * size
                coords.append((x, y))
        tx, ty = Transformer.from_crs(target, ds.crs, always_xy=True).transform(
            [p[0] for p in coords], [p[1] for p in coords])
        for arr in ds.sample(zip(tx, ty), masked=True):
            v = arr[0]
            if getattr(v, "mask", False) or not math.isfinite(float(v)) or (ds.nodata is not None and float(v) == ds.nodata):
                raise ValueError("Missing DEM coverage; choose a fully covered region")
            heights.append(round(float(v), 2))
    base = min(heights)
    heights = [round(h - base, 2) for h in heights]
    geojson = json.loads(Path(osm_path).read_text(encoding="utf-8"))
    if geojson.get("type") != "FeatureCollection": raise ValueError("OSM GeoJSON FeatureCollection required")
    roads, buildings = [], []
    def pt(p):
        mx, my = to_m.transform(p[0], p[1])
        return [round(mx - center_x, 2), round(my - center_y, 2)]
    def near(points):
        return any(abs(x) <= size / 2 + 25 and abs(y) <= size / 2 + 25 for x, y in points)
    for idx, feature in enumerate(geojson["features"]):
        g = feature.get("geometry") or {}
        tags = feature.get("properties") or {}
        kind, coords = g.get("type"), g.get("coordinates")
        if not coords: continue
        if tags.get("highway") and kind == "LineString":
            poly = [pt(p) for p in coords]
            if len(poly) >= 2 and near(poly): roads.append(poly)
        if tags.get("building") and kind in ("Polygon", "MultiPolygon"):
            outer = coords[0] if kind == "Polygon" else coords[0][0]
            poly = [pt(p) for p in outer]
            if len(poly) > 3 and poly[0] == poly[-1]: poly.pop()
            if len(poly) < 3 or not near(poly): continue
            b = {"id": str(feature.get("id") or idx), "footprint": poly}
            raw = tags.get("height")
            try:
                if raw is not None and float(str(raw).replace(" m", "")) > 2: b["height"] = float(str(raw).replace(" m", ""))
            except ValueError: pass
            buildings.append(b)
    world = {"schema": 1, "size": size, "terrain": {"n": samples, "heights": heights},
             "roads": roads, "buildings": buildings,
             "meta": {"kind": "measured", "label": label,
                      "attribution": "Elevation: source DEM (see project documentation); © OpenStreetMap contributors (ODbL)",
                      "center": [lon, lat], "dem": str(dem_path), "osm": str(osm_path),
                      "crs": str(target), "vertical_base_m": base}}
    out = Path(output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(world, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {out}: {len(roads)} roads, {len(buildings)} buildings, {len(heights)} grid samples")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dem", required=True)
    p.add_argument("--osm", required=True)
    p.add_argument("--lon", required=True, type=float)
    p.add_argument("--lat", required=True, type=float)
    p.add_argument("--label", required=True)
    p.add_argument("--out", default="public/data/world.json")
    a = p.parse_args()
    convert(a.dem, a.osm, a.lon, a.lat, a.label, a.out)
