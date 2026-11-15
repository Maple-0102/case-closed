# Case Closed? (previously titled Trend Detective)

A tool for the NASA Space Apps Challenge 2026 challenge **"Be An Earth System Trend Detective!"** (Singapore local event, virtual).

This is the public release of our NASA Space Apps 2026 entry. The earliest commit in its development history is dated **14 November 2026 at 10:15 SGT**, after the hackathon started (09:00 SGT). All code and data were written or downloaded during the hackathon.

Live site: https://maple-0102.github.io/case-closed/

## What it does

Pick a question, a place and an Earth-science variable. The tool shows how the variable changed year by year and answers four questions: did it change, which way, by how much, and how sure we are (Mann-Kendall test with confidence intervals). A start-year check shows whether the answer depends on the year you start counting from.

## NASA data used

Every dataset below is listed with its source, the period used and how it supports the tool. Download dates and SHA-256 checksums are stored with each file in `data/`.

All Giovanni series are area averages over a 1° × 1° box centred on each city (`data/regions.geojson`), downloaded on 14 November 2026.

| Variable | Product (DOI) | Access | Period | Used for |
|---|---|---|---|---|
| Air temperature (2 m) | MERRA-2 M2TMNXSLV v5.12.4 ([10.5067/AP1B0BA5PD2K](https://doi.org/10.5067/AP1B0BA5PD2K)) | NASA Giovanni | 1991–2025 | Main trend variable |
| Rain and snow | MERRA-2 M2TMNXFLX v5.12.4, PRECTOTCORR ([10.5067/0JRLVL8YV2Y4](https://doi.org/10.5067/0JRLVL8YV2Y4)) | NASA Giovanni | 1991–2025 | Water clue |
| Root-zone soil wetness | MERRA-2 M2TMNXLND v5.12.4, GWETROOT ([10.5067/8S35XF81C28F](https://doi.org/10.5067/8S35XF81C28F)) | NASA Giovanni | 1991–2025 | Water clue |
| Sunlight reaching the ground | MERRA-2 M2TMNXRAD v5.12.4, SWGDN ([10.5067/OU3HJDS973O0](https://doi.org/10.5067/OU3HJDS973O0)) | NASA Giovanni | 1991–2025 | Air clue |
| Aerosol optical depth (model) | MERRA-2 M2TMNXAER v5.12.4, TOTEXTTAU ([10.5067/FH9A0MLJPC7N](https://doi.org/10.5067/FH9A0MLJPC7N)) | NASA Giovanni | 1991–2025 | Gap-free haze series |
| Aerosol optical depth (satellite, Terra) | MODIS MOD08_M3 v6.1, AOD 550 nm DT+DB ([10.5067/MODIS/MOD08_M3.061](https://doi.org/10.5067/MODIS/MOD08_M3.061)) | NASA Giovanni | 2001–2025 | Independent haze check |
| Aerosol optical depth (satellite, Aqua) | MODIS MYD08_M3 v6.1, AOD 550 nm DT+DB ([10.5067/MODIS/MYD08_M3.061](https://doi.org/10.5067/MODIS/MYD08_M3.061)) | NASA Giovanni | 2002-07–2025 | Cross-check of Terra |
| Rain (satellite) | GPM IMERG Final V07 monthly, GPM_3IMERGM ([10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07)) | NASA Giovanni | 1998–2024 | Independent rain check |
| Vegetation (NDVI) | MODIS MOD13A3 v6.1 ([10.5067/MODIS/MOD13A3.061](https://doi.org/10.5067/MODIS/MOD13A3.061)) | NASA AppEEARS area statistics, downloaded 14 November 2026 | 2000–2025 | Plant greenness; months with more than 20% cloud or snow are left out |
| Global temperature (for comparison) | NASA GISS GISTEMP v4, global land-ocean index ([data.giss.nasa.gov/gistemp](https://data.giss.nasa.gov/gistemp/)) | `GLB.Ts+dSST.csv` | 1991–2025 | City vs global average |
| T2M, PRECTOTCORR, GWETROOT (grid cell) | NASA POWER Monthly API v2.10.0 (MERRA-2) | power.larc.nasa.gov | 1991–2025 | Cross-check of the area averages |

Giovanni acknowledgement: analyses and visualizations used in this project were produced with the Giovanni online data system, developed and maintained by the NASA GES DISC.

## Other data and resources

| Resource | Licence | Used for |
|---|---|---|
| [NOAA NCEI GHCN-Monthly v4](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-monthly) (TAVG, qcf, version 20261112; one station per city), downloaded 14 November 2026 | U.S. Government work, public domain | Thermometer check of the model temperature (`data/raw/noaa/`) |
| [world-atlas](https://github.com/topojson/world-atlas) 2.0.2, `land-110m.json` (from [Natural Earth](https://www.naturalearthdata.com/), public domain) | ISC (`vendor/LICENSE-world-atlas`) | Land outlines on the map |
| [topojson-client](https://github.com/topojson/topojson-client) 3.1.0 | ISC (`vendor/LICENSE-topojson-client`) | Reading the map file |
| Mann-Kendall test; Sen (1968) slope and confidence interval; Yue & Wang (2004) autocorrelation correction; Benjamini & Hochberg (1995) | Published methods | Trend statistics (`docs/method.md`) |
| Acklam's inverse normal approximation; Numerical Recipes `erfcc` | Published algorithms | Normal distribution in `src/stats.js` |
| [pymannkendall](https://github.com/mmhs013/pyMannKendall) and [SciPy](https://scipy.org/) | MIT / BSD-3-Clause | Independent check of our results only (not shipped) |

## Run locally

```sh
python3 -m http.server 8000      # then open http://localhost:8000
node --test                       # tests
python3 -I scripts/build_data.py  # rebuild data/processed/series.json from data/raw
```

## Use of Super Intelligence (SI) tools

This is a solo project. I used Anthropic's Claude and OpenAI ChatGPT/Codex as coding assistants to help write and revise the code and the data scripts in this repository, and to help draft page and slide text, which I reviewed and edited. The idea, the questions and the design of the tool are my own. Files written with SI help say so in a header comment. The 30-second demo video is made from screen captures of the live site and was edited with AI assistance (including Claude and OpenAI ChatGPT/Codex); every frame is labelled “edited with AI assistance”. Its English narration is an AI-generated (synthetic) voice reading a script I approved, and this is stated in the video description. No other images, video or audio in this project are generated by SI.

## Licence

MIT (see `LICENSE`). Third-party data and code keep their own licences, listed above.
