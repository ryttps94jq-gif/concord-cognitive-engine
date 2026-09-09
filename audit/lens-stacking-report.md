# Lens stacked-UI report

Generated 2026-09-08T22:19:52.638Z · `node scripts/detect-lens-stacking.mjs`

266 lenses scanned. **13 heavy** (score ≥ 12) · **21 moderate** (7–12) · 232 clean.

`stackingScore` weights the **welded-piles** signature, NOT raw size: `inlineBloat` (LOC not explained by delegated panels), **independent view-state machines beyond the first** (one tab machine is fine — 2+ separate ones gating different regions is welded apps), heterogeneous render strategies in one file (tab-union + `&&`-screens + boolean modal toggles all coexisting = piled by different sessions), hook sprawl (`useState`/`useEffect` over the norm), top-level screen branches, literal-only dead view values, and duplicate action paths. A thin page that delegates 17 tabs to 17 panel components (e.g. `retail`, 191 LOC) is the GOOD pattern and scores low. Read the columns, not just the score.

| lens | score | LOC | inlineBloat | feat-cmp | view-SM | render-strat | useState | useEffect | screen-br | dead-view | dup-act |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| `world` | 27.99 | 7625 | 4945 | 38 | 3 | 3 | 90 | 43 | 67 | 3 | 0 |
| `chat` | 17.07 | 4951 | 1791 | 46 | 2 | 3 | 66 | 16 | 31 | 0 | 0 |
| `healthcare` | 16.37 | 4015 | 2955 | 11 | 3 | 2 | 71 | 0 | 13 | 0 | 0 |
| `trades` | 15.01 | 2611 | 1131 | 18 | 3 | 2 | 58 | 0 | 21 | 0 | 0 |
| `studio` | 14.89 | 2997 | 1397 | 20 | 2 | 2 | 50 | 6 | 20 | 0 | 1 |
| `education` | 14.64 | 4789 | 2829 | 26 | 2 | 2 | 61 | 1 | 24 | 0 | 0 |
| `fitness` | 14 | 2142 | 1202 | 9 | 3 | 2 | 53 | 0 | 8 | 0 | 0 |
| `crypto` | 12.99 | 1712 | 592 | 12 | 2 | 3 | 30 | 2 | 34 | 0 | 0 |
| `council` | 12.84 | 3284 | 2404 | 8 | 2 | 2 | 23 | 0 | 11 | 0 | 0 |
| `game` | 12.65 | 1588 | 888 | 5 | 3 | 2 | 20 | 2 | 8 | 0 | 0 |
| `music` | 12.19 | 2460 | 1520 | 9 | 2 | 2 | 25 | 1 | 12 | 0 | 0 |
| `code` | 12.1 | 2692 | 1212 | 18 | 0 | 2 | 47 | 7 | 33 | 0 | 0 |
| `agriculture` | 12 | 2202 | 902 | 15 | 2 | 2 | 51 | 0 | 18 | 0 | 0 |
| `creator` | 11.82 | 1439 | 739 | 5 | 2 | 2 | 43 | 6 | 10 | 0 | 0 |
| `marketplace` | 11.13 | 3161 | 1921 | 14 | 0 | 2 | 34 | 5 | 20 | 0 | 0 |
| `admin` | 10.31 | 2715 | 1775 | 9 | 0 | 2 | 28 | 0 | 16 | 0 | 0 |
| `poetry` | 9.61 | 845 | 25 | 7 | 0 | 2 | 19 | 1 | 10 | 0 | 2 |
| `wallet` | 9.35 | 1679 | 619 | 11 | 2 | 3 | 12 | 1 | 26 | 0 | 0 |
| `aviation` | 9.29 | 2358 | 1238 | 12 | 2 | 2 | 10 | 0 | 23 | 0 | 0 |
| `kingdoms` | 9.17 | 574 | 0 | 6 | 2 | 2 | 20 | 1 | 8 | 0 | 0 |
| `math` | 9.15 | 1198 | 438 | 6 | 1 | 2 | 25 | 0 | 20 | 0 | 0 |
| `board` | 9.14 | 2069 | 1549 | 2 | 1 | 2 | 22 | 2 | 11 | 0 | 0 |
| `whiteboard` | 9.02 | 1767 | 1067 | 5 | 1 | 2 | 49 | 5 | 6 | 0 | 0 |
| `paper` | 8.7 | 2354 | 1534 | 7 | 1 | 1 | 40 | 3 | 36 | 0 | 0 |
| `thread` | 8.46 | 1127 | 487 | 4 | 0 | 2 | 22 | 4 | 17 | 0 | 0 |
| `goals` | 8.08 | 1089 | 449 | 4 | 1 | 2 | 22 | 0 | 13 | 0 | 0 |
| `government` | 8.06 | 3645 | 1925 | 22 | 1 | 2 | 13 | 0 | 20 | 0 | 0 |
| `crafting` | 7.77 | 1423 | 843 | 3 | 1 | 1 | 46 | 6 | 26 | 0 | 0 |
| `agents` | 7.59 | 1445 | 685 | 6 | 1 | 2 | 19 | 1 | 13 | 0 | 0 |
| `environment` | 7.5 | 3674 | 1954 | 22 | 1 | 2 | 12 | 0 | 16 | 0 | 0 |
| `reasoning` | 7.47 | 2791 | 2151 | 4 | 0 | 1 | 48 | 1 | 13 | 0 | 0 |
| `worldmodel` | 7.4 | 1227 | 587 | 4 | 1 | 1 | 46 | 0 | 33 | 0 | 0 |
| `graph` | 7.23 | 2043 | 1103 | 9 | 0 | 1 | 46 | 5 | 20 | 0 | 0 |
| `calendar` | 7 | 2469 | 1649 | 7 | 0 | 1 | 25 | 2 | 14 | 0 | 0 |
| `attention` | 6.93 | 1024 | 84 | 9 | 2 | 1 | 11 | 2 | 7 | 0 | 2 |
| `home-improvement` | 6.87 | 971 | 31 | 9 | 1 | 2 | 20 | 1 | 10 | 0 | 0 |
| `import` | 6.87 | 1194 | 554 | 4 | 1 | 2 | 17 | 0 | 12 | 0 | 0 |
| `realestate` | 6.83 | 3566 | 1726 | 24 | 1 | 1 | 68 | 0 | 11 | 0 | 0 |
| `billing` | 6.76 | 1112 | 532 | 3 | 2 | 2 | 6 | 0 | 8 | 0 | 0 |
| `understanding` | 6.67 | 1017 | 377 | 4 | 0 | 0 | 33 | 3 | 27 | 0 | 0 |
| `inference` | 6.56 | 803 | 283 | 2 | 1 | 2 | 18 | 1 | 9 | 0 | 0 |
| `affect` | 6.48 | 2299 | 1779 | 2 | 1 | 1 | 14 | 1 | 39 | 0 | 0 |
| `household` | 6.44 | 1979 | 919 | 11 | 1 | 2 | 16 | 0 | 5 | 0 | 0 |
| `app-maker` | 6.31 | 713 | 133 | 3 | 1 | 2 | 16 | 1 | 14 | 0 | 0 |
| `collab` | 6.28 | 2095 | 1455 | 4 | 1 | 1 | 21 | 6 | 9 | 0 | 0 |
| `sim` | 6.17 | 2488 | 1728 | 6 | 1 | 1 | 13 | 0 | 36 | 0 | 0 |
| `podcast` | 6.07 | 987 | 287 | 5 | 1 | 1 | 26 | 2 | 21 | 0 | 0 |
| `research` | 6.04 | 1002 | 182 | 7 | 1 | 2 | 16 | 0 | 10 | 0 | 0 |
| `food` | 5.97 | 2910 | 1550 | 16 | 1 | 1 | 63 | 0 | 3 | 0 | 0 |
| `events` | 5.95 | 3132 | 2432 | 5 | 0 | 1 | 18 | 1 | 9 | 0 | 0 |
| `metalearning` | 5.92 | 825 | 0 | 8 | 1 | 2 | 16 | 1 | 11 | 0 | 0 |
| `forum` | 5.8 | 1283 | 643 | 4 | 0 | 1 | 27 | 2 | 13 | 0 | 0 |
| `meta` | 5.72 | 1316 | 796 | 2 | 2 | 1 | 10 | 0 | 22 | 0 | 0 |
| `daily` | 5.53 | 1131 | 551 | 3 | 0 | 1 | 27 | 4 | 11 | 0 | 0 |
| `voice` | 5.4 | 1269 | 509 | 6 | 0 | 1 | 22 | 4 | 16 | 0 | 0 |
| `ops-telemetry` | 5.31 | 1470 | 950 | 2 | 0 | 0 | 36 | 0 | 3 | 0 | 0 |
| `art` | 5.1 | 1256 | 316 | 9 | 0 | 1 | 30 | 2 | 9 | 0 | 0 |
| `federation` | 5.08 | 802 | 0 | 10 | 1 | 1 | 21 | 1 | 22 | 0 | 0 |
| `linguistics` | 5.08 | 886 | 0 | 10 | 1 | 1 | 26 | 0 | 13 | 0 | 0 |
| `entity` | 5.05 | 1327 | 567 | 6 | 1 | 2 | 11 | 0 | 8 | 0 | 0 |
| `construction` | 4.94 | 888 | 248 | 4 | 1 | 1 | 26 | 0 | 8 | 0 | 0 |
| `electrical` | 4.83 | 847 | 0 | 9 | 1 | 1 | 27 | 0 | 10 | 0 | 0 |
| `feed` | 4.77 | 2477 | 997 | 18 | 1 | 1 | 18 | 1 | 14 | 0 | 0 |
| `cognition` | 4.75 | 480 | 0 | 7 | 2 | 1 | 6 | 0 | 9 | 0 | 1 |
| `diy` | 4.73 | 880 | 360 | 2 | 1 | 1 | 29 | 0 | 4 | 0 | 0 |
| `logistics` | 4.67 | 535 | 0 | 16 | 1 | 2 | 7 | 1 | 20 | 0 | 0 |
| `meditation` | 4.67 | 712 | 0 | 6 | 1 | 1 | 22 | 4 | 14 | 0 | 0 |
| `inheritance` | 4.6 | 907 | 387 | 2 | 0 | 0 | 43 | 3 | 2 | 0 | 0 |
| `hvac` | 4.58 | 789 | 149 | 4 | 1 | 1 | 24 | 0 | 5 | 0 | 0 |
| `photography` | 4.56 | 923 | 283 | 4 | 0 | 1 | 21 | 5 | 8 | 0 | 0 |
| `command-center` | 4.52 | 2125 | 1365 | 6 | 2 | 1 | 7 | 1 | 6 | 0 | 0 |
| `literary` | 4.44 | 710 | 250 | 1 | 1 | 1 | 26 | 4 | 2 | 0 | 0 |
| `debate` | 4.34 | 1080 | 380 | 5 | 0 | 1 | 20 | 4 | 11 | 0 | 0 |
| `disputes` | 4.04 | 1066 | 486 | 3 | 1 | 1 | 17 | 0 | 15 | 0 | 0 |
| `materials` | 4 | 393 | 0 | 6 | 1 | 0 | 37 | 0 | 0 | 0 | 0 |
| `engineering` | 3.98 | 1219 | 279 | 9 | 0 | 1 | 17 | 1 | 17 | 0 | 0 |
| `database` | 3.88 | 1296 | 716 | 3 | 1 | 1 | 12 | 1 | 25 | 0 | 0 |
| `consulting` | 3.8 | 776 | 196 | 3 | 1 | 1 | 20 | 0 | 7 | 0 | 0 |
| `physics` | 3.8 | 1686 | 866 | 7 | 0 | 1 | 17 | 3 | 7 | 0 | 0 |
| `analytics` | 3.75 | 744 | 0 | 6 | 1 | 2 | 5 | 0 | 9 | 0 | 0 |
| `fork` | 3.75 | 524 | 0 | 4 | 1 | 2 | 7 | 0 | 9 | 0 | 0 |
| `sub-worlds` | 3.67 | 445 | 0 | 6 | 0 | 1 | 15 | 2 | 5 | 0 | 1 |
| `creatures` | 3.49 | 522 | 62 | 1 | 0 | 0 | 20 | 3 | 5 | 0 | 0 |
| `bridge` | 3.46 | 768 | 188 | 3 | 0 | 0 | 11 | 1 | 30 | 0 | 0 |
| `bio` | 3.33 | 383 | 0 | 7 | 1 | 2 | 5 | 0 | 4 | 0 | 0 |
| `chem` | 3.33 | 440 | 0 | 7 | 1 | 2 | 6 | 0 | 4 | 0 | 0 |
| `tournaments` | 3.33 | 565 | 0 | 6 | 1 | 1 | 19 | 2 | 7 | 0 | 0 |
| `housing` | 3.19 | 570 | 170 | 0 | 0 | 0 | 20 | 4 | 0 | 0 | 0 |
| `maker` | 3.17 | 353 | 0 | 3 | 2 | 1 | 5 | 0 | 8 | 0 | 0 |
| `mail` | 3.08 | 588 | 68 | 2 | 0 | 0 | 17 | 4 | 9 | 0 | 0 |
| `system` | 3.08 | 955 | 0 | 10 | 2 | 1 | 4 | 0 | 7 | 0 | 0 |
| `saved` | 3 | 468 | 0 | 5 | 0 | 0 | 20 | 2 | 0 | 0 | 0 |
| `science` | 2.84 | 2069 | 1429 | 4 | 0 | 1 | 11 | 0 | 6 | 0 | 0 |
| `organ` | 2.68 | 904 | 384 | 2 | 0 | 1 | 13 | 0 | 12 | 0 | 0 |
| `resonance` | 2.68 | 1567 | 987 | 3 | 0 | 1 | 11 | 3 | 10 | 0 | 0 |
| `services` | 2.68 | 1330 | 690 | 4 | 0 | 1 | 14 | 0 | 5 | 0 | 0 |
| `metacognition` | 2.66 | 1562 | 742 | 7 | 1 | 1 | 10 | 1 | 16 | 0 | 0 |
| `commonsense` | 2.62 | 837 | 257 | 3 | 0 | 1 | 15 | 0 | 7 | 0 | 0 |
| `lattice` | 2.58 | 532 | 0 | 4 | 1 | 0 | 2 | 0 | 31 | 0 | 0 |
| `security` | 2.58 | 1458 | 818 | 4 | 0 | 1 | 12 | 0 | 8 | 0 | 0 |
| `debug` | 2.5 | 1538 | 598 | 9 | 1 | 0 | 12 | 1 | 10 | 0 | 0 |
| `event-timeline` | 2.5 | 651 | 0 | 5 | 0 | 0 | 16 | 3 | 6 | 0 | 0 |
| `message` | 2.5 | 472 | 0 | 8 | 0 | 0 | 16 | 2 | 6 | 0 | 0 |
| `quantum` | 2.5 | 664 | 0 | 5 | 0 | 0 | 15 | 1 | 9 | 0 | 0 |
| `queue` | 2.5 | 646 | 0 | 6 | 0 | 0 | 5 | 0 | 12 | 0 | 1 |
| `sports` | 2.46 | 1148 | 268 | 8 | 0 | 1 | 13 | 0 | 11 | 0 | 0 |
| `auction` | 2.39 | 673 | 273 | 0 | 0 | 1 | 15 | 3 | 4 | 0 | 0 |
| `detective` | 2.25 | 427 | 0 | 3 | 0 | 0 | 14 | 2 | 9 | 0 | 0 |
| `film-studios` | 2.18 | 894 | 314 | 3 | 0 | 1 | 13 | 0 | 7 | 0 | 0 |
| `translation` | 2.05 | 446 | 46 | 0 | 0 | 0 | 16 | 1 | 0 | 0 | 0 |
| `genesis` | 2 | 490 | 0 | 7 | 0 | 1 | 14 | 2 | 6 | 0 | 0 |
| `move-builder` | 2 | 339 | 0 | 0 | 0 | 0 | 16 | 2 | 0 | 0 | 0 |
| `self` | 1.92 | 576 | 0 | 9 | 1 | 0 | 3 | 0 | 23 | 0 | 0 |
| `dtus` | 1.85 | 834 | 14 | 7 | 0 | 1 | 10 | 2 | 16 | 0 | 0 |
| `repair-telemetry` | 1.84 | 631 | 231 | 0 | 0 | 0 | 13 | 3 | 4 | 0 | 0 |
| `fishing` | 1.83 | 331 | 0 | 5 | 0 | 0 | 14 | 5 | 0 | 0 | 0 |
| `careers` | 1.75 | 357 | 0 | 3 | 0 | 0 | 14 | 2 | 3 | 0 | 0 |
| `ingest` | 1.71 | 919 | 339 | 3 | 0 | 1 | 11 | 0 | 7 | 0 | 0 |
| `integrations` | 1.67 | 552 | 0 | 5 | 1 | 1 | 9 | 0 | 17 | 0 | 0 |
| `civic-bonds` | 1.5 | 367 | 0 | 0 | 0 | 0 | 14 | 3 | 0 | 0 | 0 |
| `mental-health` | 1.5 | 312 | 0 | 4 | 0 | 0 | 12 | 0 | 6 | 0 | 0 |
| `tick` | 1.49 | 1183 | 663 | 2 | 1 | 1 | 8 | 4 | 9 | 0 | 0 |
| `ops` | 1.42 | 344 | 0 | 3 | 1 | 1 | 3 | 0 | 17 | 0 | 0 |
| `deities` | 1.33 | 320 | 0 | 4 | 0 | 0 | 13 | 1 | 1 | 0 | 0 |
| `market` | 1.33 | 606 | 0 | 7 | 0 | 1 | 12 | 0 | 4 | 0 | 0 |
| `codex` | 1.32 | 466 | 66 | 0 | 0 | 0 | 13 | 4 | 0 | 0 | 0 |
| `announcements` | 1.25 | 279 | 0 | 5 | 0 | 0 | 10 | 5 | 5 | 0 | 0 |
| `bounties` | 1.25 | 392 | 0 | 7 | 0 | 0 | 13 | 2 | 0 | 0 | 0 |
| `garage` | 1.25 | 430 | 0 | 2 | 0 | 0 | 10 | 2 | 9 | 0 | 0 |
| `psyops` | 1.25 | 323 | 0 | 8 | 0 | 0 | 13 | 1 | 0 | 0 | 0 |
| `society` | 1.25 | 399 | 0 | 2 | 1 | 1 | 3 | 0 | 15 | 0 | 0 |
| `cri` | 1.23 | 789 | 209 | 3 | 0 | 1 | 9 | 0 | 9 | 0 | 0 |
| `privacy` | 1.18 | 816 | 236 | 3 | 0 | 1 | 7 | 1 | 11 | 0 | 0 |
| `atlas` | 1.17 | 416 | 0 | 9 | 0 | 0 | 4 | 0 | 14 | 0 | 0 |
| `courtship` | 1.17 | 617 | 0 | 4 | 0 | 0 | 12 | 3 | 2 | 0 | 0 |
| `ml` | 1.17 | 180 | 0 | 11 | 0 | 1 | 5 | 0 | 14 | 0 | 0 |
| `platform` | 1.17 | 452 | 0 | 8 | 1 | 0 | 3 | 0 | 14 | 0 | 0 |
| `veterinary` | 1.17 | 219 | 0 | 12 | 1 | 0 | 2 | 1 | 14 | 0 | 0 |
| `invariant` | 1.12 | 701 | 181 | 2 | 1 | 1 | 8 | 1 | 11 | 0 | 0 |
| `finance` | 1.08 | 772 | 0 | 30 | 0 | 1 | 10 | 2 | 7 | 0 | 0 |
| `ghost-tracker` | 1.08 | 352 | 0 | 6 | 0 | 0 | 12 | 2 | 1 | 0 | 0 |
| `ledger` | 1.08 | 474 | 74 | 0 | 0 | 0 | 12 | 1 | 0 | 0 | 0 |
| `lock` | 1.05 | 882 | 122 | 6 | 0 | 1 | 5 | 0 | 11 | 0 | 0 |
| `docs` | 1.01 | 1024 | 384 | 4 | 1 | 1 | 7 | 1 | 7 | 0 | 0 |
| `code-quality` | 1 | 477 | 0 | 8 | 0 | 0 | 12 | 1 | 0 | 0 | 0 |
| `expert-mode` | 1 | 451 | 0 | 7 | 0 | 0 | 11 | 2 | 3 | 0 | 0 |
| `personas` | 1 | 358 | 0 | 5 | 0 | 0 | 11 | 1 | 3 | 0 | 0 |
| `retail` | 1 | 191 | 0 | 17 | 1 | 1 | 2 | 0 | 12 | 0 | 0 |
| `social` | 1 | 441 | 0 | 21 | 1 | 0 | 3 | 1 | 12 | 0 | 0 |
| `export` | 0.99 | 709 | 69 | 4 | 0 | 1 | 8 | 0 | 11 | 0 | 0 |
| `artistry` | 0.92 | 206 | 0 | 9 | 0 | 0 | 1 | 1 | 11 | 0 | 0 |
| `suffering` | 0.92 | 372 | 0 | 10 | 0 | 0 | 9 | 1 | 8 | 0 | 0 |
| `mentorship` | 0.83 | 233 | 0 | 8 | 0 | 0 | 1 | 1 | 10 | 0 | 0 |
| `sandbox` | 0.83 | 452 | 0 | 6 | 0 | 0 | 10 | 2 | 4 | 0 | 0 |
| `sessions` | 0.83 | 484 | 0 | 3 | 0 | 0 | 11 | 2 | 1 | 0 | 0 |
| `cognitive-replay` | 0.75 | 325 | 0 | 8 | 0 | 0 | 9 | 2 | 6 | 0 | 0 |
| `desert` | 0.75 | 133 | 0 | 11 | 1 | 0 | 1 | 0 | 9 | 0 | 0 |
| `eco` | 0.75 | 237 | 0 | 15 | 1 | 0 | 2 | 0 | 9 | 0 | 0 |
| `insurance` | 0.75 | 211 | 0 | 8 | 0 | 1 | 4 | 0 | 9 | 0 | 0 |
| `manufacturing` | 0.75 | 287 | 0 | 8 | 0 | 1 | 3 | 0 | 9 | 0 | 0 |
| `vault` | 0.75 | 365 | 0 | 5 | 0 | 0 | 10 | 3 | 3 | 0 | 0 |
| `cooking` | 0.67 | 266 | 0 | 5 | 0 | 1 | 10 | 3 | 2 | 0 | 0 |
| `defense` | 0.67 | 174 | 0 | 11 | 1 | 0 | 2 | 0 | 8 | 0 | 0 |
| `robotics` | 0.67 | 183 | 0 | 11 | 1 | 0 | 3 | 1 | 8 | 0 | 0 |
| `world-observatory` | 0.66 | 618 | 218 | 0 | 0 | 0 | 9 | 2 | 2 | 0 | 0 |
| `anon` | 0.58 | 458 | 0 | 3 | 0 | 0 | 6 | 0 | 7 | 0 | 0 |
| `gallery` | 0.58 | 296 | 0 | 11 | 0 | 0 | 5 | 1 | 7 | 0 | 0 |
| `lab` | 0.58 | 530 | 0 | 3 | 0 | 1 | 9 | 0 | 4 | 0 | 0 |
| `mining` | 0.58 | 119 | 0 | 8 | 1 | 0 | 1 | 0 | 7 | 0 | 0 |
| `questmarket` | 0.58 | 195 | 0 | 11 | 0 | 0 | 4 | 1 | 7 | 0 | 0 |
| `sponsorship` | 0.58 | 108 | 0 | 6 | 0 | 0 | 3 | 0 | 7 | 0 | 0 |
| `urban-planning` | 0.58 | 320 | 0 | 8 | 1 | 0 | 4 | 1 | 7 | 0 | 0 |
| `concord-link-frontier` | 0.5 | 298 | 0 | 0 | 0 | 0 | 10 | 2 | 0 | 0 | 0 |
| `sentinel` | 0.5 | 147 | 0 | 9 | 1 | 0 | 2 | 0 | 6 | 0 | 0 |
| `space` | 0.5 | 707 | 0 | 7 | 1 | 1 | 5 | 1 | 6 | 0 | 0 |
| `srs` | 0.5 | 359 | 0 | 3 | 0 | 1 | 8 | 0 | 6 | 0 | 0 |
| `achievements` | 0.42 | 419 | 0 | 5 | 0 | 0 | 9 | 3 | 2 | 0 | 0 |
| `alliance` | 0.42 | 185 | 0 | 3 | 0 | 0 | 2 | 1 | 5 | 0 | 0 |
| `animation` | 0.42 | 186 | 0 | 4 | 0 | 0 | 1 | 1 | 5 | 0 | 0 |
| `legal` | 0.42 | 213 | 0 | 9 | 0 | 0 | 1 | 0 | 5 | 0 | 0 |
| `markets` | 0.42 | 276 | 0 | 3 | 0 | 0 | 8 | 1 | 5 | 0 | 0 |
| `nonprofit` | 0.42 | 142 | 0 | 5 | 0 | 0 | 1 | 0 | 5 | 0 | 0 |
| `pharmacy` | 0.42 | 145 | 0 | 6 | 1 | 1 | 2 | 0 | 5 | 0 | 0 |
| `transfer` | 0.42 | 297 | 0 | 3 | 0 | 1 | 6 | 0 | 5 | 0 | 0 |
| `creative` | 0.33 | 206 | 0 | 8 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `law-enforcement` | 0.33 | 125 | 0 | 5 | 0 | 0 | 1 | 0 | 4 | 0 | 0 |
| `neuro` | 0.33 | 127 | 0 | 7 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `observe` | 0.33 | 171 | 0 | 3 | 0 | 1 | 6 | 0 | 4 | 0 | 0 |
| `quests` | 0.33 | 270 | 0 | 0 | 0 | 0 | 7 | 1 | 4 | 0 | 0 |
| `sync` | 0.33 | 89 | 0 | 3 | 0 | 1 | 2 | 0 | 4 | 0 | 0 |
| `timeline` | 0.33 | 300 | 0 | 9 | 0 | 0 | 3 | 0 | 4 | 0 | 0 |
| `wellness` | 0.33 | 231 | 0 | 8 | 0 | 1 | 5 | 1 | 4 | 0 | 0 |
| `world-creator` | 0.33 | 95 | 0 | 3 | 0 | 0 | 2 | 0 | 4 | 0 | 0 |
| `answers` | 0.31 | 772 | 132 | 4 | 1 | 1 | 6 | 1 | 2 | 0 | 0 |
| `audit` | 0.25 | 384 | 0 | 3 | 0 | 0 | 3 | 0 | 3 | 0 | 0 |
| `black-market` | 0.25 | 362 | 0 | 2 | 0 | 0 | 9 | 1 | 0 | 0 | 0 |
| `classroom` | 0.25 | 261 | 0 | 2 | 0 | 0 | 9 | 1 | 0 | 0 | 0 |
| `death-insurance` | 0.25 | 228 | 0 | 8 | 0 | 0 | 8 | 1 | 3 | 0 | 0 |
| `forestry` | 0.25 | 137 | 0 | 10 | 1 | 0 | 1 | 0 | 3 | 0 | 0 |
| `goddess` | 0.25 | 232 | 0 | 5 | 0 | 0 | 8 | 1 | 3 | 0 | 0 |
| `hypothesis` | 0.25 | 115 | 0 | 3 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `lfg` | 0.25 | 280 | 0 | 0 | 0 | 0 | 8 | 1 | 3 | 0 | 0 |
| `parenting` | 0.25 | 123 | 0 | 4 | 0 | 0 | 1 | 0 | 3 | 0 | 0 |
| `travel` | 0.25 | 220 | 0 | 5 | 0 | 0 | 1 | 1 | 3 | 0 | 0 |
| `accounting` | 0.17 | 187 | 0 | 6 | 0 | 0 | 3 | 0 | 2 | 0 | 0 |
| `automotive` | 0.17 | 232 | 0 | 6 | 0 | 0 | 3 | 2 | 2 | 0 | 0 |
| `creative-writing` | 0.17 | 80 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `custom` | 0.17 | 126 | 0 | 3 | 0 | 0 | 2 | 0 | 2 | 0 | 0 |
| `dreams` | 0.17 | 185 | 0 | 3 | 0 | 0 | 5 | 1 | 2 | 0 | 0 |
| `dx-platform` | 0.17 | 303 | 0 | 6 | 0 | 0 | 2 | 1 | 2 | 0 | 0 |
| `ethics` | 0.17 | 94 | 0 | 2 | 1 | 0 | 2 | 0 | 2 | 0 | 0 |
| `expedition-journal` | 0.17 | 248 | 0 | 3 | 0 | 0 | 8 | 3 | 2 | 0 | 0 |
| `fashion` | 0.17 | 101 | 0 | 2 | 0 | 0 | 3 | 1 | 2 | 0 | 0 |
| `foundry` | 0.17 | 131 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `fractal` | 0.17 | 89 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `game-design` | 0.17 | 101 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `masonry` | 0.17 | 155 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `offline` | 0.17 | 174 | 0 | 7 | 0 | 0 | 3 | 0 | 2 | 0 | 0 |
| `projects` | 0.17 | 72 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `schema` | 0.17 | 92 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `temporal` | 0.17 | 80 | 0 | 2 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `tools` | 0.17 | 127 | 0 | 4 | 1 | 0 | 2 | 0 | 2 | 0 | 0 |
| `welding` | 0.17 | 89 | 0 | 3 | 0 | 0 | 1 | 0 | 2 | 0 | 0 |
| `ar` | 0.08 | 456 | 0 | 3 | 0 | 0 | 7 | 3 | 1 | 0 | 0 |
| `astronomy` | 0.08 | 194 | 0 | 9 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `byo-keys` | 0.08 | 406 | 0 | 10 | 0 | 0 | 8 | 1 | 1 | 0 | 0 |
| `experience` | 0.08 | 151 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `global` | 0.08 | 452 | 0 | 6 | 1 | 1 | 6 | 1 | 1 | 0 | 0 |
| `grounding` | 0.08 | 134 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `history` | 0.08 | 195 | 0 | 6 | 0 | 0 | 2 | 0 | 1 | 0 | 0 |
| `narrative-walk` | 0.08 | 230 | 0 | 0 | 0 | 0 | 4 | 1 | 1 | 0 | 0 |
| `pets` | 0.08 | 130 | 0 | 1 | 0 | 0 | 3 | 1 | 1 | 0 | 0 |
| `philosophy` | 0.08 | 159 | 0 | 6 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `repos` | 0.08 | 128 | 0 | 3 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `supplychain` | 0.08 | 152 | 0 | 5 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| `all` | 0 | 237 | 0 | 5 | 0 | 0 | 5 | 3 | 0 | 0 | 0 |
| `carpentry` | 0 | 79 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `crisis-ops` | 0 | 253 | 0 | 9 | 0 | 0 | 6 | 1 | 0 | 0 | 0 |
| `emergency-services` | 0 | 197 | 0 | 5 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `energy` | 0 | 56 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `forecast` | 0 | 273 | 0 | 7 | 0 | 0 | 6 | 1 | 0 | 0 | 0 |
| `forge` | 0 | 162 | 0 | 4 | 0 | 0 | 3 | 1 | 0 | 0 | 0 |
| `frontier` | 0 | 117 | 0 | 12 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `geology` | 0 | 182 | 0 | 13 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `hr` | 0 | 108 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `landscaping` | 0 | 113 | 0 | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `law` | 0 | 289 | 0 | 17 | 0 | 0 | 3 | 0 | 0 | 0 | 0 |
| `legacy` | 0 | 97 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `marketing` | 0 | 174 | 0 | 11 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `mesh` | 0 | 271 | 0 | 7 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `news` | 0 | 65 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ocean` | 0 | 196 | 0 | 10 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `photos` | 0 | 248 | 0 | 1 | 0 | 0 | 7 | 1 | 0 | 0 | 0 |
| `plugins` | 0 | 62 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `plumbing` | 0 | 142 | 0 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `productivity` | 0 | 146 | 0 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 0 |
| `reflection` | 0 | 396 | 0 | 2 | 1 | 1 | 2 | 0 | 0 | 0 | 0 |
| `root` | 0 | 405 | 0 | 7 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| `settings` | 0 | 136 | 0 | 7 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| `spectate` | 0 | 296 | 0 | 0 | 0 | 0 | 4 | 2 | 0 | 0 | 0 |
| `staking` | 0 | 225 | 0 | 8 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| `strategic-adds` | 0 | 169 | 0 | 11 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `telecommunications` | 0 | 165 | 0 | 3 | 0 | 0 | 3 | 1 | 0 | 0 | 0 |
| `training-room` | 0 | 288 | 0 | 0 | 1 | 1 | 7 | 2 | 0 | 0 | 0 |
| `ux-suite` | 0 | 186 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `vote` | 0 | 186 | 0 | 3 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |

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

### `trades` — 15.01
- 2611 LOC (1131 inline-bloat) · 18 feature component imports · 19 files in `components/trades/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 58 useState · 0 useEffect · 21 top-level screen branches

