# Deep-Think Audit Output — Batch 9: Cybersecurity & Industrial

> **Status**: COMPLETE | **Date**: 2026-03-28 | **Stocks**: CRWD, FTNT, NET, PANW, RBRK, RTX, ZS

---

## Change Log

| Ticker | Verdict              | Engine Change     | Multiple Change       | Signal Change     | Key Override Triggers                                   |
|--------|----------------------|-------------------|-----------------------|-------------------|---------------------------------------------------------|
| CRWD   | CORRECTLY AGGRESSIVE | None              | None                  | FAIL (unchanged)  | Zero margin of safety at 62.5x PE. Absolute REJECT.     |
| FTNT   | CORRECTLY AGGRESSIVE | fPERG → **fCFG**  | fPE 23.8x → EV/FCF 32x | FAIL (unchanged) | 13% Base CAGR < 15% hurdle. Strip hardware D&A noise.   |
| NET    | CORRECTLY AGGRESSIVE | None              | None                  | FAIL + note       | Reality Check: consensus actively collapsing (13 down ≥ 2×5 up). |
| PANW   | CORRECTED → DEPLOY   | fPERG → **fCFG**  | fPE 38.6x → EV/FCF 42.3x | FAIL → **DEPLOY** | hasLikelyValueFloor (35.6% upside) + baseCagr=36% ≥ 20%. |
| RBRK   | CORRECTED → DEPLOY   | totalReturn → **fCFG** | N/A → EV/FCF 23x | FAIL → **DEPLOY** | Engine misclassification fixed. QCS=12.92 ≥ 8 + bear CAGR=36% ≥ 20%. |
| RTX    | CORRECTED (FAIL)     | fPERG → **fEVG**  | fPE 26x → EV/EBITDA 20.1x | FAIL (unchanged) | 2.2x net debt mandates fEVG. 12% CAGR < 15% hurdle.   |
| ZS     | CORRECTED → DEPLOY   | fPERG → **fCFG**  | fPE 30.4x → EV/FCF 20.3x | FAIL → **DEPLOY** | EPS growth 24%→25%, bear CAGR +18% > hurdle overrides stabilization. |

---

## Systemic Findings

### 1. fCFG Bias Against SBC-Heavy Cybersecurity Platforms

PANW, ZS, and RBRK all carry heavy GAAP distortions (SBC, free-product period revenue drags, or pre-profit
classification). Using `fPERG` creates artificially inflated valuation scores, producing false rejections of
mathematically asymmetrical setups. The corrective pattern:

- **Trigger**: FCF margin > 25% AND GAAP EPS heavily suppressed by SBC or strategic transitions
- **Fix**: Switch to `fCFG` with `EV/FCF` as primary multiple
- **Override Rules**: `hasLikelyValueFloor()` if analyst upside > 30% OR bear CAGR ≥ 15%, then DEPLOY

### 2. Engine Misclassification — totalReturn (RBRK) and fPERG (RTX)

Two structural engine errors detected:

- **RBRK**: Pre-profit SaaS routed to `totalReturn` because `epsGrowth=0%` parsed as dividend-like. This
  bypassed the required `dividendYield ≥ 4%` gate. Pre-profit hyper-growth platforms **must** be evaluated
  on `fCFG` (EV/FCF vs. top-line ARR/Revenue growth).
- **RTX**: Debt-heavy industrial (2.2x net debt) evaluated on `fPERG`, which uses non-GAAP EPS that
  aggressively backs out D&A from the massive capex base. This understates true economic leverage cost.
  Industrials with net debt > 1.5x must default to `fEVG`.

### 3. Peer Valuation Spread — NET vs. ZS

The market is paying a ~900% cash-flow premium for Cloudflare (NET) over Zscaler (ZS):

| Metric        | NET   | ZS    | Ratio  |
|---------------|-------|-------|--------|
| EV/FCF        | 196x  | 20.3x | 9.7×   |
| Growth        | 27%   | 25%   | 1.08×  |
| QCS           | 0.76  | 14.77 | 0.05×  |
| Consensus Dir | ↓↓    | ↑↑    | —      |

ZS is structurally mispriced to the downside; NET is mispriced to the upside.

---

## Top 3 Most Mispriced (Batch 9)

1. **ZS** — 20.3x EV/FCF for 25% growth + 34% FCF margins + 36 upward revisions. Bear CAGR +18% = hard floor.
2. **RBRK** — Engine misclassification hid 48% top-line growth at 23x EV/FCF with QCS=12.92 and +36% bear floor.
3. **PANW** — Market myopia on platformization transition created a +36% base CAGR entry into the highest-quality
   cybersecurity compounder with 38% FCF margins.

---

## Signal Tally (Batch 9)

| Signal Pre-Patch | Count | Signal Post-Patch | Count |
|------------------|-------|-------------------|-------|
| FAIL             | 7     | FAIL              | 4     |
| —                | —     | DEPLOY            | 3     |
