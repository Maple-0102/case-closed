"""Move Giovanni area-averaged time-series CSVs from ~/Downloads into data/raw/giovanni/.

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.

Giovanni names files like
  g4.areaAvgTimeSeries.<VARIABLE_ID>.<YYYYMMDD-YYYYMMDD>.<bbox tag>.csv
The bbox tag (e.g. 76E_28N_77E_29N) is matched to a site in data/regions.geojson.
Output name: <site>__<VARIABLE_ID>__<YYYYMMDD-YYYYMMDD>.csv  (raw file, unchanged bytes)

Run from the repository root:  python3 -I scripts/collect_giovanni.py
"""
import json
import math
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOWNLOADS = pathlib.Path.home() / 'Downloads'
OUT = ROOT / 'data' / 'raw' / 'giovanni'
PATTERN = re.compile(r'^g4\.areaAvgTimeSeries\.(?P<var>.+)\.(?P<range>\d{8}-\d{8})\.(?P<tag>[^.]+)\.csv$')


def tag_for(bbox):
    """Giovanni's tag: truncated absolute degrees plus hemisphere, for W,S,E,N."""
    w, s, e, n = bbox
    lon = lambda v: f"{math.trunc(abs(v))}{'W' if v < 0 else 'E'}"
    lat = lambda v: f"{math.trunc(abs(v))}{'S' if v < 0 else 'N'}"
    return f'{lon(w)}_{lat(s)}_{lon(e)}_{lat(n)}'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    regions = json.loads((ROOT / 'data' / 'regions.geojson').read_text())['features']
    sites = {tag_for(f['properties']['bbox']): f['properties']['id'] for f in regions}
    moved = 0
    for path in sorted(DOWNLOADS.glob('g4.areaAvgTimeSeries.*.csv')):
        m = PATTERN.match(path.name)
        if not m or m['tag'] not in sites:
            print('skip (unknown site):', path.name)
            continue
        target = OUT / f"{sites[m['tag']]}__{m['var']}__{m['range']}.csv"
        if target.exists():
            print('skip (already have):', target.name)
            continue
        shutil.move(str(path), target)
        moved += 1
    print(moved, 'moved;', len(list(OUT.glob('*.csv'))), 'files in', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
