"""Download monthly NASA POWER data (MERRA-2 based) for the study sites.

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.

Saves the raw API response for each site to data/raw/power/<site>.json and writes
data/raw/power/manifest.json with the request URL, retrieval time and SHA-256.
Requests are sent one at a time with a pause, to be polite to the server.

Run from the repository root:  python3 -I scripts/fetch_power.py
"""
import datetime
import hashlib
import json
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'raw' / 'power'
ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/monthly/point'
PARAMETERS = ['T2M', 'PRECTOTCORR', 'GWETROOT']  # not ALLSKY_SFC_SW_DWN: SRB + CERES spliced record
START, END = 1991, 2025


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    regions = json.loads((ROOT / 'data' / 'regions.geojson').read_text())['features']
    manifest = {'api': ENDPOINT, 'parameters': PARAMETERS, 'files': []}
    for feature in regions:
        props = feature['properties']
        url = (f"{ENDPOINT}?parameters={','.join(PARAMETERS)}&community=AG"
               f"&longitude={props['lon']}&latitude={props['lat']}&format=JSON&start={START}&end={END}")
        raw = urllib.request.urlopen(url, timeout=120).read()
        data = json.loads(raw)
        (OUT / f"{props['id']}.json").write_bytes(raw)
        manifest['files'].append({
            'site': props['id'],
            'file': f"data/raw/power/{props['id']}.json",
            'url': url,
            'retrieved': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
            'sources': data['header']['sources'],
            'apiVersion': data['header']['api']['version'],
            'sha256': hashlib.sha256(raw).hexdigest(),
        })
        print(props['id'], data['header']['sources'], hashlib.sha256(raw).hexdigest()[:12])
        time.sleep(2)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1))


if __name__ == '__main__':
    main()