### `studio` — 14.89
- 2997 LOC (1397 inline-bloat) · 20 feature component imports · 40 files in `components/studio/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 50 useState · 6 useEffect · 20 top-level screen branches
- **1 macro(s) called from 2+ sites** — candidate duplicate flows for the same action

### `education` — 14.64
- 4789 LOC (2829 inline-bloat) · 26 feature component imports · 25 files in `components/education/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 61 useState · 1 useEffect · 24 top-level screen branches

### `fitness` — 14
- 2142 LOC (1202 inline-bloat) · 9 feature component imports · 19 files in `components/fitness/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 53 useState · 0 useEffect · 8 top-level screen branches

### `crypto` — 12.99
- 1712 LOC (592 inline-bloat) · 12 feature component imports · 18 files in `components/crypto/`
- **2 view-state machine(s)** · 3/3 render strategies coexisting · 30 useState · 2 useEffect · 34 top-level screen branches

### `council` — 12.84
- 3284 LOC (2404 inline-bloat) · 8 feature component imports · 6 files in `components/council/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 23 useState · 0 useEffect · 11 top-level screen branches

### `game` — 12.65
- 1588 LOC (888 inline-bloat) · 5 feature component imports · 5 files in `components/game/`
- **3 view-state machine(s)** · 2/3 render strategies coexisting · 20 useState · 2 useEffect · 8 top-level screen branches

### `music` — 12.19
- 2460 LOC (1520 inline-bloat) · 9 feature component imports · 17 files in `components/music/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 25 useState · 1 useEffect · 12 top-level screen branches

### `code` — 12.1
- 2692 LOC (1212 inline-bloat) · 18 feature component imports · 29 files in `components/code/`
- **0 view-state machine(s)** · 2/3 render strategies coexisting · 47 useState · 7 useEffect · 33 top-level screen branches

### `agriculture` — 12
- 2202 LOC (902 inline-bloat) · 15 feature component imports · 23 files in `components/agriculture/`
- **2 view-state machine(s)** · 2/3 render strategies coexisting · 51 useState · 0 useEffect · 18 top-level screen branches
