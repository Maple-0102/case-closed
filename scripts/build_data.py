"""Turn the raw downloads into one file the web page reads: data/processed/series.json.

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.

Inputs (never modified):
  data/raw/giovanni/<site>__<VARIABLE_ID>__<YYYYMMDD-YYYYMMDD>.csv   Giovanni area averages (1 deg box)
  data/raw/power/<site>.json                                        NASA POWER (backup / cross-check)
Output:
  data/processed/series.json  monthly values per site and variable, in display units,
  with a full monthly calendar (missing months = null), plus provenance (SHA-256 of
  each raw file, product, DOI, conversion).

Nothing is gap-filled. Fill values become null.
Run from the repository root:  python3 -I scripts/build_data.py
"""
import csv
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW_G = ROOT / 'data' / 'raw' / 'giovanni'
RAW_P = ROOT / 'data' / 'raw' / 'power'
OUT = ROOT / 'data' / 'processed' / 'series.json'

# Our variable id -> where it comes from and how to convert to display units.
VARIABLES = {
    'T2M': {'giovanni': 'M2TMNXSLV_5_12_4_T2M', 'product': 'MERRA-2 M2TMNXSLV v5.12.4', 'doi': '10.5067/AP1B0BA5PD2K',
            'kind': 'model', 'unit': 'degC', 'from': 'K', 'convert': 'K_to_C', 'annual': 'mean'},
    'PRECIP': {'giovanni': 'M2TMNXFLX_5_12_4_PRECTOTCORR', 'product': 'MERRA-2 M2TMNXFLX v5.12.4 (PRECTOTCORR)', 'doi': '10.5067/0JRLVL8YV2Y4',
               'kind': 'model', 'unit': 'mm/day', 'from': 'kg m-2 s-1', 'convert': 'per_s_to_per_day', 'annual': 'total'},
    'SOIL': {'giovanni': 'M2TMNXLND_5_12_4_GWETROOT', 'product': 'MERRA-2 M2TMNXLND v5.12.4 (GWETROOT)', 'doi': '10.5067/8S35XF81C28F',
             'kind': 'model', 'unit': 'fraction', 'from': '1', 'convert': None, 'annual': 'mean'},
    'SUN': {'giovanni': 'M2TMNXRAD_5_12_4_SWGDN', 'product': 'MERRA-2 M2TMNXRAD v5.12.4 (SWGDN)', 'doi': '10.5067/OU3HJDS973O0',
            'kind': 'model', 'unit': 'W m-2', 'from': 'W m-2', 'convert': None, 'annual': 'mean'},
    'AOD_MODEL': {'giovanni': 'M2TMNXAER_5_12_4_TOTEXTTAU', 'product': 'MERRA-2 M2TMNXAER v5.12.4 (TOTEXTTAU, 550 nm)', 'doi': '10.5067/FH9A0MLJPC7N',
                  'kind': 'model', 'unit': '1', 'from': '1', 'convert': None, 'annual': 'mean'},
    'AOD': {'giovanni': 'MOD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean_Mean', 'product': 'MODIS Terra MOD08_M3 v6.1 (AOD 550 nm, DT+DB)', 'doi': '10.5067/MODIS/MOD08_M3.061',
            'kind': 'satellite', 'unit': '1', 'from': '1', 'convert': None, 'annual': 'mean', 'seasonal': True},
    'AOD_AQUA': {'giovanni': 'MYD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean_Mean', 'product': 'MODIS Aqua MYD08_M3 v6.1 (AOD 550 nm, DT+DB)', 'doi': '10.5067/MODIS/MYD08_M3.061',
                 'kind': 'satellite', 'unit': '1', 'from': '1', 'convert': None, 'annual': 'mean', 'seasonal': True},
    'IMERG': {'giovanni': 'GPM_3IMERGM_07_precipitation', 'product': 'GPM IMERG Final Run V07 monthly (GPM_3IMERGM)', 'doi': '10.5067/GPM/IMERG/3B-MONTH/07',
              'kind': 'satellite', 'unit': 'mm/day', 'from': 'mm/hr', 'convert': 'per_hr_to_per_day', 'annual': 'total'},
}
CONVERT = {
    None: lambda v: v,
    'K_to_C': lambda v: v - 273.15,
    'per_s_to_per_day': lambda v: v * 86400.0,
    'per_hr_to_per_day': lambda v: v * 24.0,
}


