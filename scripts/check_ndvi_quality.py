"""Quality check for the NDVI months we keep: decode the MOD13A3 VI Quality bits.

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.

Reads data/raw/appeears/MOD13A3-061-1-km-monthly-VI-Quality-Statistics-QA.csv (pixel counts per
16-bit QA value, per box and month) and data/processed/series.json. Counts land pixels only
(fill 65535 and ocean classes of bits 11-13 are dropped), then reports, for the months kept in
the page data, the median share of pixels flagged as adjacent cloud (bit 8), mixed clouds
(bit 10), high aerosol (bits 6-7 = 3) or shadow (bit 15), and how many months have more than
20% of pixels with one of these flags. Run:  python3 -I scripts/check_ndvi_quality.py
"""
import pathlib
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
import csv, json, sys, statistics
root = str(ROOT)
F = root + '/data/raw/appeears/MOD13A3-061-1-km-monthly-VI-Quality-Statistics-QA.csv'
data = json.load(open(root + '/data/processed/series.json'))
sites = ['singapore','delhi','cairo','london','moscow','nuuk','manaus','sydney']
flags = {}
with open(F) as f:
    r = csv.reader(f); head = next(r); codes = [int(c) for c in head[3:]]
    for row in r:
        # Land pixels only: drop fill (65535) and ocean classes of the land/water bits (11-13: 0 shallow ocean, 6 moderate, 7 deep).
        allc = [float(x) if x else 0.0 for x in row[3:]]
        keep = [c != 65535 and ((c >> 11) & 7) not in (0, 6, 7) for c in codes]
        n = [v if k else 0.0 for v, k in zip(allc, keep)]; tot = sum(n)
        if not tot: continue
        def share(test): return sum(c for code, c in zip(codes, n) if test(code)) / tot
        flags[(row[1], row[2][:7])] = {
            'probCloudy': share(lambda q: (q & 3) == 2),
            'adjCloud': share(lambda q: (q >> 8) & 1),
            'mixedCloud': share(lambda q: (q >> 10) & 1),
            'highAerosol': share(lambda q: ((q >> 6) & 3) == 3),
            'shadow': share(lambda q: (q >> 15) & 1),
            'snow': share(lambda q: (q >> 14) & 1),
            'lowUse': share(lambda q: ((q >> 2) & 15) >= 12),
        }
out = {}
for i, s in enumerate(sites):
    e = data['series'][s]['NDVI']; aid = f'aid{i+1:04d}'
    y0, m0 = 2000, 2
    kept = []
    for k, v in enumerate(e['values']):
        if v is None: continue
        mm = m0 - 1 + k; ym = f'{y0 + mm // 12}-{mm % 12 + 1:02d}'
        if (aid, ym) in flags: kept.append((ym, flags[(aid, ym)]))
    if not kept: print(s, 'no kept months'); continue
    med = {k: statistics.median(f[k] for _, f in kept) for k in kept[0][1]}
    worst = {k: max(f[k] for _, f in kept) for k in kept[0][1]}
    bad = [ym for ym, f in kept if f['adjCloud'] + f['mixedCloud'] > 0.2 or f['highAerosol'] > 0.2 or f['shadow'] > 0.2]
    out[s] = bad
    print(f"{s:10} kept {len(kept):3} | median %: " + ' '.join(f"{k} {100*v:.0f}" for k, v in med.items()) + f" | months >20% adj/mixed cloud, high aerosol or shadow: {len(bad)}")
pathlib.Path(tempfile.gettempdir(), "ndvi-flagged-months.json").write_text(json.dumps(out))
