# Method and validation

Written with help from Claude (Anthropic) as a coding assistant; reviewed by the author.

## From monthly data to one value per year
- Monthly values from Giovanni (area average over a 1° × 1° box) are converted to display units (`scripts/build_data.py`).
- A year counts only if all 12 months have data. Its value is the day-weighted mean of the 12 months. For rain, the mean daily rate is multiplied by the number of days in the year to give a yearly total.
- Nothing is gap-filled.
- Satellite aerosol (MODIS) has seasonal gaps (dark winters, cloudy rainy seasons). Where a place has fewer than 10 complete years, we use only the calendar months observed in at least 5 of every 6 years and average those months, in years where all of them are present. The page says which months were used.

## Plant greenness (MODIS NDVI via AppEEARS)
- MOD13A3 v6.1 monthly 1 km NDVI, requested from NASA AppEEARS as an area sample over the same 1° × 1° boxes (request submitted 14 November 2026 09:25 SGT, completed 15:58 SGT). We use AppEEARS's per-month area statistics (`MOD13A3-061-Statistics.csv`, the mean of all non-fill pixels).
- That mean includes cloudy and snow-covered pixels, so each month is checked against the pixel-reliability statistics: a month is used only if at least 80% of the box's pixels are good or marginal quality (reliability 0 or 1). Other months are set to missing and never corrected.
- Yearly values then follow the same rules as satellite haze: all 12 months if there are at least 10 such years, otherwise only the calendar months observed in at least 5 of every 6 years (Moscow April–October, Nuuk July–September, Manaus April–October and December). Singapore is cloudy in too many months to test.
- Result (14 November 2026): none of the 7 testable cities shows a trend that survives the correction for testing eight places. London, Sydney and New Delhi have p < 0.05 on their own but q ≈ 0.10.

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

Seven of eight agree closely. In New Delhi the model looks like cooling and the station looks like warming; the page says so next to the answer.

The page uses the same rule: model and station are always compared over the years both have complete, and each one's full record is shown alongside as a supplement. Over those 32 shared years in New Delhi, neither trend is significant on its own (model −0.23, station +0.16 °C per decade), and they point in opposite directions, so not even the direction is settled. Over its full 35 years the model's cooling is only just significant (q = 0.048), and the start-year check finds it significant from only 9 of 21 start years. The page presents New Delhi as an open case.

## Start-year check ("Don't get fooled", `startYearCheck` and `correctAcrossSites` in `src/data.js`)
Does the answer depend on which year we start counting from? A slider under the main chart lets the user move the start year and see the chart and the stamp change.
- The end year stays at the last complete year. The start moves forward one year at a time. Every window needs at least 15 calendar years and 15 complete years (1991–2025 gives 21 start years, 1991–2011). Start years with missing data are skipped, not replaced by the next year.
- The yearly values are built once, so every window uses the same months (this matters for the seasonal satellite haze series).
- Every window is judged by the same rule as the official answer: Mann-Kendall with the autocorrelation correction, then one Benjamini-Hochberg correction across all places that have that start year. The full-record window takes the official q-value, so dragging the slider back to the first year always gives the official stamp.
- Windows overlap heavily and are not corrected against each other; each 95% interval covers only its own window. The check is exploratory and never changes the official answer or the report's verdict.
- Verdicts, checked in this order: no window supported ("no start year cracks this case"); slopes of both signs ("this story flips"); every window supported in the same direction ("rock solid"); otherwise same direction but some windows not supported. If the official answer is "not proven" but some start years would earn a "Trend supported" stamp on their own, the page warns that this is how people get fooled.
- The report names the "most misleading start year": the one whose slope differs most from the full-period slope (largest absolute difference), with its slope, interval and number of years, plus the range of all slopes.
- Records with fewer than 20 complete years are not checked. This is a design threshold of the tool, not a statistical guarantee.
- Only the start year varies; the end year and the data source are fixed.

## Global comparison (NASA GISTEMP v4)
The global land-ocean temperature index (monthly anomalies) is averaged per year in the same way and tested over the same years as each city. 1991–2025: +0.24 °C per decade (95% CI 0.19–0.30). The page shows the ratio of the city's Sen slope to the global one, only when the city's trend is significant.
