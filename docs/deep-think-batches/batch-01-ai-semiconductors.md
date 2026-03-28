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

## Batch 1/10: AI & Semiconductors (15 stocks)

> **Batch-specific guidance**: These are cyclical semiconductor and AI infrastructure stocks. Pay special attention to: (a) cyclical peak-multiple traps, (b) hyper-growth penalty calibration, (c) China export control revenue risk, (d) whether fPERG is the right engine for all of these or if some should use fEVG.

### Stock Data

```jsonl
{"t":"ALAB","n":"Astera Labs","g":"AI & Semiconductors","cy":true,"p":"$120.33","mc":"$20.5B USD","fpe":34.2,"tpe":98.6,"eveb":107.2,"evfcf":93.4,"dy":"0%","eg":"35%","eps":1.22,"bas":"Non-GAAP EPS","br":"29%","bs":"72%","bu":"108%","en":"fPERG","sc":1.08,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":-39.2,"r1":-3.5,"n3":false,"ru":11,"rd":2,"su":12.6,"qcs":12.14,"cf":"medium","al":155,"am":206.75,"ah":250,"roe":"18.8%","fy":"~1%","nd":"Net cash","sh":0.71,"bc":"Astera Labs makes PCIe and CXL retimers — the signal conditioning chips that enable high-speed connectivity in AI server clusters. As the only major standalone retimer vendor, it has design wins at Microsoft, Google, and AWS. The transition to CXL 3.0 memory pooling opens a new $5B+ TAM beyond the current retimer market.","brc":"Astera is an early-stage company with limited revenue visibility. Marvell and Broadcom are developing competing connectivity solutions that could displace standalone retimers. Hyperscaler capex pauses would immediately compress Astera's revenue. Customer concentration at 2-3 hyperscalers creates binary revenue risk.","cr":"Pure-play on AI connectivity, PCIe/CXL retimers critical for AI server clusters."}
{"t":"AMAT","n":"Applied Materials","g":"AI & Semiconductors","cy":true,"p":"$369.34","mc":"$293.1B USD","fpe":26.7,"tpe":37.9,"eveb":32.8,"evfcf":67.2,"dy":"1%","eg":"25%","eps":9.75,"bas":"Non-GAAP EPS","br":"-25%","bs":"12%","bu":"28%","en":"fPERG","sc":1.08,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":81.1,"r1":-1.7,"n3":false,"ru":30,"rd":0,"su":7.9,"qcs":12.03,"cf":"high","al":275,"am":410.63,"ah":470,"roe":"38.9%","fy":"~1%","nd":"Net cash","sh":-0.06,"bc":"Applied Materials has the broadest portfolio in semiconductor equipment — CVD, PVD, CMP, inspection, and display. Its AGS (Applied Global Services) segment generates $6B+ in high-margin recurring revenue from installed base maintenance, providing a 40%+ revenue floor through downturns. Advanced packaging (CoWoS, HBM) is a new growth vector where AMAT has strong positioning.","brc":"China revenues (~30% of total) are structurally at risk from escalating US export controls. If additional equipment restrictions are imposed, AMAT loses its single-largest growth market. Semiconductor equipment spending is among the most capital-intensive and volatile categories — a WFE downcycle of 20%+ is not uncommon. Concentrated customer risk (TSMC, Samsung, Intel).","cr":"Broadest portfolio in semiconductor manufacturing equipment. AGS services segment (~$6B) provides revenue resilience through WFE downturns. Advanced packaging (CoWoS, HBM) creates new growth vectors independent of leading-edge capex."}
{"t":"AMD","n":"Advanced Micro Devices","g":"AI & Semiconductors","cy":true,"p":"$220.27","mc":"$359.1B USD","fpe":20.5,"tpe":84.7,"eveb":52.3,"evfcf":76.9,"dy":"0%","eg":"35%","eps":2.6,"bas":"Non-GAAP EPS (Excluding Xilinx amortization)","br":"0%","bs":"31%","bu":"66%","en":"fPERG","sc":0.65,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":38.1,"r1":8.1,"n3":false,"ru":11,"rd":2,"su":16,"dcf":63.62,"dd":-71,"qcs":1.78,"cf":"medium","al":220,"am":289.61,"ah":365,"roe":"7.1%","fy":"~1%","nd":"Net cash","sh":0.45,"bc":"AMD's MI300X/MI350 GPU is the only viable alternative to NVIDIA's H-series in AI training and inference workloads. At ~35-40% the price of comparable NVIDIA hardware, AMD is winning budget-conscious hyperscaler allocations. Gaining CPU server share in x86 via EPYC Turin is a durable structural shift away from Intel.","brc":"NVIDIA's CUDA software moat is extraordinarily deep — switching costs for AI developers are immense. AMD's ROCm software ecosystem lags by 3-5 years. If NVIDIA's Blackwell/Vera Rubin delivers as promised, AMD's MI-series performance gap widens. Consumer GPU (RDNA) faces structural margin pressure from discrete GPU market contraction.","cr":"Targeting >35% data center revenue CAGR through 2028 with MI450 ramp and data center expansion."}
{"t":"ANET","n":"Arista Networks","g":"Network Infrastructure","cy":true,"p":"$135.01","mc":"$170.0B USD","fpe":31.7,"tpe":49.1,"peg":1.44,"eveb":40.5,"evfcf":46.9,"dy":"0%","eg":"21%","eps":2.75,"bas":"GAAP EPS; exit PE calibrated to 10yr average trading range","br":"4%","bs":"32%","bu":"63%","en":"fPERG","sc":1.51,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-5.3,"r1":3.7,"n3":false,"ru":0,"rd":2,"su":8.2,"qcs":9.13,"cf":"high","al":140,"am":177.74,"ah":220,"roe":"31.4%","fy":"~2%","nd":"Net cash","sh":0.55,"bc":"25% revenue growth is the new baseline through 2026. The 1.6T Ethernet transition is just beginning. Asset-light model means nearly all growth drops to the bottom line. Addressable market expanding to $105B in AI networking.","brc":"Forward P/E of 43x leaves little room for misses. Dependent on hyperscaler CapEx cycles. NVIDIA could fight back to keep InfiniBand dominant.","cr":"AI Ethernet networking monopoly. Zero debt, $10.7B cash. InfiniBand-to-Ethernet shift is multi-year tailwind. ROIC ~192% is asset-light perfection."}
{"t":"ASML","n":"ASML Holding","g":"AI & Semiconductors","cy":true,"p":"$1393.89","mc":"$547.3B USD","fpe":31.9,"tpe":48.6,"peg":null,"eveb":43.1,"evfcf":48.7,"dy":"1%","eg":"26%","eps":28.71,"bas":"5yr & 10yr avg PE (~36) (USD-equivalent ADR basis; underlying financials reported in EUR)","br":"-35%","bs":"6%","bu":"39%","en":"fPERG","sc":1.24,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":46.5,"r1":-4.8,"n3":false,"ru":4,"rd":0,"su":-2.7,"qcs":1.99,"cf":"low","al":894.48,"am":1469.35,"ah":1924.48,"roe":"50.5%","fy":"~2%","nd":"Net cash","sh":-0.06,"bc":"A literal monopoly on EUV lithography with flawless financial metrics (Rule of 40 at 49.5%). Sovereign fab build-outs render their equipment price-inelastic.","brc":"Uncompensated geopolitical variance drag. A 5.3% intraday drop in March 2026 due to export control panic proves that reliance on the Chinese market is a fatal vulnerability to DCF models.","cr":"Literal EUV monopoly with elite Rule of 40 (49.5%), but uncompensated geopolitical risk. 5.3% single-day drop on export control panic proves China dependency."}
{"t":"AVGO","n":"Broadcom","g":"AI & Semiconductors","cy":true,"p":"$318.81","mc":"$1511.6B USD","fpe":17.9,"tpe":62.1,"eveb":41.4,"evfcf":60.4,"dy":"1%","eg":"35%","eps":5.13,"bas":"Non-GAAP EPS (Excluding VMware amortization)","br":"14%","bs":"49%","bu":"99%","en":"fPERG","sc":0.56,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":-4.7,"r1":-0.9,"n3":false,"ru":36,"rd":0,"su":1.3,"qcs":0.27,"cf":"high","al":360,"am":472.01,"ah":630,"roe":"33.4%","fy":"~2%","nd":"0.8x","sh":1.11,"bc":"A flawless dual-engine compounder. It combines the hyper-growth velocity of custom AI hardware (ASICs/TPUs) with the high-margin, sticky recurring software revenue from VMware. Offers superior absolute scale and profitability compared to Marvell.","brc":"Heavy reliance on a few massive hyperscaler clients (like Google) for custom silicon revenues creates customer concentration risk.","cr":"Flawless dual-engine: AI ASICs + VMware recurring revenue. 41.5% upside to $467.62 target. Sharpe 0.15. Superior scale vs MRVL."}
{"t":"CDNS","n":"Cadence Design Systems","g":"AI & Semiconductors","cy":false,"p":"$281.39","mc":"$77.6B USD","fpe":29.9,"tpe":69.5,"peg":3.9,"eveb":40,"evfcf":50.5,"dy":"0%","eg":"20%","eps":4.05,"bas":"10yr avg PE","br":"-2%","bs":"32%","bu":"46%","en":"fPERG","sc":1.44,"sg":"FAIL","sp":true,"r6":-19.6,"r1":-5.4,"n3":false,"ru":3,"rd":1,"su":4.1,"qcs":5,"cf":"low","al":275,"am":371.68,"ah":410,"roe":"21.9%","fy":"~2%","nd":"Net cash","sh":0.45,"bc":"An unbreakable EDA software duopoly. They are the ultimate toll road; whether a custom AI chip succeeds or fails, designers must pay for their software licenses.","brc":"The margin of safety is nonexistent. With PEG ratios near 4.0x, valuation is severely outpacing growth. Recent shelf registration suggests management believes their own stock is richly valued.","cr":"PEG near 4.0x — valuation severely outpacing growth. Shelf registration suggests management sees stock as rich. Nonexistent margin of safety."}
{"t":"CRDO","n":"Credo Technology Group","g":"AI & Semiconductors","cy":true,"p":"$103.91","mc":"$19.2B USD","fpe":22,"tpe":57.1,"eveb":51.1,"evfcf":103.8,"dy":"0%","eg":"28%","eps":1.82,"bas":"Adjusted for semiconductor cyclicality and customer concentration risk.","br":"20%","bs":"92%","bu":"150%","en":"fPERG","sc":0.76,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":-27.3,"r1":-9.2,"n3":false,"ru":14,"rd":0,"su":13.7,"qcs":11.56,"cf":"medium","al":125,"am":199.38,"ah":260,"roe":"27.5%","fy":"~1%","nd":"Net cash","sh":0.97,"bc":"Credo's Active Electrical Cables (AECs) are displacing DACs (direct attach cables) in AI clusters for runs up to 7 meters — a massive addressable market as AI racks pack denser. Design wins at Microsoft (a major hyperscaler) validate the technology. Optical DSP chips for longer runs represent the next growth layer as data centers scale.","brc":"Credo is heavily concentrated in 1-2 hyperscaler customers. Any account loss or product substitution (Marvell or NVIDIA developing competing AEC solutions) would devastate revenue. At 22x forward PE, the stock is not cheap for a company with single-customer concentration risk. AI capex cycles would directly impact order volumes.","cr":"High-speed connectivity solutions for data centers, AEC cables taking share in AI networks."}
{"t":"LRCX","n":"Lam Research","g":"AI & Semiconductors","cy":true,"p":"$233.45","mc":"$293.2B USD","fpe":33.8,"tpe":47.8,"eveb":39.5,"evfcf":60.2,"dy":"0%","eg":"15%","eps":4.88,"bas":"Non-GAAP EPS","br":"-14%","bs":"18%","bu":"39%","en":"fPERG","sc":2.33,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":81.9,"r1":-2.4,"n3":false,"ru":4,"rd":0,"su":8.7,"qcs":2.09,"cf":"high","al":200,"am":274.9,"ah":325,"roe":"65.6%","fy":"~2%","nd":"Net cash","sh":0.15,"bc":"Lam Research dominates etch and deposition equipment — the two most critical process steps in advanced semiconductor manufacturing. As NAND recovers from its trough and advanced foundry (3D-stacking, gate-all-around) accelerates, Lam's wafer-fab equipment revenue is positioned for a major upcycle. Its high-margin Customer Support Business Group provides a ~$4B recurring revenue floor.","brc":"Lam's NAND exposure (~40% of revenue) makes it one of the most cyclically volatile names in semiconductor equipment. Memory capex cycles can compress revenue 30-40% within 12 months. US export controls on advanced equipment to China removed ~$1.5B of annual revenue. Any delay in the NAND recovery or GAA adoption pushes out the earnings inflection.","cr":"Oligopoly in etch and deposition equipment (alongside AMAT and KLA). Memory capex recovery from the deepest trough in a decade is the primary catalyst. High-margin services book provides earnings floor."}
{"t":"MRVL","n":"Marvell Technology","g":"AI & Semiconductors","cy":true,"p":"$98.45","mc":"$86.1B USD","fpe":18.1,"tpe":32.1,"peg":1.5,"eveb":33.6,"evfcf":61.1,"dy":"0%","eg":"30%","eps":3.07,"bas":"Non-GAAP EPS (excl. acquisition amortization from Inphi/Innovium); exit PE calibrated to peer growth premium","br":"-14%","bs":"22%","bu":"67%","en":"fPERG","sc":0.6,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":18.4,"r1":24.2,"n3":false,"ru":14,"rd":1,"su":1.1,"qcs":6.95,"cf":"medium","al":85,"am":120.5,"ah":164,"roe":"19.3%","fy":"~2%","nd":"0.8x","sh":0.35,"bc":"The structural bottleneck for AI has shifted from compute to networking. Marvell dominates this space. Trading at a reasonable 29.2x P/E, it offers vastly superior risk-adjusted torque compared to EDA software, bolstered by aggressive optical interconnect M&A.","brc":"High exposure to cyclical legacy enterprise networking markets which can drag down the explosive growth of their AI data center segment.","cr":"Dominates AI networking bottleneck at reasonable 29.2x P/E. Aggressive optical interconnect M&A. But legacy enterprise networking creates cyclical drag."}
{"t":"MU","n":"Micron Technology","g":"Disqualified","cy":true,"p":"$382.09","mc":"$430.9B USD","fpe":3.9,"tpe":18,"peg":null,"eveb":11.6,"evfcf":147.6,"dy":"0%","eg":"12%","eps":10.51,"bas":"Cyclical memory; forward PE at cycle peak; exit PE 20 reflects mid-cycle normalized earnings","br":"-35%","bs":"37%","bu":"96%","en":"fPERG","sc":1.38,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":143,"r1":-8.1,"n3":false,"ru":25,"rd":0,"su":35.7,"qcs":12.78,"cf":"cut","al":249,"am":524.73,"ah":750,"roe":"39.8%","fy":"~1%","nd":"Net cash","sh":0.41,"bc":"The AI bottleneck is shifting to High-Bandwidth Memory (HBM). The physics of HBM require vastly more wafer capacity, leading to a structural supply shortage, skyrocketing unit prices, and massive FCF generation.","brc":"DISQUALIFIED: Memory semis are hyper-cyclical commodities. The boom/bust cycle destroys long-term CAGR compounding, making it incompatible with a buy-and-hold momentum strategy. Traditional memory is a notoriously cyclical commodity. Requires strict monitoring of global memory supply dynamics to avoid the devastating downside of the hardware cycle.","cr":"DISQUALIFIED: Memory semis are hyper-cyclical commodities. The boom/bust cycle destroys long-term CAGR compounding, making it incompatible with a buy-and-hold momentum strategy."}
{"t":"NVDA","n":"NVIDIA","g":"AI & Semiconductors","cy":true,"p":"$178.68","mc":"$4342.8B USD","fpe":16.1,"tpe":36.5,"peg":1.6,"eveb":32.2,"evfcf":73.8,"dy":"0%","eg":"29%","eps":4.9,"bas":"Reflects near-term EPS acceleration while normalizing longer-term terminal valuation.","br":"-22%","bs":"50%","bu":"113%","en":"fPERG","sc":0.57,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":0.3,"r1":-3.4,"n3":true,"ru":26,"rd":4,"su":5.3,"dcf":232.25,"dd":30,"qcs":5.16,"cf":"high","al":140,"am":268.22,"ah":380,"roe":"101.5%","fy":"~1%","nd":"Net cash","sh":1.02,"bc":"NVIDIA is generating the highest quality earnings in semiconductor history but trades at a massive discount to peers (36x vs 80.7x). The upcoming Vera Rubin platform (H2 2026) promises a 5x inference improvement, implying a $40B upside to consensus. It is now a deeply entrenched value-compounder.","brc":"The trailing PEG ratio has expanded to 1.6x, indicating hyper-growth percentage gains are mathematically exhausting. If hyperscaler CapEx draws down, the cyclical shock will be violent.","cr":"Massive discount to peers (36x vs 80.7x avg). CAGR 22-28%. Vera Rubin platform implies $40B upside to consensus. Deeply entrenched value-compounder."}
{"t":"SMSN.IL","n":"Samsung Electronics","g":"AI & Semiconductors","cy":true,"p":"$2982","mc":"$810.2B USD","fpe":47.5,"tpe":30.9,"peg":1.3,"eveb":null,"dy":"2%","eg":"9%","eps":96.44,"bas":"GAAP diluted EPS","en":"tPERG","sc":3.44,"sg":"FAIL","nt":"Used benchmark CV (missing dispersion data) (CYCLICAL EPS)","sp":true,"r6":99.3,"r1":-18.1,"n3":false,"ru":0,"rd":0,"qcs":0,"cf":"medium","roe":"10.6%","fy":"~-1578%","nd":"Net cash","sh":-0.28,"bc":"Memory cycle upswing and HBM catch-up drive massive earnings leverage.","brc":"Intense competition in foundry and smartphone markets.","cr":"Global leader in memory but cyclical exposure."}
{"t":"SNPS","n":"Synopsys","g":"AI & Semiconductors","cy":false,"p":"$410.13","mc":"$78.6B USD","fpe":24,"tpe":62.9,"peg":null,"eveb":54,"evfcf":28.2,"dy":"0%","eg":"13%","eps":13.73,"bas":"Non-GAAP adjusted EPS (excl Ansys amortization & SBC); non-GAAP P/E basis","br":"4%","bs":"31%","bu":"58%","en":"fPERG","sc":1.8,"sg":"FAIL","sp":false,"r6":-15.9,"r1":-3.7,"n3":true,"ru":16,"rd":4,"su":6,"qcs":10.95,"cf":"low","al":425,"am":537.75,"ah":650,"roe":"5.5%","fy":"~4%","nd":"5.4x","sh":0.42,"bc":"An unbreakable EDA software duopoly. They are the ultimate toll road; whether a custom AI chip succeeds or fails, designers must pay for their software licenses.","brc":"The margin of safety is nonexistent. Post-Ansys acquisition debt burden of ~5.4x Net Debt/EBITDA adds financial risk on top of extreme valuation.","cr":"Forward P/E 75.8x with slowing growth. Part of EDA duopoly moat but valuation leaves no margin of safety. Post-Ansys debt at 5.4x."}
{"t":"TSM","n":"TSMC","g":"AI & Semiconductors","cy":true,"p":"$347.75","mc":"$1803.6B USD","fpe":19.4,"tpe":33.6,"eveb":null,"evfcf":11,"dy":"1%","eg":"18%","eps":10.38,"bas":"Non-GAAP EPS (Cycle adjusted)","br":"2%","bs":"25%","bu":"51%","en":"fPERG","sc":1.06,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":27.2,"r1":-7.7,"n3":false,"ru":1,"rd":0,"su":5.5,"dcf":155.35,"dd":-55,"qcs":5,"cf":"high","al":351,"am":430.65,"ah":520,"roe":"35.1%","fy":"~36%","nd":"Net cash","sh":0.59,"bc":"PEG of 0.57 indicates undervaluation relative to growth. The 2nm node ramp in 2026 carries a 10-20% price premium. CoWoS advanced packaging capacity expanding 66% by end of 2026. AI chip revenue guided at 60% CAGR through 2029. The competitive moat is widening as Intel and Samsung fall further behind.","brc":"Geopolitical risk (Taiwan Strait) is the elephant in the room. If hyperscaler AI CapEx slows, demand could crater. Heavy capital expenditure (~$40-50B annually) means FCF yield is compressed.","cr":"Foundry monopoly (~68% market share). Makes every AI chip for NVDA/AVGO/MRVL. PEG 0.57 suggests undervaluation. 2nm node ramp in 2026 with 10-20% price premium."}
```

---

## Instructions

Analyze each of the 15 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