def months(start, end):
    y, m = start
    while (y, m) <= end:
        yield f'{y:04d}-{m:02d}'
        m += 1
        if m == 13:
            y, m = y + 1, 1


def read_giovanni(path):
    raw = path.read_bytes()
    lines = raw.decode('utf-8').splitlines()
    meta, start = {}, None
    for i, line in enumerate(lines):
        if line.startswith('time,'):
            start = i + 1
            break
        if ':,' in line:
            key, value = line.split(':,', 1)
            meta[key.strip()] = value.strip().strip('"')
    fill = float(next(v for k, v in meta.items() if k.startswith('Fill Value')))
    values = {}
    for row in csv.reader(lines[start:]):
        if not row or not row[0].strip() or len(row) < 2 or not row[1].strip():
            continue
        v = float(row[1])
        values[row[0].strip()[:7]] = None if abs(v - fill) <= 1e-6 * max(1.0, abs(fill)) else v
    return raw, meta, values


def main():
    regions = json.loads((ROOT / 'data' / 'regions.geojson').read_text())['features']
    by_id = {VARIABLES[k]['giovanni']: k for k in VARIABLES}
    out = {
        'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'builtWith': 'scripts/build_data.py (written with help from Claude, an AI assistant)',
        'sites': [f['properties'] for f in regions],
        'variables': {k: {key: v for key, v in meta.items() if key != 'convert'} | {'conversion': meta['convert']} for k, meta in VARIABLES.items()},
        'series': {},
    }
    for path in sorted(RAW_G.glob('*.csv')):
        site, gid, rng = path.stem.split('__')
        vid = by_id.get(gid)
        if vid is None:
            print('skip (unknown variable):', path.name)
            continue
        raw, meta, values = read_giovanni(path)
        a, b = rng.split('-')
        cal = list(months((int(a[:4]), int(a[4:6])), (int(b[:4]), int(b[4:6]))))
        conv = CONVERT[VARIABLES[vid]['convert']]
        series = [None if values.get(m) is None else round(conv(values[m]), 6) for m in cal]
        out['series'].setdefault(site, {})[vid] = {
            'start': cal[0], 'end': cal[-1], 'values': series,
            'missing': sum(v is None for v in series),
            'source': {'via': 'NASA Giovanni 4.40 (area-averaged time series)', 'file': f'data/raw/giovanni/{path.name}',
                       'sha256': hashlib.sha256(raw).hexdigest(), 'userBox': meta.get('User Bounding Box'),
                       'dataBox': meta.get('Data Bounding Box'), 'reproduce': meta.get('URL to Reproduce Results')},
        }
    # NASA POWER grid-cell values, kept as a cross-check (same MERRA-2 model, single grid cell).
    for path in sorted(RAW_P.glob('*.json')):
        if path.name == 'manifest.json':
            continue
        raw = path.read_bytes()
        data = json.loads(raw)
        params = data['properties']['parameter']
        cal = list(months((1991, 1), (2025, 12)))
        for pid, vid, conv in [('T2M', 'T2M_POWER', lambda v: v), ('PRECTOTCORR', 'PRECIP_POWER', lambda v: v), ('GWETROOT', 'SOIL_POWER', lambda v: v)]:
            p = params[pid]
            vals = [None if p.get(m.replace('-', '')) in (None, data['header']['fill_value']) else round(conv(p[m.replace('-', '')]), 6) for m in cal]
            out['series'].setdefault(path.stem, {})[vid] = {
                'start': cal[0], 'end': cal[-1], 'values': vals, 'missing': sum(v is None for v in vals),
                'source': {'via': f"NASA POWER Monthly API {data['header']['api']['version']} (MERRA2 grid cell)", 'file': f'data/raw/power/{path.name}',
                           'sha256': hashlib.sha256(raw).hexdigest()},
            }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(',', ':')))
    for site, vs in out['series'].items():
        print(site, ' '.join(f"{k}:{v['start'][:4]}-{v['end'][:4]}/miss{v['missing']}" for k, v in sorted(vs.items())))


if __name__ == '__main__':
    main()
