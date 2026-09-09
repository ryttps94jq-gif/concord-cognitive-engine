# Lens stacked-UI report

Generated 2026-09-09T05:45:17.299Z · `node scripts/detect-lens-stacking.mjs`

266 lenses scanned. **12 heavy** (score ≥ 12) · **5 moderate** (7–12) · 249 clean.

`stackingScore` weights the **welded-piles** signature, NOT raw size: `inlineBloat` (LOC not explained by delegated panels), **independent view-state machines beyond the first** (one tab machine is fine — 2+ separate ones gating different regions is welded apps), heterogeneous render strategies in one file (tab-union + `&&`-screens + boolean modal toggles all coexisting = piled by different sessions), hook sprawl (`useState`/`useEffect` over the norm), top-level screen branches, literal-only dead view values, and duplicate action paths. A thin page that delegates 17 tabs to 17 panel components (e.g. `retail`, 191 LOC) is the GOOD pattern and scores low. Read the columns, not just the score.

| lens | score | LOC | inlineBloat | feat-cmp | view-SM | render-strat | useState | useEffect | screen-br | dead-view | dup-act |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| `world` | 27.99 | 7625 | 4945 | 38 | 3 | 3 | 90 | 43 | 67 | 3 | 0 |
| `chat` | 17.07 | 4951 | 1791 | 46 | 2 | 3 | 66 | 16 | 31 | 0 | 0 |
| `healthcare` | 16.37 | 4015 | 2955 | 11 | 3 | 2 | 71 | 0 | 13 | 0 | 0 |
| `trades` | 15 | 2607 | 1127 | 18 | 3 | 2 | 58 | 0 | 21 | 0 | 0 |
| `studio` | 14.88 | 2991 | 1391 | 20 | 2 | 2 | 50 | 6 | 20 | 0 | 1 |
| `education` | 14.64 | 4789 | 2829 | 26 | 2 | 2 | 61 | 1 | 24 | 0 | 0 |
| `fitness` | 14 | 2138 | 1198 | 9 | 3 | 2 | 53 | 0 | 8 | 0 | 0 |
| `crypto` | 12.98 | 1704 | 584 | 12 | 2 | 3 | 30 | 2 | 34 | 0 | 0 |
| `council` | 12.83 | 3279 | 2399 | 8 | 2 | 2 | 23 | 0 | 11 | 0 | 0 |
| `game` | 12.65 | 1583 | 883 | 5 | 3 | 2 | 20 | 2 | 8 | 0 | 0 |
| `music` | 12.18 | 2455 | 1515 | 9 | 2 | 2 | 25 | 1 | 12 | 0 | 0 |
| `code` | 12.09 | 2684 | 1204 | 18 | 0 | 2 | 47 | 7 | 33 | 0 | 0 |
| `board` | 8.7 | 2050 | 1530 | 2 | 1 | 2 | 21 | 2 | 9 | 0 | 0 |
| `poetry` | 8.67 | 570 | 0 | 8 | 0 | 2 | 17 | 1 | 5 | 0 | 2 |
| `crafting` | 7.66 | 1401 | 821 | 3 | 1 | 1 | 45 | 6 | 25 | 0 | 0 |
| `worldmodel` | 7.3 | 1212 | 572 | 4 | 1 | 1 | 45 | 0 | 32 | 0 | 0 |
| `agents` | 7 | 1433 | 673 | 6 | 1 | 2 | 18 | 1 | 9 | 0 | 0 |
| `attention` | 6.92 | 1016 | 76 | 9 | 2 | 1 | 11 | 2 | 7 | 0 | 2 |
| `import` | 6.86 | 1186 | 546 | 4 | 1 | 2 | 17 | 0 | 12 | 0 | 0 |
| `understanding` | 6.66 | 1008 | 368 | 4 | 0 | 0 | 33 | 3 | 27 | 0 | 0 |
| `inference` | 6.56 | 795 | 275 | 2 | 1 | 2 | 18 | 1 | 9 | 0 | 0 |
| `app-maker` | 6.3 | 704 | 124 | 3 | 1 | 2 | 16 | 1 | 14 | 0 | 0 |
| `podcast` | 6.06 | 981 | 281 | 5 | 1 | 1 | 23 | 2 | 24 | 0 | 0 |
| `metalearning` | 5.92 | 817 | 0 | 8 | 1 | 2 | 16 | 1 | 11 | 0 | 0 |
| `forum` | 5.45 | 1270 | 630 | 4 | 0 | 1 | 26 | 2 | 9 | 0 | 0 |
| `art` | 5.1 | 1255 | 315 | 9 | 0 | 1 | 30 | 2 | 9 | 0 | 0 |
| `federation` | 5.08 | 793 | 0 | 10 | 1 | 1 | 21 | 1 | 22 | 0 | 0 |
| `linguistics` | 5.08 | 878 | 0 | 10 | 1 | 1 | 26 | 0 | 13 | 0 | 0 |
| `construction` | 4.93 | 880 | 240 | 4 | 1 | 1 | 26 | 0 | 8 | 0 | 0 |
| `cognition` | 4.75 | 471 | 0 | 7 | 2 | 1 | 6 | 0 | 9 | 0 | 1 |
| `diy` | 4.72 | 872 | 352 | 2 | 1 | 1 | 29 | 0 | 4 | 0 | 0 |
| `electrical` | 4.67 | 819 | 0 | 9 | 1 | 0 | 24 | 0 | 8 | 0 | 0 |
| `logistics` | 4.67 | 530 | 0 | 16 | 1 | 2 | 7 | 1 | 20 | 0 | 0 |
| `meditation` | 4.67 | 705 | 0 | 6 | 1 | 1 | 22 | 4 | 14 | 0 | 0 |
| `inheritance` | 4.59 | 902 | 382 | 2 | 0 | 0 | 43 | 3 | 2 | 0 | 0 |
| `hvac` | 4.57 | 781 | 141 | 4 | 1 | 1 | 24 | 0 | 5 | 0 | 0 |
| `photography` | 4.56 | 916 | 276 | 4 | 0 | 1 | 21 | 5 | 8 | 0 | 0 |
| `literary` | 4.44 | 710 | 250 | 1 | 1 | 1 | 26 | 4 | 2 | 0 | 0 |
| `thread` | 4.42 | 1095 | 455 | 4 | 0 | 1 | 20 | 4 | 11 | 0 | 0 |
| `debate` | 4.33 | 1072 | 372 | 5 | 0 | 1 | 20 | 4 | 11 | 0 | 0 |
| `disputes` | 4.03 | 1057 | 477 | 3 | 1 | 1 | 17 | 0 | 15 | 0 | 0 |
| `materials` | 4 | 385 | 0 | 6 | 1 | 0 | 37 | 0 | 0 | 0 | 0 |
| `engineering` | 3.97 | 1210 | 270 | 9 | 0 | 1 | 17 | 1 | 17 | 0 | 0 |
| `consulting` | 3.79 | 768 | 188 | 3 | 1 | 1 | 20 | 0 | 7 | 0 | 0 |
| `analytics` | 3.75 | 736 | 0 | 6 | 1 | 2 | 5 | 0 | 9 | 0 | 0 |
| `goals` | 3.68 | 1027 | 387 | 4 | 1 | 1 | 18 | 0 | 9 | 0 | 0 |
| `sub-worlds` | 3.67 | 439 | 0 | 6 | 0 | 1 | 15 | 2 | 5 | 0 | 1 |
| `creatures` | 3.49 | 522 | 62 | 1 | 0 | 0 | 20 | 3 | 5 | 0 | 0 |
| `bridge` | 3.46 | 765 | 185 | 3 | 0 | 0 | 11 | 1 | 30 | 0 | 0 |
| `home-improvement` | 3.43 | 955 | 15 | 9 | 1 | 1 | 19 | 1 | 8 | 0 | 0 |
| `chem` | 3.33 | 433 | 0 | 7 | 1 | 2 | 6 | 0 | 4 | 0 | 0 |
| `tournaments` | 3.33 | 556 | 0 | 6 | 1 | 1 | 19 | 2 | 7 | 0 | 0 |
| `housing` | 3.19 | 567 | 167 | 0 | 0 | 0 | 20 | 4 | 0 | 0 | 0 |
| `database` | 3.18 | 1270 | 690 | 3 | 1 | 0 | 10 | 1 | 23 | 0 | 0 |
| `maker` | 3.17 | 344 | 0 | 3 | 2 | 1 | 5 | 0 | 8 | 0 | 0 |
| `kingdoms` | 3.08 | 553 | 0 | 6 | 1 | 1 | 18 | 1 | 7 | 0 | 0 |
| `system` | 3.08 | 946 | 0 | 10 | 2 | 1 | 4 | 0 | 7 | 0 | 0 |
| `mail` | 3.07 | 585 | 65 | 2 | 0 | 0 | 17 | 4 | 9 | 0 | 0 |
| `saved` | 3 | 465 | 0 | 5 | 0 | 0 | 20 | 2 | 0 | 0 | 0 |
| `organ` | 2.67 | 896 | 376 | 2 | 0 | 1 | 13 | 0 | 12 | 0 | 0 |
| `resonance` | 2.67 | 1559 | 979 | 3 | 0 | 1 | 11 | 3 | 10 | 0 | 0 |
| `services` | 2.67 | 1322 | 682 | 4 | 0 | 1 | 14 | 0 | 5 | 0 | 0 |
| `metacognition` | 2.65 | 1554 | 734 | 7 | 1 | 1 | 10 | 1 | 16 | 0 | 0 |
| `commonsense` | 2.61 | 829 | 249 | 3 | 0 | 1 | 15 | 0 | 7 | 0 | 0 |
| `lattice` | 2.58 | 526 | 0 | 4 | 1 | 0 | 2 | 0 | 31 | 0 | 0 |
| `event-timeline` | 2.5 | 645 | 0 | 5 | 0 | 0 | 16 | 3 | 6 | 0 | 0 |
| `message` | 2.5 | 465 | 0 | 8 | 0 | 0 | 16 | 2 | 6 | 0 | 0 |
| `queue` | 2.5 | 638 | 0 | 6 | 0 | 0 | 5 | 0 | 12 | 0 | 1 |
| `auction` | 2.38 | 670 | 270 | 0 | 0 | 1 | 15 | 3 | 4 | 0 | 0 |
| `quantum` | 2.33 | 695 | 0 | 5 | 1 | 0 | 15 | 1 | 7 | 0 | 0 |
| `detective` | 2.25 | 427 | 0 | 3 | 0 | 0 | 14 | 2 | 9 | 0 | 0 |
| `film-studios` | 2.17 | 886 | 306 | 3 | 0 | 1 | 13 | 0 | 7 | 0 | 0 |
| `research` | 2.09 | 978 | 158 | 7 | 1 | 1 | 14 | 0 | 5 | 0 | 0 |
| `debug` | 2.07 | 1525 | 585 | 9 | 1 | 0 | 11 | 1 | 8 | 0 | 0 |
| `translation` | 2.05 | 446 | 46 | 0 | 0 | 0 | 16 | 1 | 0 | 0 | 0 |
| `genesis` | 2 | 481 | 0 | 7 | 0 | 1 | 14 | 2 | 6 | 0 | 0 |
| `move-builder` | 2 | 339 | 0 | 0 | 0 | 0 | 16 | 2 | 0 | 0 | 0 |
| `science` | 1.98 | 2044 | 1404 | 4 | 0 | 1 | 9 | 0 | 2 | 0 | 0 |
| `self` | 1.92 | 567 | 0 | 9 | 1 | 0 | 3 | 0 | 23 | 0 | 0 |
| `entity` | 1.88 | 1323 | 563 | 6 | 1 | 1 | 11 | 0 | 6 | 0 | 0 |
| `dtus` | 1.84 | 825 | 5 | 7 | 0 | 1 | 10 | 2 | 16 | 0 | 0 |
| `repair-telemetry` | 1.84 | 631 | 231 | 0 | 0 | 0 | 13 | 3 | 4 | 0 | 0 |
| `fishing` | 1.83 | 331 | 0 | 5 | 0 | 0 | 14 | 5 | 0 | 0 | 0 |
| `careers` | 1.75 | 357 | 0 | 3 | 0 | 0 | 14 | 2 | 3 | 0 | 0 |
| `ingest` | 1.7 | 911 | 331 | 3 | 0 | 1 | 11 | 0 | 7 | 0 | 0 |
| `integrations` | 1.67 | 546 | 0 | 5 | 1 | 1 | 9 | 0 | 17 | 0 | 0 |
| `civic-bonds` | 1.5 | 367 | 0 | 0 | 0 | 0 | 14 | 3 | 0 | 0 | 0 |
| `mental-health` | 1.5 | 304 | 0 | 4 | 0 | 0 | 12 | 0 | 6 | 0 | 0 |
| `ops` | 1.42 | 335 | 0 | 3 | 1 | 1 | 3 | 0 | 17 | 0 | 0 |
| `deities` | 1.33 | 314 | 0 | 4 | 0 | 0 | 13 | 1 | 1 | 0 | 0 |
| `market` | 1.33 | 601 | 0 | 7 | 0 | 1 | 12 | 0 | 4 | 0 | 0 |
| `codex` | 1.32 | 466 | 66 | 0 | 0 | 0 | 13 | 4 | 0 | 0 | 0 |
| `announcements` | 1.25 | 279 | 0 | 5 | 0 | 0 | 10 | 5 | 5 | 0 | 0 |
| `bounties` | 1.25 | 386 | 0 | 7 | 0 | 0 | 13 | 2 | 0 | 0 | 0 |
| `garage` | 1.25 | 430 | 0 | 2 | 0 | 0 | 10 | 2 | 9 | 0 | 0 |
| `psyops` | 1.25 | 317 | 0 | 8 | 0 | 0 | 13 | 1 | 0 | 0 | 0 |
| `society` | 1.25 | 390 | 0 | 2 | 1 | 1 | 3 | 0 | 15 | 0 | 0 |
| `cri` | 1.22 | 781 | 201 | 3 | 0 | 1 | 9 | 0 | 9 | 0 | 0 |
| `atlas` | 1.17 | 416 | 0 | 9 | 0 | 0 | 4 | 0 | 14 | 0 | 0 |
| `courtship` | 1.17 | 617 | 0 | 4 | 0 | 0 | 12 | 3 | 2 | 0 | 0 |
| `ml` | 1.17 | 171 | 0 | 11 | 0 | 1 | 5 | 0 | 14 | 0 | 0 |
| `platform` | 1.17 | 444 | 0 | 8 | 1 | 0 | 3 | 0 | 14 | 0 | 0 |
| `privacy` | 1.17 | 807 | 227 | 3 | 0 | 1 | 7 | 1 | 11 | 0 | 0 |
| `veterinary` | 1.17 | 219 | 0 | 12 | 1 | 0 | 2 | 1 | 14 | 0 | 0 |
| `tick` | 1.12 | 1150 | 630 | 2 | 1 | 0 | 6 | 4 | 5 | 0 | 0 |
| `invariant` | 1.11 | 693 | 173 | 2 | 1 | 1 | 8 | 1 | 11 | 0 | 0 |
| `finance` | 1.08 | 772 | 0 | 30 | 0 | 1 | 10 | 2 | 7 | 0 | 0 |
| `ghost-tracker` | 1.08 | 343 | 0 | 6 | 0 | 0 | 12 | 2 | 1 | 0 | 0 |
| `ledger` | 1.08 | 474 | 74 | 0 | 0 | 0 | 12 | 1 | 0 | 0 | 0 |
| `lock` | 1.04 | 874 | 114 | 6 | 0 | 1 | 5 | 0 | 11 | 0 | 0 |
| `code-quality` | 1 | 469 | 0 | 8 | 0 | 0 | 12 | 1 | 0 | 0 | 0 |
| `docs` | 1 | 1016 | 376 | 4 | 1 | 1 | 7 | 1 | 7 | 0 | 0 |
| `expert-mode` | 1 | 446 | 0 | 7 | 0 | 0 | 11 | 2 | 3 | 0 | 0 |
| `personas` | 1 | 352 | 0 | 5 | 0 | 0 | 11 | 1 | 3 | 0 | 0 |
| `retail` | 1 | 187 | 0 | 17 | 1 | 1 | 2 | 0 | 12 | 0 | 0 |
| `social` | 1 | 441 | 0 | 21 | 1 | 0 | 3 | 1 | 12 | 0 | 0 |
| `export` | 0.98 | 701 | 61 | 4 | 0 | 1 | 8 | 0 | 11 | 0 | 0 |
| `artistry` | 0.92 | 206 | 0 | 9 | 0 | 0 | 1 | 1 | 11 | 0 | 0 |
| `suffering` | 0.92 | 372 | 0 | 10 | 0 | 0 | 9 | 1 | 8 | 0 | 0 |
| `mentorship` | 0.83 | 233 | 0 | 8 | 0 | 0 | 1 | 1 | 10 | 0 | 0 |
| `sandbox` | 0.83 | 444 | 0 | 6 | 0 | 0 | 10 | 2 | 4 | 0 | 0 |
| `sessions` | 0.83 | 481 | 0 | 3 | 0 | 0 | 11 | 2 | 1 | 0 | 0 |
| `cognitive-replay` | 0.75 | 317 | 0 | 8 | 0 | 0 | 9 | 2 | 6 | 0 | 0 |
| `desert` | 0.75 | 133 | 0 | 11 | 1 | 0 | 1 | 0 | 9 | 0 | 0 |
| `eco` | 0.75 | 232 | 0 | 15 | 1 | 0 | 2 | 0 | 9 | 0 | 0 |
| `insurance` | 0.75 | 211 | 0 | 8 | 0 | 1 | 4 | 0 | 9 | 0 | 0 |
| `manufacturing` | 0.75 | 282 | 0 | 8 | 0 | 1 | 3 | 0 | 9 | 0 | 0 |
| `vault` | 0.75 | 365 | 0 | 5 | 0 | 0 | 10 | 3 | 3 | 0 | 0 |
| `defense` | 0.67 | 166 | 0 | 11 | 1 | 0 | 2 | 0 | 8 | 0 | 0 |
| `meta` | 0.67 | 142 | 0 | 9 | 0 | 0 | 1 | 0 | 8 | 0 | 0 |
| `robotics` | 0.67 | 175 | 0 | 11 | 1 | 0 | 3 | 1 | 8 | 0 | 0 |
| `world-observatory` | 0.66 | 615 | 215 | 0 | 0 | 0 | 9 | 2 | 2 | 0 | 0 |
| `anon` | 0.58 | 450 | 0 | 3 | 0 | 0 | 6 | 0 | 7 | 0 | 0 |
| `gallery` | 0.58 | 291 | 0 | 11 | 0 | 0 | 5 | 1 | 7 | 0 | 0 |
| `lab` | 0.58 | 522 | 0 | 3 | 0 | 1 | 9 | 0 | 4 | 0 | 0 |
| `mining` | 0.58 | 119 | 0 | 8 | 1 | 0 | 1 | 0 | 7 | 0 | 0 |
| `questmarket` | 0.58 | 195 | 0 | 11 | 0 | 0 | 4 | 1 | 7 | 0 | 0 |
| `sponsorship` | 0.58 | 102 | 0 | 6 | 0 | 0 | 3 | 0 | 7 | 0 | 0 |
| `urban-planning` | 0.58 | 312 | 0 | 8 | 1 | 0 | 4 | 1 | 7 | 0 | 0 |
| `concord-link-frontier` | 0.5 | 295 | 0 | 0 | 0 | 0 | 10 | 2 | 0 | 0 | 0 |
| `cooking` | 0.5 | 272 | 0 | 5 | 1 | 0 | 9 | 3 | 3 | 0 | 0 |
| `sentinel` | 0.5 | 139 | 0 | 9 | 1 | 0 | 2 | 0 | 6 | 0 | 0 |
| `space` | 0.5 | 707 | 0 | 7 | 1 | 1 | 5 | 1 | 6 | 0 | 0 |
| `srs` | 0.5 | 350 | 0 | 3 | 0 | 1 | 8 | 0 | 6 | 0 | 0 |
| `achievements` | 0.42 | 419 | 0 | 5 | 0 | 0 | 9 | 3 | 2 | 0 | 0 |
| `alliance` | 0.42 | 185 | 0 | 3 | 0 | 0 | 2 | 1 | 5 | 0 | 0 |
| `animation` | 0.42 | 186 | 0 | 4 | 0 | 0 | 1 | 1 | 5 | 0 | 0 |
| `legal` | 0.42 | 213 | 0 | 9 | 0 | 0 | 1 | 0 | 5 | 0 | 0 |
| `markets` | 0.42 | 273 | 0 | 3 | 0 | 0 | 8 | 1 | 5 | 0 | 0 |
| `math` | 0.42 | 147 | 0 | 4 | 1 | 1 | 1 | 0 | 5 | 0 | 0 |
| `nonprofit` | 0.42 | 134 | 0 | 5 | 0 | 0 | 1 | 0 | 5 | 0 | 0 |
| `pharmacy` | 0.42 | 145 | 0 | 6 | 1 | 1 | 2 | 0 | 5 | 0 | 0 |
| `transfer` | 0.42 | 289 | 0 | 3 | 0 | 1 | 6 | 0 | 5 | 0 | 0 |
| `creative` | 0.33 | 200 | 0 | 8 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `law-enforcement` | 0.33 | 117 | 0 | 5 | 0 | 0 | 1 | 0 | 4 | 0 | 0 |
| `neuro` | 0.33 | 119 | 0 | 7 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `observe` | 0.33 | 165 | 0 | 3 | 0 | 1 | 6 | 0 | 4 | 0 | 0 |
| `quests` | 0.33 | 267 | 0 | 0 | 0 | 0 | 7 | 1 | 4 | 0 | 0 |
| `sync` | 0.33 | 83 | 0 | 3 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `timeline` | 0.33 | 291 | 0 | 9 | 0 | 0 | 3 | 0 | 4 | 0 | 0 |
| `wellness` | 0.33 | 225 | 0 | 8 | 0 | 1 | 5 | 1 | 4 | 0 | 0 |
| `world-creator` | 0.33 | 89 | 0 | 3 | 0 | 0 | 2 | 0 | 4 | 0 | 0 |
| `answers` | 0.3 | 763 | 123 | 4 | 1 | 1 | 6 | 1 | 2 | 0 | 0 |
| `audit` | 0.25 | 376 | 0 | 3 | 0 | 0 | 3 | 0 | 3 | 0 | 0 |
| `black-market` | 0.25 | 359 | 0 | 2 | 0 | 0 | 9 | 1 | 0 | 0 | 0 |
| `classroom` | 0.25 | 255 | 0 | 2 | 0 | 0 | 9 | 1 | 0 | 0 | 0 |
| `feed` | 0.25 | 149 | 0 | 5 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `food` | 0.25 | 183 | 0 | 8 | 1 | 0 | 1 | 0 | 3 | 0 | 0 |
| `forestry` | 0.25 | 129 | 0 | 10 | 1 | 0 | 1 | 0 | 3 | 0 | 0 |
| `fork` | 0.25 | 516 | 0 | 4 | 1 | 0 | 5 | 0 | 3 | 0 | 0 |
| `goddess` | 0.25 | 226 | 0 | 5 | 0 | 0 | 8 | 1 | 3 | 0 | 0 |
| `graph` | 0.25 | 161 | 0 | 6 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `hypothesis` | 0.25 | 107 | 0 | 3 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `lfg` | 0.25 | 277 | 0 | 0 | 0 | 0 | 8 | 1 | 3 | 0 | 0 |
| `parenting` | 0.25 | 123 | 0 | 4 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `travel` | 0.25 | 220 | 0 | 5 | 0 | 0 | 1 | 1 | 3 | 0 | 0 |
| `automotive` | 0.17 | 224 | 0 | 6 | 0 | 0 | 3 | 2 | 2 | 0 | 0 |
| `custom` | 0.17 | 118 | 0 | 3 | 0 | 0 | 2 | 0 | 2 | 0 | 0 |
| `dreams` | 0.17 | 180 | 0 | 3 | 0 | 0 | 5 | 1 | 2 | 0 | 0 |
| `dx-platform` | 0.17 | 298 | 0 | 6 | 0 | 0 | 2 | 1 | 2 | 0 | 0 |
| `ethics` | 0.17 | 86 | 0 | 2 | 1 | 0 | 2 | 0 | 2 | 0 | 0 |
| `events` | 0.17 | 201 | 0 | 5 | 1 | 0 | 1 | 0 | 2 | 0 | 0 |
| `expedition-journal` | 0.17 | 240 | 0 | 3 | 0 | 0 | 8 | 3 | 2 | 0 | 0 |
| `fashion` | 0.17 | 101 | 0 | 2 | 0 | 0 | 3 | 1 | 2 | 0 | 0 |
| `foundry` | 0.17 | 126 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `fractal` | 0.17 | 81 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `game-design` | 0.17 | 96 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `masonry` | 0.17 | 147 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `offline` | 0.17 | 166 | 0 | 7 | 0 | 0 | 3 | 0 | 2 | 0 | 0 |
| `projects` | 0.17 | 64 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `schema` | 0.17 | 84 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `tools` | 0.17 | 118 | 0 | 4 | 1 | 0 | 2 | 0 | 2 | 0 | 0 |
| `welding` | 0.17 | 81 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `affect` | 0.08 | 169 | 0 | 8 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `ar` | 0.08 | 456 | 0 | 3 | 0 | 0 | 7 | 3 | 1 | 0 | 0 |
| `astronomy` | 0.08 | 194 | 0 | 9 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `byo-keys` | 0.08 | 399 | 0 | 10 | 0 | 0 | 8 | 1 | 1 | 0 | 0 |
| `calendar` | 0.08 | 151 | 0 | 7 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| `command-center` | 0.08 | 268 | 0 | 29 | 0 | 0 | 1 | 2 | 1 | 0 | 0 |
| `creator` | 0.08 | 85 | 0 | 5 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `daily` | 0.08 | 108 | 0 | 3 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `death-insurance` | 0.08 | 221 | 0 | 8 | 0 | 0 | 8 | 1 | 1 | 0 | 0 |
| `experience` | 0.08 | 146 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `global` | 0.08 | 444 | 0 | 6 | 1 | 1 | 6 | 1 | 1 | 0 | 0 |
| `grounding` | 0.08 | 134 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `history` | 0.08 | 195 | 0 | 6 | 0 | 0 | 2 | 0 | 1 | 0 | 0 |
| `narrative-walk` | 0.08 | 227 | 0 | 0 | 0 | 0 | 4 | 1 | 1 | 0 | 0 |
| `pets` | 0.08 | 130 | 0 | 1 | 0 | 0 | 3 | 1 | 1 | 0 | 0 |
| `philosophy` | 0.08 | 159 | 0 | 6 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `physics` | 0.08 | 166 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `reasoning` | 0.08 | 162 | 0 | 8 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `repos` | 0.08 | 120 | 0 | 3 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `security` | 0.08 | 173 | 0 | 5 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `sports` | 0.08 | 194 | 0 | 9 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `supplychain` | 0.08 | 152 | 0 | 5 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `voice` | 0.08 | 165 | 0 | 5 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `accounting` | 0 | 165 | 0 | 5 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| `admin` | 0 | 239 | 0 | 7 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| `agriculture` | 0 | 214 | 0 | 12 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| `all` | 0 | 229 | 0 | 5 | 0 | 0 | 5 | 3 | 0 | 0 | 0 |
| `aviation` | 0 | 189 | 0 | 10 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `billing` | 0 | 101 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `bio` | 0 | 358 | 0 | 7 | 1 | 1 | 3 | 0 | 0 | 0 | 0 |
| `carpentry` | 0 | 73 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `collab` | 0 | 14 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `creative-writing` | 0 | 74 | 0 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `crisis-ops` | 0 | 244 | 0 | 9 | 0 | 0 | 6 | 1 | 0 | 0 | 0 |
| `emergency-services` | 0 | 191 | 0 | 5 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `energy` | 0 | 56 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `environment` | 0 | 223 | 0 | 6 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `forecast` | 0 | 267 | 0 | 7 | 0 | 0 | 6 | 1 | 0 | 0 | 0 |
| `forge` | 0 | 154 | 0 | 4 | 0 | 0 | 3 | 1 | 0 | 0 | 0 |
| `frontier` | 0 | 117 | 0 | 12 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `geology` | 0 | 173 | 0 | 13 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `government` | 0 | 339 | 0 | 22 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `household` | 0 | 14 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `hr` | 0 | 102 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `landscaping` | 0 | 106 | 0 | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `law` | 0 | 289 | 0 | 17 | 0 | 0 | 3 | 0 | 0 | 0 | 0 |
| `legacy` | 0 | 89 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `marketing` | 0 | 168 | 0 | 11 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `marketplace` | 0 | 18 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `mesh` | 0 | 262 | 0 | 7 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `news` | 0 | 65 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ocean` | 0 | 188 | 0 | 10 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `ops-telemetry` | 0 | 80 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `paper` | 0 | 162 | 0 | 4 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `photos` | 0 | 245 | 0 | 1 | 0 | 0 | 7 | 1 | 0 | 0 | 0 |
| `plugins` | 0 | 59 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `plumbing` | 0 | 134 | 0 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `productivity` | 0 | 138 | 0 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 0 |
| `realestate` | 0 | 177 | 0 | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `reflection` | 0 | 396 | 0 | 2 | 1 | 1 | 2 | 0 | 0 | 0 | 0 |
| `root` | 0 | 397 | 0 | 7 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| `settings` | 0 | 127 | 0 | 7 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| `sim` | 0 | 14 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `spectate` | 0 | 293 | 0 | 0 | 0 | 0 | 4 | 2 | 0 | 0 | 0 |
| `staking` | 0 | 225 | 0 | 8 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| `strategic-adds` | 0 | 166 | 0 | 11 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `telecommunications` | 0 | 156 | 0 | 3 | 0 | 0 | 3 | 1 | 0 | 0 | 0 |
| `temporal` | 0 | 71 | 0 | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `training-room` | 0 | 285 | 0 | 0 | 1 | 1 | 7 | 2 | 0 | 0 | 0 |
| `ux-suite` | 0 | 178 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `vote` | 0 | 178 | 0 | 3 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| `wallet` | 0 | 153 | 0 | 8 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `whiteboard` | 0 | 45 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |

## Heavy — rebuild candidates (score ≥ 12)

### `world` — 27.99
- 7625 LOC (4945 inline-bloat) · 38 feature component imports · 191 files in `components/world/`
- **3 view-state machine(s)** · 3/3 render strategies coexisting · 90 useState · 43 useEffect · 67 top-level screen branches
- **3 dead view value(s)** (declared in a literal-only union, never navigated to): `combatContext:hacker`, `combatContext:underwater`, `combatContext:mixed`

### `chat` — 17.07
- 4951 LOC (1791 inline-bloat) · 46 feature component imports · 39 files in `components/chat/`
- **2 view-state machine(s)** · 3/3 render strategies coexisting · 66 useState · 16 useEffect · 31 top-level screen branches

### `healthcare` — 16.37
- 4015 LOC (2955 inline-bloat) · 11 feature component imports · 31 files in `components/healthcare/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 71 useState · 0 useEffect · 13 top-level screen branches

