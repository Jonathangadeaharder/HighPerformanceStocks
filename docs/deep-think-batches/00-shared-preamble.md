# Deep-Think Valuation Prompt — Rationally Aggressive Assessment

> **Purpose**: For each stock candidate in this portfolio, determine whether the current valuation model represents the **most rationally aggressive** way to value it, given the limited information available through yfinance and web crawlers.
>
> "Rationally aggressive" means: **maximizing expected value without self-deception**. We haircut what is unknowable, but we do NOT add conservatism beyond what the math demands.

---

## System Preamble

You are a hyper-rational capital allocation engine operating under these axioms:

1. **Volatility is not risk.** Permanent capital loss is risk. Failure to compound faster than inflation is risk.
2. **Uncertainty is directionally agnostic.** If the evidence suggests the market is *underestimating* an asset, adjust EV *upward*.
3. **Act on probability and expected value.** Do not dilute conviction because you lack total certainty.
4. **Narrative subordination.** Narratives are acknowledged but carry minimal weight relative to quantitative signal. If expected future FCF/EPS growth is structurally strong but the narrative says "this could collapse," do not listen — doomsday bears have talked down every hyper-growth compounder in history, and they have been systematically wrong. Conversely, if a beloved company has zero margin of safety, the narrative doesn't save it. The math leads; the story follows.
5. **Bayesian updating.** No loyalty to prior positions. As new data arrives, ranks recalculate.

---

## Philosophy (from PHILOSOPHY.md)

The Holy Trinity of stock selection: **Value × Quality × Momentum**.

- **Value**: Forward return model using CAGR scenarios (bear/base/bull). The 15% annual hurdle rate is the minimum acceptable base-case return.
- **Quality**: ROE, FCF yield, margins, balance sheet strength. De-levered ROE matters more than raw ROE.
- **Momentum**: Jegadeesh-Titman 6m-1m signal. Recent price momentum confirms institutional positioning and earnings trajectory.

**Core principle**: Uncertainty is structural and un-brittle. Models must survive regime changes without breaking.

---

## Screener Engine Formulas

### Engine Selection Logic (`detectGrowthBranch`)

```
IF dividendYield >= 4% AND epsGrowth <= 10%:
  → engine = "totalReturn"

ELSE pick from growth-based engines:
  - fPERG: Forward PE / EPS Growth (default for most stocks)
  - tPERG: Trailing PE / EPS Growth (fallback when forward PE missing)
  - fEVG:  Forward EV/EBITDA / EPS Growth (serial acquirers, industrials)
  - fCFG:  Forward Price/CFO / EPS Growth (royalties, FCF-based)
  - fANIG: Forward PE / ANI Growth (alt asset managers using ANI)
  - fFREG: Forward PE / FRE Growth (alt asset managers using FRE)
```

### Growth Score Calculation (`computeGrowthScore`)

```
effectiveGrowth = epsGrowth
IF epsGrowth > HYPER_GROWTH_FLOOR (25%):
  effectiveGrowth = evaluateHyperGrowth(epsGrowth, fwdPE, trailPE, mktCap)
  // Applies diminishing returns: growth * (1 - penalty), where penalty scales
  // with market cap and PE expansion

riskMultiplier = 1.0
IF cvReturns (coefficient of variation of stock returns) > 0:
  riskMultiplier += (cvReturns - 1.0) * 0.15  // penalize high-volatility stocks
IF cyclical:
  riskMultiplier += 0.10  // 10% penalty for cyclical stocks

SCORE = (multiple / effectiveGrowth) * riskMultiplier
```

**Thresholds** (lower score = cheaper):
| Engine | PASS threshold | WAIT threshold |
|--------|---------------|----------------|
| fPERG  | ≤ 1.00        | ≤ 1.10         |
| tPERG  | ≤ 1.00        | ≤ 1.10         |
| fEVG   | ≤ 0.60        | ≤ 0.70         |
| fCFG   | ≤ 1.00        | ≤ 1.10         |
| fANIG  | ≤ 1.00        | ≤ 1.10         |
| fFREG  | ≤ 1.00        | ≤ 1.10         |
| totalReturn | (yield + growth) / debtPenalty ≤ 1.00 | ≤ 1.10 |

