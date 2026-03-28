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

## Batch 2/10: Serial Acquirers & Industrials (17 stocks)

> **Batch-specific guidance**: Serial acquirers use M&A-driven growth where GAAP EPS is meaningless due to amortization. Pay attention to: (a) fEVG/fCFG vs fPERG engine assignment, (b) FCF-based vs PE-based valuation, (c) exit PE norms for compounders, (d) industrial cyclicality in aerospace/defense.

### Stock Data

```jsonl
{"t":"ADDT-B.ST","n":"Addtech AB","g":"Serial Acquirers","cy":false,"p":"303 SEK","mc":"81.9B SEK","fpe":38.7,"tpe":39.6,"peg":null,"eveb":24.4,"evfcf":35.1,"dy":"1%","eg":"17%","eps":7.66,"bas":"10yr avg PE","br":"10%","bs":"27%","bu":"34%","en":"fEVG","sc":1.41,"sg":"FAIL","sp":true,"r6":-2.1,"r1":-9.4,"n3":false,"ru":4,"rd":1,"su":-4.4,"qcs":-4,"cf":"medium","al":330,"am":380.83,"ah":402,"roe":"29.3%","fy":"~3%","nd":"1.3x","sh":0.6,"bc":"20%+ TSR CAGR since 2001. Uses only cash flow and debt for acquisitions — zero dilution. Decentralized model preserves entrepreneurial culture. Strong acquisition pipeline. Energy transition is a secular tailwind.","brc":"Premium valuation (~35x forward P/E) for a mid-single-digit organic grower. European macro headwinds could slow acquisition targets. Currency effects can drag reported growth.","cr":"Swedish serial acquirer with 18% EBITA CAGR since 2001. Zero dilution — uses only cash flow and debt. Better ROIC and growth profile than LIFCO-B.ST. Targets doubling earnings every 5 years."}
{"t":"AVAV","n":"AeroVironment, Inc.","g":"Industrial Monopolies","cy":false,"p":"$199.02","mc":"$10.1B USD","fpe":49.1,"eveb":67,"evfcf":-33.3,"dy":"0%","eg":"35%","eps":3.01,"bas":"Non-GAAP EPS","br":"18%","bs":"57%","bu":"126%","en":"fPERG","sc":1.57,"sg":"FAIL","sp":false,"r6":-33.9,"r1":-23.3,"n3":true,"ru":1,"rd":12,"su":-7.4,"qcs":-4.42,"cf":"medium","al":235,"am":311.47,"ah":450,"roe":"-8.7%","fy":"~-3%","nd":"1.6x","sh":0.96,"bc":"AeroVironment expands market share in drone defense as autonomous systems become critical to modern military strategy.","brc":"Defense spending cuts or increased competition in the UAS market could squeeze margins and slow revenue growth.","cr":"Leading manufacturer of unmanned aircraft systems (UAS) and tactical missile systems for defense. Strong backlog due to global defense spending super-cycle, but heavily reliant on US government contracts. EPS growth modeled to be auto-derived from analyst consensus."}
{"t":"CSU.TO","n":"Constellation Software","g":"Serial Acquirers","cy":false,"p":"C$2406.75","mc":"C$51.0B","fpe":13.1,"tpe":72.5,"peg":null,"eveb":21.8,"evfcf":20.6,"dy":"0%","eg":"18%","eps":33.21,"bas":"Price-to-FCF; historical avg PE 80-100x; exit PE represents de-rating from peak as growth normalizes","br":"44%","bs":"76%","bu":"133%","en":"fCFG","sc":1.11,"sg":"WAIT","sp":true,"r6":-34.2,"r1":-7.7,"n3":false,"ru":2,"rd":0,"su":-23.2,"qcs":-2,"cf":"high","al":3464.82,"am":4242.75,"ah":5607.42,"roe":"15.5%","fy":"~5%","nd":"1.1x","sh":2.15,"bc":"CSU is the apex predator of serial acquirers. The violent compression of its forward P/E to 18.40x and a 6.42% FCF yield proves its recent pivot to larger corporate carve-outs is generating massive cash flow, overwhelming GAAP amortization. It is a generational, low-risk compounder. The Sept 2025 resignation of Mark Leonard caused a short-term stock drop, creating a potential entry point for a company built specifically to function without centralized visionary control.","brc":"FX dynamics and broader market rotations have caused slight market cap contraction. If the centralized capital deployment engine falters on integrating larger acquisitions, the historical premium multiple could permanently compress. NOTE: Mark Leonard resigned as President in Sept 2025 due to health reasons (succeeded by Mark Miller). While he remains on the board and the decentralized model is built to outlast him, this introduces unprecedented leadership transition risk.","cr":"Sharpe (0.13), violent forward P/E compression to 18.4x, 6.42% FCF yield reclassifies as deep value. Generational compounder."}
{"t":"DHR","n":"Danaher Corporation","g":"Serial Acquirers","cy":true,"p":"$187.15","mc":"$132.3B USD","fpe":20.6,"tpe":37.2,"peg":null,"eveb":18.8,"evfcf":32.4,"dy":"1%","eg":"14%","eps":5.03,"bas":"GAAP diluted EPS; 10yr avg PE","br":"19%","bs":"43%","bu":"67%","en":"fEVG","sc":1.29,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":1.2,"r1":-10.6,"n3":true,"ru":1,"rd":2,"su":2,"qcs":5.2,"cf":"low","al":220,"am":264.91,"ah":310,"roe":"7.1%","fy":"~3%","nd":"1.9x","sh":1.2,"bc":"Danaher's life sciences tools and bioprocessing businesses (Cytiva) are recovering from the deepest post-COVID inventory destocking in decades. Abcam acquisition ($5.7B, 2023) adds genomic reagents and antibodies to the portfolio. When bioprocessing (bioreactors, filtration) volumes normalize, Danaher's ROIC should recover from trough levels toward 20%+.","brc":"Danaher's bioprocessing recovery has been slower than expected — large pharma customers are still burning through COVID-era inventory builds. The Abcam integration ($9.9B combined with premium paid) creates 3-5 years of amortization drag. If ROIC stays below WACC through 2026, the compounding thesis is impaired.","cr":"Historically elite compounder (450%+ total return over 10 years). Currently in a trough: ROIC depressed at ~6.8%, mid-single-digit growth. Integrating $9.9B Abcam acquisition. Could be a re-entry point for patient investors."}
{"t":"DPLM.L","n":"Diploma PLC","g":"Serial Acquirers","cy":false,"p":"£59.55","mc":"£8.0B","fpe":26.1,"tpe":43.2,"peg":null,"eveb":23.7,"evfcf":30.8,"dy":"1%","eg":"16%","eps":1.38,"bas":"10yr avg PE (pence basis)","br":"-13%","bs":"11%","bu":"27%","en":"fEVG","sc":1.46,"sg":"FAIL","sp":true,"r6":13,"r1":4.9,"n3":false,"ru":11,"rd":0,"qcs":3.67,"cf":"low","al":51.2,"am":65.73,"ah":75,"roe":"19.6%","fy":"~3%","nd":"1.1x","sh":0.08,"bc":"Solid UK-based compounder in technical products distribution. Less well-known than Halma but potentially better growth trajectory. 14% organic revenue growth is strong. Unanimous analyst consensus.","brc":"12-16% CAGR is borderline on the 14% floor. Less proven compounding track record than peers. Premium valuation at 30x forward P/E.","cr":"UK serial acquirer in technical products distribution. ROIC ~15%, ROE ~20%, 14% organic revenue growth in Q1 2026. Unanimous analyst Buy. But CAGR of 12-16% is borderline on the floor."}
{"t":"HEI.A","n":"HEICO Corp","g":"Serial Acquirers","cy":true,"p":"$213.05","mc":"$34.0B USD","fpe":49.4,"tpe":42.2,"peg":3.2,"eveb":25.7,"evfcf":47.1,"dy":"0%","eg":"16%","eps":5.05,"bas":"Continued M&A integration and PMA aftermarket penetration","en":"fEVG","sc":1.61,"sg":"FAIL","nt":"Used benchmark CV (missing dispersion data) (CYCLICAL EPS)","sp":false,"r6":-15.4,"r1":-10.4,"n3":true,"ru":0,"rd":0,"qcs":0,"cf":"high","roe":"16.6%","fy":"~2%","nd":"1.8x","sh":0.78,"bc":"HEICO is a compounding machine protected by the ultimate regulatory moat: FAA Parts Manufacturer Approval (PMA). They reverse-engineer aerospace parts to sell at a 30-50% discount to OEMs. With 50% market share in PMA but only ~2% penetration of the total aftermarket, the runway is massive. The Mendelson family provides legendary capital allocation and high insider ownership.","brc":"The stock is priced for absolute perfection. At ~55x forward P/E, any slowdown in global air traffic or commercial airline capacity could lead to severe multiple compression, even though their parts are non-discretionary. HEI.A (Class A) shares carry less voting power, though they trade at a discount to the common stock.","cr":"Dominates the PMA aerospace aftermarket. 27% EBITDA margins with ~20% annualized historical returns. Massive insider ownership by the Mendelson family."}
{"t":"HEI","n":"HEICO Corporation","g":"Serial Acquirers","cy":true,"p":"$279.09","mc":"$38.9B USD","fpe":44.1,"tpe":55.3,"peg":null,"eveb":33,"evfcf":60.4,"dy":"0%","eg":"18%","eps":5.05,"bas":"10yr avg PE","br":"1%","bs":"33%","bu":"49%","en":"fEVG","sc":1.8,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":false,"r6":-12.9,"r1":-10.8,"n3":true,"ru":11,"rd":4,"su":4.7,"qcs":9.87,"cf":"high","al":282,"am":371.5,"ah":417,"roe":"16.6%","fy":"~2%","nd":"1.8x","sh":0.68,"bc":"Aging airline fleet supercycle extends until at least 2028 — carriers must buy aftermarket parts as new aircraft deliveries are backlogged. Massive fragmented market offers decades of M&A runway. FAA certification requirements create near-monopolistic pricing power. Berkshire Hathaway endorsement.","brc":"Extremely expensive at ~71x trailing P/E. The earnings yield (~1.5%) barely exceeds the risk-free rate. Any aerospace downturn would cause severe multiple compression.","cr":"Aerospace serial acquirer with 30+ year compounding track record (16-19% CAGR since 1990). Berkshire Hathaway position. FAA certification moat. Less than 10% of fragmented market = decades of M&A runway."}
{"t":"HWM","n":"Howmet Aerospace","g":"Industrial Monopolies","cy":true,"p":"$241.62","mc":"$97.3B USD","fpe":43.9,"tpe":65,"eveb":41.6,"evfcf":108.3,"dy":"0%","eg":"15%","eps":3.72,"bas":"Non-GAAP EPS","br":"-11%","bs":"16%","bu":"30%","en":"fPERG","sc":2.84,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":25.1,"r1":-7.2,"n3":false,"ru":16,"rd":1,"su":8.7,"qcs":8.57,"cf":"high","al":214.92,"am":280,"ah":315,"roe":"30.4%","fy":"~1%","nd":"1.0x","sh":0.15,"bc":"Howmet Aerospace is the sole approved supplier for titanium fan blades and aluminum structural castings on every major western jetliner. This FAA certification barrier means Boeing and Airbus cannot multi-source critical airframe components. With aviation at record passenger levels and a 10-year production backlog, Howmet is compounding earnings at 15%+ with no margin ceiling.","brc":"Defense/commercial aerospace spending is a long-cycle business. Any Boeing production halt, supply chain disruption, or airline capacity rationalization has multi-year revenue implications. The 5.7x leverage from prior private equity era constrains financial flexibility.","cr":"Heavy IP moats in forged jet engine blades/fasteners. Aerospace super-cycle momentum."}
{"t":"KTOS","n":"Kratos Defense & Security Solutions, Inc.","g":"Industrial Monopolies","cy":false,"p":"$79.98","mc":"$14.9B USD","fpe":74.7,"tpe":615.2,"eveb":176.6,"evfcf":-104.1,"dy":"0%","eg":"35%","eps":0.13,"bas":"Non-GAAP EPS","br":"6%","bs":"47%","bu":"88%","en":"fPERG","sc":2.35,"sg":"FAIL","sp":true,"r6":-7.3,"r1":-13.2,"n3":false,"ru":9,"rd":6,"su":22.1,"qcs":10,"cf":"medium","al":85,"am":117.95,"ah":150,"roe":"1.3%","fy":"~-1%","nd":"Net cash","sh":0.64,"bc":"Kratos dominates the tactical drone market with Valkyrie, securing major long-term defense contracts.","brc":"Government budget constraints or delays in autonomous drone program adoption limit growth.","cr":"Provides defense, national security, and technology solutions. Primarily known for unmanned systems, satellite communications, and microwave electronics. Solid defense niche but heavily reliant on government contracts."}
{"t":"LIFCO-B.ST","n":"Lifco AB","g":"Serial Acquirers","cy":false,"p":"282 SEK","mc":"128.2B SEK","fpe":35.4,"tpe":35.3,"peg":null,"eveb":19.5,"evfcf":29.7,"dy":"1%","eg":"12%","eps":8,"bas":"10yr avg PE","br":"20%","bs":"27%","bu":"37%","en":"fEVG","sc":1.62,"sg":"REJECTED","nt":"Consensus actively collapsing (analyst lag)","sp":true,"r6":-11.5,"r1":-12.3,"n3":false,"ru":0,"rd":4,"su":-7.8,"qcs":-8.33,"cf":"low","al":335,"am":356,"ah":385,"roe":"19.5%","fy":"~4%","nd":"1.3x","sh":0.86,"bc":"Provides necessary industrial diversification (dental, demolition) with a stellar historical compounding track record, mitigating pure software concentration risk.","brc":"Priced for absolute macroeconomic perfection. Applying a 44.6x software-like multiple to cyclical physical industrials leaves a zero margin of safety. Any European construction slowdown will immediately compress this multiple.","cr":"Priced for perfection at 44.6x P/E on cyclical industrials. Zero margin of safety. European construction slowdown will compress multiple."}
{"t":"LMN.V","n":"Lumine Group","g":"Serial Acquirers","cy":false,"p":"C$22","mc":"C$5.6B","fpe":14.8,"tpe":34.9,"peg":null,"eveb":19.5,"evfcf":25.8,"dy":"0%","eg":"17%","eps":1.21,"bas":"non-IFRS FCFA2S per share; CAD; Price-to-FCF exit multiple","br":"77%","bs":"101%","bu":"159%","en":"fCFG","sc":1.44,"sg":"FAIL","sp":true,"r6":-44.3,"r1":-1.1,"n3":false,"ru":1,"rd":1,"su":57.8,"qcs":10,"cf":"medium","al":39,"am":44.25,"ah":57,"roe":"15.9%","fy":"~4%","nd":"Net cash","sh":2.32,"bc":"A flawless turnaround execution. Lumine acquired mismanaged telecom software assets at rock-bottom multiples and drove immediate cash flow accretion, swinging from a massive loss to a $118.8M profit.","brc":"Success breeds valuation risk. At 21.1x EV/EBITDA, the multiple has expanded, mathematically reducing future torque. The telecom end-market lacks the organic growth tailwinds of broader enterprise software.","cr":"Flawless turnaround ($118.8M profit from $258.9M loss), but multiple expansion to 21.1x EV/EBITDA reduces future torque. Telecom end-market lacks organic growth."}
{"t":"MTRN","n":"Materion","g":"Materials & Infrastructure","cy":false,"p":"$148.11","mc":"$3.1B USD","fpe":20.2,"tpe":41.4,"eveb":19.5,"evfcf":146.3,"dy":"0%","eg":"11%","eps":3.58,"bas":"GAAP diluted EPS","br":"15%","bs":"20%","bu":"25%","en":"fPERG","sc":1.79,"sg":"FAIL","sp":true,"r6":24,"r1":-8.2,"n3":false,"ru":1,"rd":0,"su":1.5,"qcs":5,"cf":"medium","al":170,"am":178.33,"ah":185,"roe":"8.3%","fy":"~1%","nd":"2.8x","sh":0.36,"bc":"Crucial supplier of high-performance alloys and beryllium for space, defense, and next-gen semiconductor applications, enjoying deep moats and pricing power.","brc":"Cyclical exposure to consumer electronics and industrial demand, plus execution risks associated with capacity expansions.","cr":"Niche advanced materials provider with strong exposure to aerospace, defense, and semiconductor end markets."}
{"t":"ROP","n":"Roper Technologies","g":"Serial Acquirers","cy":false,"p":"$346.72","mc":"$37.3B USD","fpe":14.9,"tpe":24.4,"peg":null,"eveb":14.3,"evfcf":21.2,"dy":"1%","eg":"12%","eps":14.22,"bas":"Serial acquirer of niche software; forward PE reflects recent acquisition dilution; exit PE 35 reflects historical 10yr avg for asset-light compounders","br":"6%","bs":"34%","bu":"60%","en":"fEVG","sc":1.15,"sg":"WAIT","sp":true,"r6":-30.6,"r1":-1.5,"n3":false,"ru":2,"rd":6,"su":1.4,"qcs":5.34,"cf":"high","al":365,"am":462.19,"ah":550,"roe":"7.9%","fy":"~6%","nd":"2.9x","sh":1.1,"bc":"Roper executes the exact Constellation Software M&A playbook but trades at a massive relative discount to both the software sector and its compounding peers. It provides highly predictable, low-leverage compounding torque as a stabilizing portfolio anchor.","brc":"Slower organic growth compared to hyper-growth SaaS peers. Relies heavily on continuous M&A execution to drive the bottom line.","cr":"Best Sharpe in portfolio (0.60). >20% discount to DCF fair value. CSU-style M&A playbook at massive relative discount. Stabilizing anchor."}
{"t":"TDG","n":"TransDigm Group","g":"Serial Acquirers","cy":true,"p":"$1156.49","mc":"$65.3B USD","fpe":25.2,"tpe":37.2,"peg":null,"eveb":20,"evfcf":70,"dy":"4%","eg":"18%","eps":31.07,"bas":"10yr avg PE; DY includes normalized special dividends","br":"18%","bs":"42%","bu":"68%","en":"fEVG","sc":1.08,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":false,"r6":-10.7,"r1":-12,"n3":true,"ru":8,"rd":9,"su":2.3,"qcs":-2.17,"cf":"high","al":1317,"am":1594,"ah":1900,"roe":null,"fy":"~2%","nd":"5.9x","sh":1.28,"bc":"45.6% operating margins are exceptional. ~$4.76B annualized EBITDA demonstrates strong cash generation.","brc":"Running a cyclical aerospace business with 5.7x leverage is an existential gamble. A liquidity shock will collapse the interest coverage ratio, forcing punitive equity dilution.","cr":"Existential leverage gamble: 5.7x Net Debt/EBITDA on cyclical aerospace. Liquidity shock forces punitive dilution. Sharpe 0.15."}
{"t":"TOI.V","n":"Topicus.com","g":"Serial Acquirers","cy":false,"p":"C$95.14","mc":"C$7.9B","fpe":21.4,"tpe":118.9,"peg":null,"eveb":26.5,"evfcf":19.1,"dy":"0%","eg":"25%","eps":1.69,"bas":"Price-to-FCF; Normalized FCF/FCFA2S; CSU spinoff serial acquirer with premium VMS-style multiple","br":"46%","bs":"51%","bu":"56%","en":"fCFG","sc":0.78,"sg":"PASS","nt":"Recent earnings miss","sp":true,"r6":-34.5,"r1":0.7,"n3":false,"ru":0,"rd":1,"su":-14.9,"qcs":1.67,"cf":"high","al":138.63,"am":143.21,"ah":148.61,"roe":"10.7%","fy":"~6%","nd":"1.4x","sh":1.16,"bc":"Topicus is executing the Constellation playbook flawlessly in Europe. Achieving 4% organic growth in a stagnant European macro environment proves absolute pricing power. Their recent €625M capital deployment signals a transition to massive, centralized compounding.","brc":"European macroeconomic stagnation and complex cross-border regulations could slow M&A velocity. The optical 247x P/E requires constant investor education to prevent panic sell-offs.","cr":"Strong Sharpe (0.46), executing CSU playbook flawlessly in Europe. 4% organic growth in stagnant macro proves pricing power. €625M deployed."}
{"t":"URI","n":"United Rentals","g":"Industrial Monopolies","cy":true,"p":"$747.59","mc":"$47.6B USD","fpe":14.1,"tpe":19.4,"eveb":14,"evfcf":32.3,"dy":"1%","eg":"9%","eps":38.58,"bas":"Non-GAAP EPS","br":"-19%","bs":"33%","bu":"108%","en":"fPERG","sc":1.63,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-21.1,"r1":-12.9,"n3":false,"ru":1,"rd":2,"su":-6.1,"qcs":-2.96,"cf":"high","al":600,"am":985.89,"ah":1550,"roe":"28.4%","fy":"~4%","nd":"3.4x","sh":1.03,"bc":"United Rentals has a structural advantage in the equipment rental market — the secular shift from ownership to rental is still early (rental penetration ~55% in North America vs 80%+ in mature markets). URI generates 20%+ ROIC and has a long runway of consolidation targets in the fragmented regional rental market. Infrastructure legislation provides multi-year volume floor.","brc":"Equipment rental is deeply cyclical — a construction recession cuts utilization rates sharply while fixed depreciation costs remain. The current softness in commercial construction and 15 analyst down-revisions in 30 days signal a potential cyclical peak. URI's leverage (2.5x net debt) amplifies earnings downside.","cr":"NA equipment rental leader. Massive scale, heavy operational momentum from infrastructure cycles."}
{"t":"VRT","n":"Vertiv Holdings","g":"Industrial Monopolies","cy":true,"p":"$276.16","mc":"$105.7B USD","fpe":34.5,"tpe":81.2,"peg":null,"eveb":48.5,"evfcf":74.9,"dy":"0%","eg":"30%","eps":6.01,"bas":"2026E adjusted EPS; AI infrastructure power and cooling multiple","br":"-44%","bs":"-3%","bu":"16%","en":"fPERG","sc":1.18,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":99.2,"r1":6.5,"n3":false,"ru":16,"rd":0,"su":4.9,"qcs":3.86,"cf":"low","al":155,"am":267.83,"ah":320,"roe":"41.8%","fy":"~1%","nd":"0.6x","sh":-0.3,"bc":"AI power/cooling infrastructure is essential and non-optional. 27-29% revenue growth with $15B backlog and orders up 252% YoY. ROIC of ~25% is solid for industrial. Market leader in mission-critical data center thermal management.","brc":"Trading at ~72x trailing earnings means priced for perfection. Any miss in execution could cause violent multiple compression. Cyclical industrial stock dressed up as a growth story.","cr":"AI data center power/cooling play. ROIC ~25%, revenue growing 27-29%, $15B backlog, orders up 252% YoY. But trading at ~72x trailing earnings means priced for perfection."}
```

---

## Instructions

Analyze each of the 17 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