### `trades` — 15
- 2607 LOC (1127 inline-bloat) · 18 feature component imports · 19 files in `components/trades/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 58 useState · 0 useEffect · 21 top-level screen branches

### `studio` — 14.88
- 2991 LOC (1391 inline-bloat) · 20 feature component imports · 41 files in `components/studio/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 50 useState · 6 useEffect · 20 top-level screen branches
- **1 macro(s) called from 2+ sites** — candidate duplicate flows for the same action

### `education` — 14.64
- 4789 LOC (2829 inline-bloat) · 26 feature component imports · 25 files in `components/education/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 61 useState · 1 useEffect · 24 top-level screen branches

### `fitness` — 14
- 2138 LOC (1198 inline-bloat) · 9 feature component imports · 20 files in `components/fitness/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 53 useState · 0 useEffect · 8 top-level screen branches

### `crypto` — 12.98
- 1704 LOC (584 inline-bloat) · 12 feature component imports · 19 files in `components/crypto/`
- **2 view-state machine(s)** · 3/3 render strategies coexisting · 30 useState · 2 useEffect · 34 top-level screen branches

### `council` — 12.83
- 3279 LOC (2399 inline-bloat) · 8 feature component imports · 7 files in `components/council/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 23 useState · 0 useEffect · 11 top-level screen branches

### `game` — 12.65
- 1583 LOC (883 inline-bloat) · 5 feature component imports · 6 files in `components/game/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 20 useState · 2 useEffect · 8 top-level screen branches

