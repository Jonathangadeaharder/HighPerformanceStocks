# PLAN

- Goal: All pending tasks from the Sharpe/Ruthlessly Cut audit are now complete.

- Completed this session:
  1) Automated Sharpe ratio calculation in update-data.js — formula: (midpoint CAGR - 4.5%) / volatility
  2) Moved TDG from "Ruthlessly Cut" to "Defensive Monopolies" (derives as high confidence: base 19%, bear 14%)
  3) Moved XYZ/Block from "Ruthlessly Cut" to "Financials & Alt Assets" (derives as medium confidence: base 14%, bear 9%)
  4) Renamed SQ.json → XYZ.json to match the ticker
  5) Ran update-data --force — all 46 stocks updated, Sharpe ratios recomputed
  6) Build verified clean

- Previously completed (prior session):
  - Added 3 emerging-market stocks (HDB, BABA, 0700.HK) with HKD currency support
  - Implemented exponential growth decay model (McKinsey/Koller methodology)
  - Calibrated 23 stocks' epsGrowth for decay model
  - Switched 6 royalty stocks from P/E to P/CF model
  - Reclassified TPL/VNOM to "Energy Royalties" group
  - Added try/catch on JSON parsing, smart EPS guardrail (--force)
  - Switched LMN.V from GAAP EPS to FCFA2S
  - Git initialized with .gitignore

- Verify: `pnpm build` clean ✓, all 47 stocks loading correctly
