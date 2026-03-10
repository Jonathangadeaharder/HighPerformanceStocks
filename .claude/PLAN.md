# PLAN

- Goal: Research-only assessment of whether CAGR scenarios are realistic after applying exponential growth decay to already-conservative epsGrowth inputs across 14 stocks.

- Constraints: No file edits. Research only. Must web-search analyst consensus for all 14 stocks.

- Steps:
  1) Read all 14 JSON files to extract epsGrowth, CAGR scenarios, and context
  2) Read the decay model code to understand exact mechanics
  3) Web search analyst consensus 5-year EPS growth for each stock
  4) Calculate effective average growth under decay model for each stock
  5) Compare effective growth vs analyst consensus and assess double-penalization risk
  6) Produce summary table with verdicts and suggested adjustments

- Risks & checkpoints:
  - Analyst "5yr EPS growth" estimates vary widely by source
  - For royalty/streaming companies, EPS growth is gold-price-dependent and highly uncertain
  - Some stocks may legitimately need the decay (near-term rates used as input) while others are already moderated

- Verify: Table produced with all 14 stocks, clear verdicts, actionable suggestions