### `music` — 12.18
- 2455 LOC (1515 inline-bloat) · 9 feature component imports · 18 files in `components/music/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 25 useState · 1 useEffect · 12 top-level screen branches

### `code` — 12.09
- 2684 LOC (1204 inline-bloat) · 18 feature component imports · 30 files in `components/code/`
- **0 view-state machine(s)** · 2/3 render strategies coexisting · 47 useState · 7 useEffect · 33 top-level screen branches

## Moderate — next consolidations (score 7–12)

- `board` — score 8.7, 2050 LOC, 1 view-SM, 1530 inline-bloat
- `poetry` — score 8.67, 570 LOC, 0 view-SM, 0 inline-bloat
- `crafting` — score 7.66, 1401 LOC, 1 view-SM, 821 inline-bloat
- `worldmodel` — score 7.3, 1212 LOC, 1 view-SM, 572 inline-bloat
- `agents` — score 7, 1433 LOC, 1 view-SM, 673 inline-bloat

## Honest gaps (leave listed)

- Detector is static AST/heuristics — a thin page that re-implements a second app inside one panel file will look clean while still being welded.
- `world` is a game client, not one app; do not treat its score as a routine consolidation ticket (see `docs/LENS_CONSOLIDATION_PLAYBOOK.md` §3).
- Macro-preservation (`lensRun` / `useLensData` parity) is **not** automated here — Step 5 of the playbook still requires a grepped contract check per lens.
- Chrome de-dup (RecentMineCard / AutoActionStrip stacked under LensFeedButton) can leave odd JSX whitespace; formatting cleanup is separate from score.
- Heavy lenses (`chat`, `healthcare`, `trades`, `studio`, `education`, `fitness`, `crypto`, `council`, `game`, `music`, `code`) still need full extract-to-panels passes — chrome strips alone do not drop them below 12.
- Baseline ratchet (`audit/lens-stacking-baseline.json`) is recommended but not wired into CI yet.
