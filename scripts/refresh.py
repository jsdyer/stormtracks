#!/usr/bin/env python3
"""Convert NOAA IBTrACS v04r01 North Atlantic CSV into a deterministic compact snapshot."""
import csv
import gzip
import hashlib
import io
import json
import tempfile
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NA.list.v04r01.csv'
OUTPUT = ROOT / 'web/data/tracks.json.gz'
REQUIRED = {'SID','NAME','SEASON','BASIN','ISO_TIME','NATURE','LAT','LON','USA_WIND','USA_PRES','USA_STATUS','TRACK_TYPE'}


def optional_number(raw, low, high):
    if not raw.strip():
        return None
    value = float(raw)
    if not low <= value <= high:
        raise ValueError(f'Value outside source range: {raw}')
    return int(value) if value.is_integer() else value


def parse(csvfile, through_year):
    rows = csv.DictReader(csvfile)
    if not REQUIRED <= set(rows.fieldnames or []):
        raise ValueError('IBTrACS schema changed')
    units = next(rows)
    if units['USA_WIND'].strip() != 'kts' or units['USA_PRES'].strip() != 'mb':
        raise ValueError('Unexpected intensity units')
    tracks = {}
    for row in rows:
        if row['TRACK_TYPE'].strip() != 'main' or row['BASIN'].strip() != 'NA':
            continue
        year = int(row['SEASON'])
        if year > through_year:
            continue
        key = row['SID'].strip()
        name = row['NAME'].strip().title() or 'Unnamed'
        storm = tracks.setdefault(key, {'id':key, 'year':year, 'name':name, 'p':[]})
        when = datetime.strptime(row['ISO_TIME'].strip(),'%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        lat = optional_number(row['LAT'],-90,90)
        lon = optional_number(row['LON'],-180,180)
        if lat is None or lon is None:
            continue
        point = [int(when.timestamp() // 60), lat, lon,
                 optional_number(row['USA_WIND'],0,300), optional_number(row['USA_PRES'],800,1100),
                 row['USA_STATUS'].strip() or ('IB:'+row['NATURE'].strip())]
        storm['p'].append(point)
    clean = []
    for storm in tracks.values():
        points = sorted(storm['p'])
        if not points:
            continue
        if len({p[0] for p in points}) != len(points):
            raise ValueError('Duplicate time for '+storm['id'])
        storm['p'] = points
        clean.append(storm)
    return sorted(clean,key=lambda s:(s['year'], s['id']))


def save(raw, updated, fetched, destination=OUTPUT):
    digest = hashlib.sha256(raw).hexdigest()
    existing = json.loads(gzip.decompress(destination.read_bytes())) if destination.exists() else None
    storms = parse(io.StringIO(raw.decode('utf-8-sig')), int(fetched[:4])-1)
    total = sum(len(s['p']) for s in storms)
    if len(storms)<2000 or total<100000 or not any(s['id']=='2003268N28298' for s in storms):
        raise ValueError('Incomplete North Atlantic file')
    if existing and len(storms)<len(existing['storms'])*0.95:
        raise ValueError('Unexpected loss of archived storms')
    if (existing and existing['sha256'] == digest and existing['storms'] == storms
            and existing['retrieved'] == fetched and existing['source_updated'] == updated):
        print('This source was already retrieved today')
        return
    payload = dict(version='IBTrACS v04r01',source=URL,sha256=digest,source_updated=updated,
                   retrieved=fetched,positions=total,storms=storms)
    value = gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent,delete=False) as temp:
        temp.write(value)
    Path(temp.name).replace(destination)
    print(f'{len(storms):,} tracks, {total:,} positions; {len(value):,} compressed bytes')


if __name__=='__main__':
    with urlopen(Request(URL,headers={'User-Agent':'CoolCode Storm Tracks/1.0'}),timeout=120) as response:
        updated = parsedate_to_datetime(response.headers['Last-Modified']).date().isoformat()
        raw = response.read()
    save(raw,updated,datetime.now(timezone.utc).date().isoformat())
