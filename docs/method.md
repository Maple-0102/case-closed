# Method and validation

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the team.

## From monthly data to one value per year
- Monthly values from Giovanni (area average over a 1° × 1° box) are converted to display units (`scripts/build_data.py`).
- A year counts only if all 12 months have data. Its value is the day-weighted mean of the 12 months. For rain, the mean daily rate is multiplied by the number of days in the year to give a yearly total.
- Nothing is gap-filled.
- Satellite aerosol (MODIS) has seasonal gaps (dark winters, cloudy rainy seasons). Where a place has fewer than 10 complete years, we use only the calendar months observed in at least 5 of every 6 years and average those months, in years where all of them are present. The page says which months were used.

## Trend test (`src/stats.js`)
- **Mann-Kendall test** (two-sided, α = 0.05) with the standard correction for tied values.
- **Sen's slope** (median of all pairwise slopes, using the real gap between years) and its 95% confidence interval (Sen 1968), with ranks interpolated linearly.
- **Autocorrelation correction** (Yue & Wang 2004): lag-1 autocorrelation of the Sen-detrended series (consecutive years only), small-sample adjusted as (n·r1 + 1)/(n − 4) and clamped to [0, 0.95]; the variance of S is multiplied by 1 + 2 Σ (1 − k/n) ρ^k. Negative autocorrelation is not used to shrink the variance.
- **Several places at once**: Benjamini-Hochberg adjusted p-values (q) across the 8 places for each variable; the page uses q < 0.05.
- Fewer than 10 usable years: no test.

## Independent check (14 November 2026)
Yearly mean air temperature (MERRA-2 T2M, Giovanni 1° box, 1991–2025), uncorrected test, compared with `pymannkendall` 1.4.3 (`original_test`) and `scipy.stats.theilslopes` (SciPy 1.x):

| Place | S | Var(S) | z | p | Sen slope (°C/yr) | 95% CI ours | 95% CI SciPy |
|---|---|---|---|---|---|---|---|
| Singapore | 319 | 4958.333 | 4.516055 | 6.30e-6 | 0.0251749 | 0.01738 – 0.03374 | 0.01736 – 0.03391 |
| New Delhi | −165 | 4958.333 | −2.329035 | 1.99e-2 | −0.0251343 | −0.04640 – −0.00585 | −0.04648 – −0.00580 |
| London | 269 | 4958.333 | 3.805984 | 1.41e-4 | 0.0369282 | 0.02185 – 0.05197 | 0.02182 – 0.05201 |

S, Var(S), z, p and the slope agree exactly. The interval differs by less than 0.0002 °C/yr because SciPy uses whole-number ranks and we interpolate.
With the autocorrelation correction: Singapore p = 1.7e-4, New Delhi p = 0.036, London p = 1.4e-4.

## Thermometer check (NOAA GHCN-Monthly v4)
For each city we take the station with the most complete 1991–2025 record inside its 1° × 1° box (quality-controlled, homogeneity-adjusted monthly mean temperature) and run the same test. Compared over the same years, the model (MERRA-2 region average) and the station:

| City | Station | Complete years | Station °C/decade | Model °C/decade (same years) | Same direction |
|---|---|---|---|---|---|
| Singapore | Changi | 28 | +0.26 | +0.24 | yes |
| New Delhi | Safdarjung | 32 | +0.16 | −0.23 | **no** |
| Cairo | Helwan | 10 | +0.36 | +0.10 | yes |
| London | Heathrow | 34 | +0.40 | +0.38 | yes |
| Moscow | Moscow | 35 | +0.59 | +0.52 | yes |
| Nuuk | Nuuk | 35 | +0.35 | +0.27 | yes |
| Manaus | Manaus | 21 | +0.31 | +0.19 | yes |
| Sydney | Sydney Airport | 35 | +0.40 | +0.35 | yes |

Seven of eight agree closely. In New Delhi the model shows cooling and the station shows (non-significant) warming; the page says so next to the answer.

## Global comparison (NASA GISTEMP v4)
The global land-ocean temperature index (monthly anomalies) is averaged per year in the same way and tested over the same years as each city. 1991–2025: +0.24 °C per decade (95% CI 0.19–0.30). The page shows the ratio of the city's Sen slope to the global one, only when the city's trend is significant.