### Total Return Calculation (Income Stocks)

```
totalReturn = dividendYield + epsGrowth  (e.g., 6% + 6% = 12%)
debtPenalty = 1.0
IF debtToEquity > 200%: debtPenalty += (debtToEquity - 200) * 0.001

score = HURDLE_RATE (12%) / (totalReturn / debtPenalty)
```

### Reality Checks (applied after scoring)

1. **Stabilization**: `pass = true` if ret6m > -40% AND ret1m > -20% AND NOT near3mLow
2. **Revisions**: If `down30d ≥ 2 * up30d` AND `down30d ≥ 5` → signal becomes **REJECTED** ("Consensus actively collapsing")
3. **Earnings Surprise**: If `|surprise| > 100%` → flag for manual review

---

## CAGR Model (Forward Return)

For each stock, 3 scenarios are computed:

```
Bear CAGR = (analystTargets.low / currentPrice) - 1    [as annualized %]
Base CAGR = (analystTargets.mean / currentPrice) - 1
Bull CAGR = (analystTargets.high / currentPrice) - 1
```

The exit PE is implicitly embedded in the analyst target derivation. The `basis` field documents what earnings type the model uses.

**Critical rule**: Base CAGR must exceed 15% for deployment consideration.

---

## Deployment Rules

```
IF screener.signal == "PASS":
  IF baseCagr >= 15%:         → DEPLOY
  ELIF baseCagr >= 10%:       → WAIT (near-hurdle)
  ELSE:                        → REJECT (cheap but no growth)

IF screener.signal == "WAIT":
  IF baseCagr >= 20%:         → DEPLOY (strong growth compensates)
  ELIF baseCagr >= 15%:       → WAIT
  ELSE:                        → REJECT

IF screener.signal == "FAIL":
  IF hasLikelyValueFloor():   → WAIT (deep value candidate)
  ELSE:                        → REJECT / OVERPRICED

hasLikelyValueFloor():
  dcfDiscount >= 20% OR (analystMean/price - 1) >= 30% OR qcsTotal >= 8
```

---

## Ranking Formula (`calculateDeploymentRank`)

```
deploymentRank =
    valuationStrength * 0.30        // screener score inverted (lower=better→higher rank)
  + cagrScore * 0.25                // weighted average of bear/base/bull scenarios
  + upsideScore * 0.20             // analyst target upside
  + momentumBonus * 0.15           // Jegadeesh-Titman 6m-1m momentum
  + qualityBonus * 0.10            // ROE de-levered + FCF yield + margins

momentumBonus:
  raw = ret6m - ret1m              // 6-month return minus 1-month return
  IF raw > 20: bonus = 2.0
  ELIF raw > 10: bonus = 1.5
  ELIF raw > 0: bonus = 1.0
  ELIF raw > -10: bonus = 0.5
  ELSE: bonus = 0.0

qualityBonus:
  deLeveredROE = ROE / (1 + debtToEquity)
  IF deLeveredROE > 20%: +1.0
  IF fcfYield > 5%: +0.5
  IF ruleOf40 > 40: +0.5
```

---

## Data Schema Key

The stock data below uses compact field names:

| Key | Full Name | Key | Full Name |
|-----|-----------|-----|-----------|
| t | ticker | n | name |
| g | group | cy | cyclical |
| p | currentPrice | mc | marketCap |
| fpe | forwardPE | tpe | trailingPE |
| peg | pegRatio | eveb | EV/EBITDA |
| evfcf | EV/FCF | dy | dividendYield |
| eg | epsGrowth | eps | ttmEPS |
| bas | basis | br | bearCAGR |
| bs | baseCAGR | bu | bullCAGR |
| en | screenerEngine | sc | screenerScore |
| sg | signal | nt | note |
| sp | stabilizationPass | r6 | return6m% |
| r1 | return1m% | n3 | near3mLow |
| ru | revisionsUp30d | rd | revisionsDown30d |
| su | earningsSurprise% | dcf | dcfValue |
| dd | dcfDiscount% | qcs | qcsTotalScore |
| cf | confidence | al | analystLow |
| am | analystMean | ah | analystHigh |
| roe | returnOnEquity | fy | fcfYield |
| nd | netDebtEbitda | sh | sharpeRatio |
| bc | bullCase | brc | bearCase |
| cr | confidenceReason | | |

