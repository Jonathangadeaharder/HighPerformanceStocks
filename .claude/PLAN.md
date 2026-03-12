# PLAN

- Goal: Peer review all 75 stock data files for correctness, rational estimates, and internal consistency

- Constraints: 75 stock JSON files, each with valuation metrics, CAGR model, and consensus data

- Steps:
  1) Read data schema and validation script
  2) Extract key fields from all files programmatically
  3) Run automated checks (CAGR math, Sharpe, target vs consensus, etc.)
  4) Deep-dive flagged stocks manually
  5) Present findings categorized by severity

- Risks & checkpoints: Prices may be stale; model may use undocumented adjustments (e.g. decay model)

- Verify: Each finding cross-referenced against at least 2 data points
