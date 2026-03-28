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

---

## Batch 4/10: Defensive Monopolies & Payments (9 stocks)

> **Batch-specific guidance**: These are irreplaceable monopolies with extreme pricing power. Pay attention to: (a) whether the low-volatility toll-road nature is correctly reflected, (b) exit PE calibration for perpetual monopolies, (c) TSLA as a controversial inclusion with extreme forward PE.

### Stock Data

```jsonl
{"t":"AAPL","n":"Apple","g":"Consumer Monopolies","cy":false,"p":"$252.62","mc":"$3713.0B USD","fpe":27.1,"tpe":31.9,"eveb":24.4,"evfcf":35.1,"dy":"0%","eg":"10%","eps":7.89,"bas":"Non-GAAP EPS (adjusted for buyback skew)","br":"-19%","bs":"17%","bu":"39%","en":"fPERG","sc":2.67,"sg":"FAIL","sp":true,"r6":-1.1,"r1":-7.4,"n3":true,"ru":5,"rd":2,"su":6.3,"dcf":158.11,"dd":-37,"qcs":4.57,"cf":"high","al":205,"am":295.31,"ah":350,"roe":"152.0%","fy":"~3%","nd":"0.2x","sh":0.18,"bc":"Apple's Services segment (App Store, iCloud, Apple TV+, Apple Pay) is growing 15%+ annually and now represents ~40% of gross profit at 70%+ margins. Apple Intelligence AI features are the catalyst for an iPhone 17 upgrade supercycle in 2025-2026. The $100B+ annual buyback program reduces float by ~3% per year, compounding EPS mechanically.","brc":"Apple is expensive at 27x forward PE for a 10% EPS grower. China revenue (~18% of total) faces escalating geopolitical and regulatory pressure. Antitrust actions targeting the App Store 30% commission could remove $5-8B of annual high-margin revenue. Hardware replacement cycles are extending as smartphones mature.","cr":"Unmatched consumer hardware ecosystem and services revenue moat. Massive, relentless share repurchases support EPS floor."}
{"t":"FICO","n":"Fair Isaac Corp","g":"Defensive Monopolies","cy":false,"p":"$1043.10","mc":"$24.7B USD","fpe":19.6,"tpe":38.6,"peg":2.1,"eveb":27.6,"evfcf":48.5,"dy":"0%","eg":"18%","eps":27.02,"bas":"Non-GAAP EPS; growth driven by B2B Scores pricing increases and SaaS platform transition","br":"-1%","bs":"79%","bu":"130%","en":"fPERG","sc":1.09,"sg":"WAIT","sp":true,"r6":-31.3,"r1":-24.9,"n3":false,"ru":13,"rd":2,"su":3.5,"qcs":6.29,"cf":"high","al":1032,"am":1872.18,"ah":2400,"roe":"45.0%","fy":"~2%","nd":"3.0x","sh":1.13,"bc":"FICO operates an irreplaceable, legally entrenched monopoly—the FICO credit score—used by ~90% of US lenders. Boasting near 50% operating margins and astronomical capital efficiency (>40% ROIC). The launch of 'Mortgage Direct' successfully defends its pricing power against regulatory shifts (like VantageScore) by bypassing credit bureaus and charging lenders directly.","brc":"The ultimate risk is regulatory disruption of its monopoly status. The FHFA authorizing Fannie/Freddie to accept VantageScore 4.0 breaks FICO's absolute gatekeeper status for the $13T mortgage market. Valued for absolute perfection at ~60x P/E; any loss of market share will cause severe multiple compression.","cr":"Unregulated natural monopoly with ~48% operating margins and elite 40%+ ROIC. Shifting to fixed-fee direct licensing protects pricing power."}
{"t":"ISRG","n":"Intuitive Surgical","g":"Robotics","cy":false,"p":"$469.98","mc":"$166.9B USD","fpe":41.1,"tpe":59.9,"peg":null,"eveb":45.3,"evfcf":70.9,"dy":"0%","eg":"14%","eps":7.85,"bas":"GAAP EPS; premium monopoly warrants above-market PE; bear assumes compression to 35x","br":"-20%","bs":"29%","bu":"60%","en":"fPERG","sc":2.85,"sg":"FAIL","sp":true,"r6":6.5,"r1":-7.3,"n3":true,"ru":3,"rd":0,"su":11.6,"qcs":5.52,"cf":"medium","al":378,"am":605.08,"ah":750,"roe":"16.7%","fy":"~1%","nd":"Net cash","sh":0.47,"bc":"Dominant surgical robotics platform with 9,000+ installed systems globally. Razor-and-blade model: instruments and accessories are ~70% of revenue. da Vinci 5 upgrade cycle drives procedure growth. Expanding into new surgical categories. Deep moat from surgeon training and hospital integration.","brc":"62x trailing PE leaves no room for error. Competition from Medtronic Hugo and J&J Ottava emerging. Procedure growth could decelerate as penetration matures. Large cap limits upside magnitude.","cr":"Unmatched surgical robotics monopoly with 9,000+ installed da Vinci systems. Razor-and-blade recurring revenue. But premium valuation limits upside."}
{"t":"KYCCF","n":"Keyence Corporation","g":"Robotics","cy":false,"p":"$370","mc":"$89.7B USD","fpe":32,"tpe":34.8,"peg":null,"eveb":null,"dy":"1%","eg":"8%","eps":10.7,"bas":"Through-cycle normalized growth; current ~5% consensus reflects cyclical trough in factory automation","en":"totalReturn","sc":1.33,"sg":"FAIL","sp":true,"r6":-0.5,"r1":-12.6,"n3":false,"ru":0,"rd":0,"qcs":0,"cf":"medium","roe":"~15%","fy":"~2.5%","nd":"Net cash","sh":0.06,"bc":"World leader in factory automation sensors and vision systems. 55%+ operating margins are best-in-class in industrial tech. Direct sales model creates stickiness and competitive moat. Massive net cash position. Secular tailwind from global factory automation and AI-driven manufacturing.","brc":"38x PE is expensive for a hardware company. JPY/USD currency risk for US-listed ADR. Cyclical exposure to manufacturing capex. Growth limited to 10-12% in mature markets.","cr":"Japan's most profitable manufacturer. 55%+ operating margins in factory automation sensors. Direct sales model creates deep moat. But premium valuation and yen exposure."}
{"t":"MA","n":"Mastercard","g":"Defensive Monopolies","cy":false,"p":"$502.76","mc":"$448.7B USD","fpe":22.2,"tpe":30.4,"peg":null,"eveb":22.3,"evfcf":28.1,"dy":"1%","eg":"15%","eps":16.54,"bas":"Non-GAAP EPS; exit PE calibrated to 5yr average trading range","br":"10%","bs":"33%","bu":"48%","en":"fPERG","sc":1.43,"sg":"FAIL","sp":false,"r6":-11,"r1":-2.3,"n3":true,"ru":3,"rd":0,"su":12.3,"qcs":5.44,"cf":"medium","al":550,"am":662.59,"ah":739,"roe":"209.9%","fy":"~4%","nd":"0.4x","sh":1.02,"bc":"The ultimate inflation-protected toll roads. Processing billions of transactions with effectively zero marginal cost of operation yields supreme pricing power.","brc":"Mature global penetration results in highly predictable, low-volatility compounding. Inadequate for a synthetic leverage strategy requiring violent upside velocity.","cr":"Same duopoly dynamics as Visa. Asset-light perfection. But insufficient volatility for the 2x leverage simulation target."}
{"t":"MCK","n":"McKesson","g":"Healthcare Monopolies","cy":false,"p":"$879.75","mc":"$108.6B USD","fpe":19.9,"tpe":25.4,"eveb":19.4,"evfcf":12.5,"dy":"0%","eg":"15%","eps":34.66,"bas":"Non-GAAP EPS","br":"-2%","bs":"13%","bu":"26%","en":"fPERG","sc":1.27,"sg":"FAIL","sp":true,"r6":15.7,"r1":-9.7,"n3":false,"ru":2,"rd":0,"su":0.7,"qcs":5.31,"cf":"high","al":860,"am":997.67,"ah":1107,"fy":"~8%","nd":"1.0x","sh":0.27,"bc":"McKesson is a pharmaceutical distribution monopoly (with Cencora and Cardinal Health) distributing over 30% of US drug supply. The business is structurally non-disruptable — drug distribution requires regulatory compliance, cold chain, and scale economics that no new entrant can replicate. Systematic share buybacks (8%+ annual float reduction) drive 15%+ EPS growth on 5-7% revenue growth.","brc":"Drug distribution is a razor-thin margin business — McKesson earns <1% net margin on $300B+ of drug revenue. Any repricing of generic drug contracts, specialty drug exclusivity losses, or government reimbursement rate cuts flows directly through to EPS. PBM consolidation increases buyer bargaining power against distributors.","cr":"Consolidated oligopoly drug distributor. Massive share repurchases lead to consistent 12–15% EPS growth floors."}
{"t":"NOW","n":"ServiceNow","g":"Defensive Monopolies","cy":false,"p":"$103.06","mc":"$108.7B USD","fpe":20.5,"tpe":61.7,"eveb":38,"evfcf":21,"dy":"0%","eg":"21%","eps":2.7,"bas":"10-for-1 split-adjusted adjusted EPS (ServiceNow executed 10-for-1 split February 2025); mature workflow SaaS multiple","br":"19%","bs":"83%","bu":"152%","en":"fPERG","sc":0.97,"sg":"PASS","sp":true,"r6":-44.9,"r1":-5.7,"n3":false,"ru":2,"rd":2,"su":3.9,"qcs":5.23,"cf":"medium","al":122.78,"am":188.67,"ah":260,"roe":"15.5%","fy":"~5%","nd":"Net cash","sh":1.93,"bc":"The central nervous system for enterprise IT. Highly sticky subscription revenue with strong cross-selling opportunities via AI modules.","brc":"Trades at a premium software multiple; vulnerable to broader enterprise IT spending slowdowns.","cr":"Massive, sticky IT workflow platform with ~21.5% annualized EPS growth and elite FCF margins, though valuation still caps upside."}
{"t":"TSLA","n":"Tesla, Inc.","g":"Data & Software Monopolies","cy":true,"p":"$385.95","mc":"$1448.3B USD","fpe":137.3,"tpe":357.4,"eveb":135.2,"evfcf":380.3,"dy":"0%","eg":"35%","eps":1.08,"bas":"Non-GAAP EPS","br":"-69%","bs":"9%","bu":"55%","en":"fPERG","sc":5.04,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-12.4,"r1":-5.5,"n3":false,"ru":1,"rd":3,"su":11,"dcf":18.06,"dd":-95,"qcs":-1.03,"cf":"high","al":119,"am":421.27,"ah":600,"roe":"4.9%","fy":"~0%","nd":"Net cash","sh":-0.21,"bc":"Tesla achieves full autonomy and ramps up energy storage, maintaining extreme dominance in the clean energy sector.","brc":"Increased EV competition, price wars, and leadership distractions cause margin compression and slowing growth.","cr":"Leader in electric vehicles, battery energy storage, and AI software/robotics. Unprecedented scale and brand power, though exposed to auto-cycle cyclicality and massive continuous capital requirements. High premium commands a flawless execution trajectory."}
{"t":"V","n":"Visa","g":"Defensive Monopolies","cy":false,"p":"$304.91","mc":"$587.9B USD","fpe":21,"tpe":28.7,"peg":null,"eveb":20.2,"evfcf":26.6,"dy":"1%","eg":"14%","eps":10.64,"bas":"Non-GAAP EPS; exit PE calibrated to 5yr average trading range","br":"7%","bs":"32%","bu":"49%","en":"fPERG","sc":1.44,"sg":"FAIL","sp":true,"r6":-9.6,"r1":-3.7,"n3":true,"ru":3,"rd":0,"su":0.9,"dcf":232.32,"dd":-24,"qcs":5.14,"cf":"medium","al":323,"am":400.2,"ah":450,"roe":"54.0%","fy":"~4%","nd":"0.2x","sh":0.98,"bc":"The ultimate inflation-protected toll roads. Processing 67.7 billion transactions with effectively zero marginal cost of operation yields supreme pricing power.","brc":"Mature global penetration results in highly predictable, low-volatility compounding. Inadequate for a synthetic leverage strategy requiring violent upside velocity.","cr":"Ultimate inflation-protected toll road. >50% ROIC, 78% gross margin. But too low-volatility (~16%) for synthetic leverage strategy. Predictable compounder."}
```

---

## Instructions

Analyze each of the 9 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
