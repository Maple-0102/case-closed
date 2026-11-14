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
