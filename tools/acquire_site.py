#!/usr/bin/env python3
"""Build a provenance-checked 500m site from public services.
No fabricated OSM ways, footprints, or elevations. Fail closed if geocoding/OSM fails.
Uses Python standard library, intended for Github Actions or offline invocation.
"""
import argparse
import concurrent.futures
import datetime
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ADDRESS = "266 Russell St, Lewiston, ME 04240"
SIZE = 500
UA = "RealityShiftResearch/0.2 (noncommercial geospatial demo; GitHub ReidMaxim/Real-World-Procedural-Generator)"

def request(url, params=None, post=None, timeout=28):
    if params: url += "?" + urllib.parse.urlencode(params)
    data = urllib.parse.urlencode(post).encode() if post else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.load(res)

def geocode():
    # Use a street-address geocoder, NOT Lewiston city centroid.
    url = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"
    params = {"address": ADDRESS, "benchmark": "Public_AR_Current",
              "vintage": "Current_Current", "format": "json"}
    try:
        response = request(url, params)
        matches = response["result"]["addressMatches"]
        if matches:
            match = matches[0]
            matched = match.get("matchedAddress", "")
            if "266" in matched and "RUSSELL" in matched.upper() and "LEWISTON" in matched.upper():
                return float(match["coordinates"]["x"]), float(match["coordinates"]["y"]), "US Census Geocoder", matched
    except Exception as exc:
        print("Census geocoder unavailable:", exc, flush=True)
    # Secondary geocoder, but must be an address-level match.
    results = request("https://nominatim.openstreetmap.org/search",
                      {"q": ADDRESS, "format": "json", "limit": 3, "addressdetails": 1})
    for place in results:
        a = place.get("address", {})
        number = a.get("house_number")
        road = a.get("road", "")
        city = a.get("city", a.get("town", ""))
        if number == "266" and "russell" in road.lower() and "lewiston" in city.lower():
            return float(place["lon"]), float(place["lat"]), "OpenStreetMap Nominatim", place.get("display_name", ADDRESS)
    raise RuntimeError("Unable to verify exact 266 Russell St address; no approximate center substituted")

def local(lon, lat, center):
    # Local tangent-plane approximation: < 0.1m distortion across a 500m site at this latitude.
    clon, clat = center
    x = math.radians(lon-clon)*6378137*math.cos(math.radians(clat))
    z = math.radians(lat-clat)*6378137
    return [round(x,2), round(z,2)]

def fetch_osm(center):
    lon, lat = center
    dlat = 300/111320
    dlon = 300/(111320*math.cos(math.radians(lat)))
    south,west,north,east=lat-dlat,lon-dlon,lat+dlat,lon+dlon
    query = f"""[out:json][timeout:50];(way["highway"]({south},{west},{north},{east});way["building"]({south},{west},{north},{east}););out body geom;"""
    for endpoint in ("https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"):
        try:
            result=request(endpoint,post={"data":query},timeout=75)
            if not isinstance(result.get("elements"),list): raise ValueError("Missing OSM elements")
            return result, endpoint
        except Exception as exc:
            print("Overpass endpoint failed", endpoint, exc, flush=True)
    raise RuntimeError("Unable to download OSM roads/building footprints; refusing fictional substitute")

def build_map(osm, center):
    roads, buildings = [],[]
    for el in osm["elements"]:
        tags=el.get("tags",{});nodes=el.get("geometry",[])
        if not nodes or len(nodes)<2: continue
        pts=[local(p["lon"],p["lat"],center) for p in nodes]
        if not any(abs(x)<SIZE/2+25 and abs(z)<SIZE/2+25 for x,z in pts):continue
        if "highway" in tags and tags["highway"] not in ("footway","path","steps","cycleway","proposed","construction"):
            roads.append(pts)
        if "building" in tags and len(pts)>=4:
            if pts[0]==pts[-1]:pts.pop()
            if len(pts)<3:continue
            item={"id":"osm-way-"+str(el["id"]),"footprint":pts}
            height=tags.get("height")
            try:
                if height:
                    h=float(re.sub(r"\s*m(?:eters?)?\s*$","",height,flags=re.I))
                    if 2<h<400:item["height"]=h
            except ValueError:pass
            buildings.append(item)
    if len(roads)<2 or len(buildings)<3:
        raise RuntimeError(f"Insufficient OSM geography ({len(roads)} roads, {len(buildings)} buildings); refusing to present an incomplete site as mapped")
    return roads,buildings