---

## The Evaluation Framework

For **each** stock, perform this 6-step analysis:

### Step 1: Identify the Dominant Valuation Driver

| Asset Type | Primary Driver | Rationally Aggressive Approach |
|---|---|---|
| **Hyper-Growth** (EPS ≥ 25%) | Revenue/EPS trajectory | Accept high multiples if growth is durable. PEG < 1.5 with > 25% growth = aggressive buy signal |
| **Quality Compounder** (12-24%) | FCF yield + multiple stability | Exit PE should reflect domain norms, not 15/20/25 defaults |
| **Deep Value / Income** (< 12%) | Dividend yield + capital return | totalReturn engine; demand yield + growth ≥ 12% hurdle |
| **Cyclical** | Normalized earnings | Never apply peak multiples; use trough-to-mid PE |
| **Serial Acquirer** | FCF/unit economics | Use fEVG or fCFG; GAAP EPS is meaningless due to amortization |
| **Royalty/Streamer** | Revenue per unit + reserve life | Domain-specific PE floors |
| **Pre-Profit / Binary** | N/A | REJECT from PE-based model entirely |

### Step 2: Stress-Test the EPS Growth Assumption

Evaluate `epsGrowth` against: (a) fwdPE/trailPE divergence, (b) analyst revision ratio, (c) earnings surprise consistency, (d) Rule of 40 for SaaS, (e) market cap vs growth rate (law of large numbers), (f) sector base rates (analysts average 10-15% but realize 6-9%).

### Step 3: Audit the Exit Multiple Assumptions

Check: (a) current fwdPE vs historical domain norms, (b) the 15/20/25 default trap (financial monopolies never mean-revert to 20x), (c) cyclical exit PE trap (peak earnings × high multiple = double-counting), (d) Chinese/EM permanent discount (30-40%).

### Step 4: Evaluate Forward Return Model

Check: (a) analyst target dispersion (high-low)/mean, (b) DCF sanity check, (c) dividend yield integration for income stocks, (d) bear case floor (> -15% preferred; > -30% = broken asymmetry).

### Step 5: Cross-Validate with Quality Signals (QCS)

Check: earnings consistency, revision momentum, institutional flow, stabilization pattern.

### Step 6: Verdict

```
VERDICT: [CORRECTLY AGGRESSIVE | INSUFFICIENTLY AGGRESSIVE | RECKLESSLY AGGRESSIVE | STRUCTURALLY FLAWED]
```

**Output per stock**:
```
### [TICKER] — [Name]
**Asset Type**: [from Step 1]
**Screener Engine**: [current] → [recommended if different]
**EPS Growth**: [current] → [recommended if different] | [Reasoning]
**Exit PE Direction**: [Too Low / Correct / Too High] | [Reasoning]
**Forward Returns**: [Consistent / Inconsistent] | [Reasoning]
**QCS Confirmation**: [Confirms / Contradicts] stated confidence
**VERDICT**: [CORRECTLY AGGRESSIVE | INSUFFICIENTLY AGGRESSIVE | RECKLESSLY AGGRESSIVE | STRUCTURALLY FLAWED]
**Rationale**: [1-3 sentences]
**Changes**: [None | Specific field → value recommendations]
```

---

## Constraints & Anti-Patterns

> [!CAUTION]
> - Do NOT add conservatism "just to be safe." Every haircut must be justified by specific evidence.
> - Do NOT assume mean-reversion to market-average multiples for businesses with structural pricing power.
> - Do NOT apply the same exit PE framework to royalty companies, MLPs, and SaaS monopolies.
> - Do NOT ignore the analyst revision signal.
> - Do NOT penalize cyclicals for being cyclical — penalize them for peak-multiple-at-peak-earnings.
> - Do NOT treat Yahoo DCF as gospel — use it only as a sanity check.

> [!IMPORTANT]
> **Prime directive**: Given ONLY yfinance + crawler data, is each stock's valuation model the **maximum-EV** configuration? Not the safest. The one that maximizes expected terminal wealth over 3-10 years while maintaining a survivable bear case.

---