def elevation_at(lon,lat):
    # USGS 3DEP EPQS: interpolated elevations, not surveyed ground truth.
    result=request("https://epqs.nationalmap.gov/v1/json",
                   {"x":f"{lon:.7f}","y":f"{lat:.7f}","units":"Meters","wkid":4326,"includeDate":"false"},timeout=20)
    value=result.get("value")
    if value is None and isinstance(result.get("USGS_Elevation_Point_Query_Service"),dict):
        value=result["USGS_Elevation_Point_Query_Service"].get("Elevation_Query",{}).get("Elevation")
    number=float(value)
    if not math.isfinite(number) or number<-500 or number>9000:raise ValueError("Invalid USGS elevation")
    return number

def elevation_grid(center, n=9):
    clon,clat=center
    points=[]
    for j in range(n):
        for i in range(n):
            x=(i/(n-1)-.5)*SIZE
            z=(j/(n-1)-.5)*SIZE
            lon=clon+math.degrees(x/(6378137*math.cos(math.radians(clat))))
            lat=clat+math.degrees(z/6378137)
            points.append((lon,lat))
    results=[None]*len(points)
    # small bounded pool, no aggressive API scraping
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures={ex.submit(elevation_at,*p):i for i,p in enumerate(points)}
        for f in concurrent.futures.as_completed(futures):
            i=futures[f]
            try:results[i]=round(f.result(),2)
            except Exception as e:
                print("Elevation sample missing:",i,str(e),flush=True)
    if any(v is None for v in results):return None
    base=min(results)
    return {"n":n,"heights":[round(v-base,2) for v in results]},base

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",default="public/data/russell-266.json")
    p.add_argument("--no-elevation",action="store_true")
    args=p.parse_args()
    lon,lat,geocoder,matched=geocode()
    print(f"Verified location: {matched} via {geocoder}; center ({lon:.7f},{lat:.7f})",flush=True)
    osm,osmurl=fetch_osm((lon,lat))
    roads,buildings=build_map(osm,(lon,lat))
    print(f"Verified OSM: {len(roads)} road ways, {len(buildings)} building footprints",flush=True)
    grid=None;base=None
    if not args.no_elevation:
        try:grid,base=elevation_grid((lon,lat))
        except Exception as exc:print("USGS sampling unavailable:",exc,flush=True)
    if grid is None:
        # Real street/building geometry with **explicitly flat, non-measured elevation**.
        grid={"n":2,"heights":[0,0,0,0]}
        kind="mapped"
        source_note="OSM roads/buildings; ZERO ELEVATION IS A PLACEHOLDER, NOT MEASURED TERRAIN"
    else:
        kind="measured"
        source_note="OSM roads/buildings; USGS 3DEP EPQS interpolated elevation (81 samples across 500m)"
    metadata={"kind":kind,"label":"266 Russell St vicinity, Lewiston, Maine","center":[lon,lat],
              "attribution":"© OpenStreetMap contributors (ODbL); USGS 3DEP (if elevations present)",
              "geocoder":geocoder,"geocoder_match":matched,"osm_endpoint":osmurl,
              "osm_license":"https://www.openstreetmap.org/copyright",
              "elevation_source":"USGS 3DEP EPQS" if base is not None else None,
              "elevation_base_m":base,
              "elevation_note":source_note,
              "generated_utc":datetime.datetime.now(datetime.timezone.utc).isoformat()}
    world={"schema":1,"size":SIZE,"terrain":grid,"roads":roads,"buildings":buildings,"meta":metadata}
    target=Path(args.out)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(world,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"Wrote {target}: {target.stat().st_size} bytes; provenance={kind}",flush=True)

if __name__=="__main__":main()
