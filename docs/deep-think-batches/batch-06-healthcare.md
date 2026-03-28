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

## Batch 6/10: Healthcare (16 stocks)

> **Batch-specific guidance**: Healthcare spans monopolies, biotech pipeline plays, and services. Pay attention to: (a) patent cliff math (ABBV, VRTX), (b) single-asset concentration risk (EXEL, NBIX, HALO), (c) CRO cyclicality (ICLR, MEDP), (d) pre-revenue binary outcomes (RXRX should be DISQUALIFIED).

### Stock Data

```jsonl
{"t":"ABBV","n":"AbbVie Inc.","g":"Healthcare Monopolies","cy":false,"p":"$207.18","mc":"$366.3B USD","fpe":12.9,"tpe":87.8,"peg":1.06,"eveb":14.7,"evfcf":23.4,"dy":"3%","eg":"15%","eps":12.76,"bas":"Adjusted EPS (excl IPR&D); adj PE basis","br":"-8%","bs":"23%","bu":"47%","en":"fPERG","sc":0.84,"sg":"PASS","sp":true,"r6":-6.1,"r1":-7.8,"n3":true,"ru":4,"rd":4,"su":2.2,"dcf":163.17,"dd":-21,"qcs":3.41,"cf":"medium","al":184,"am":249.14,"ah":299,"roe":"6225.0%","fy":"~5%","nd":"2.2x","sh":0.56,"bc":"Skyrizi + Rinvoq are growing explosively, fully replacing Humira revenue. Clean patent cliff profile going forward. Deeply undervalued relative to growth pharma at 16x forward earnings. Massive FCF supports dividend + buybacks + pipeline investment.","brc":"$68.8B in debt from the Allergan acquisition. Pipeline failures could stall growth beyond current immunology franchise. Regulatory drug pricing risk in the US.","cr":"Successfully navigated Humira patent cliff via Skyrizi/Rinvoq. Forward P/E ~16x is cheap for growth pharma. PEG 1.06. $15.5B FCF. Borderline on CAGR floor (12-16%)."}
{"t":"ARGX","n":"argenx SE","g":"Biotech","cy":false,"p":"$697.05","mc":"$43.3B USD","fpe":21,"tpe":35.6,"peg":null,"eveb":36.6,"evfcf":75.8,"dy":"0%","eg":"33%","eps":19.59,"bas":"Reflects biotech terminal multiple compression and competitive encroachment risk.","br":"-1%","bs":"46%","bu":"75%","en":"fPERG","sc":0.71,"sg":"PASS","sp":true,"r6":-2,"r1":-9.7,"n3":false,"ru":2,"rd":11,"su":29.2,"qcs":2.08,"cf":"medium","al":692.96,"am":1016.83,"ah":1222.35,"roe":"20.2%","fy":"~1%","nd":"Net cash","sh":0.98,"bc":"Vyvgart is a platform drug expanding across 8+ autoimmune indications. gMG approval was just the start — CIDP, ITP, pemphigus, and lupus nephritis in pipeline. FcRn antagonism is a validated mechanism with multi-billion peak sales potential. Net cash provides runway.","brc":"Premium valuation (36x trailing) requires flawless execution. Recently profitable — margins still ramping. Clinical trial failures in any indication would reset expectations. Competition from other FcRn antagonists (Rystiggo).","cr":"Vyvgart is a blockbuster FcRn antagonist with multi-indication expansion. 35-40% revenue growth. But early profitability, high valuation, and clinical pipeline risk."}
{"t":"COR","n":"Cencora","g":"Healthcare Monopolies","cy":false,"p":"$325.08","mc":"$63.2B USD","fpe":16.6,"tpe":39.1,"eveb":14.4,"evfcf":20.7,"dy":"1%","eg":"15%","eps":8.32,"bas":"Non-GAAP EPS; ttmEPS reflects GAAP; non-GAAP EPS is significantly higher (~$18-20); CAGR model uses GAAP basis","br":"6%","bs":"26%","bu":"39%","en":"fPERG","sc":1.06,"sg":"WAIT","sp":true,"r6":5.9,"r1":-11.3,"n3":true,"ru":1,"rd":0,"su":1,"qcs":9.67,"cf":"high","al":340,"am":407.92,"ah":447,"roe":"133.5%","fy":"~5%","nd":"1.6x","sh":0.69,"bc":"Cencora (formerly AmerisourceBergen) has the strongest specialty pharma distribution franchise in the US through its World Courier, ASD Healthcare, and Lash Group subsidiaries. GLP-1 drug distribution volumes provide a new growth vector as obesity drug prescriptions compound. Systematic buybacks reduce float 5-7% annually, driving EPS well above revenue growth.","brc":"Like McKesson, Cencora operates on <1% net margins in a business where drug pricing policy is set by regulators and PBMs. If Medicare Part D restructuring compresses specialty drug reimbursement or GLP-1 list prices fall sharply, Cencora's revenue base shrinks. The business has minimal organic growth levers beyond M&A.","cr":"Consolidated oligopoly drug distributor with immense cash flow and repurchase programs."}
{"t":"EXEL","n":"Exelixis","g":"Biotech","cy":false,"p":"$42.78","mc":"$11.5B USD","fpe":10.9,"tpe":15.4,"peg":0.8,"eveb":11.1,"evfcf":16.2,"dy":"0%","eg":"21%","eps":2.78,"bas":"5yr & 10yr median PE","br":"-18%","bs":"9%","bu":"40%","en":"fPERG","sc":0.54,"sg":"FAIL","nt":"Cheap (0.54) but base return 9% misses the 15% hurdle","sp":true,"r6":9.6,"r1":-3.4,"n3":false,"ru":4,"rd":6,"su":16.2,"qcs":10.77,"cf":"low","al":35,"am":46.83,"ah":60,"roe":"35.5%","fy":"~6%","nd":"Net cash","sh":0.15,"bc":"Exelixis' Cabometyx has label expansions pending in front-line RCC combinations (with nivolumab) and additional tumor types. The pipeline assets XL092 (next-gen cabozantinib) and XB002 (ADC) represent the next growth phase. Massive cash balance ($2B+) with no debt funds buybacks and internal pipeline without equity dilution.","brc":"Severe single-asset reliance on Cabometyx. If pipeline assets fail, the growth narrative dies.","cr":"Deep value (PEG ~0.8, FCF yield ~7.5%) but severe single-asset Cabometyx reliance. Pipeline failure kills growth narrative entirely."}
{"t":"HALO","n":"Halozyme Therapeutics","g":"Healthcare Technology","cy":false,"p":"$63.24","mc":"$7.5B USD","fpe":6.4,"tpe":24.7,"peg":null,"eveb":10.6,"evfcf":51.4,"dy":"0%","eg":"20%","eps":2.56,"bas":"Accounts for 2034 patent cliff and GAAP earnings volatility; terminal multiple compressed.","br":"-11%","bs":"34%","bu":"52%","en":"fPERG","sc":0.31,"sg":"PASS","nt":"Recent earnings miss","sp":false,"r6":-14.3,"r1":-8.6,"n3":true,"ru":2,"rd":1,"su":-110.9,"qcs":0,"cf":"medium","al":56,"am":84.5,"ah":96,"roe":"153.6%","fy":"~2%","nd":"2.3x","sh":0.36,"bc":"Halozyme's ENHANZE drug delivery technology is licensed to 13+ pharmaceutical partners including Roche, Pfizer, Janssen, and AstraZeneca. Each partner pays upfront milestones, annual fees, and royalties on sales of ENHANZE-enabled subcutaneous formulations (e.g., DARZALEX SC, Phesgo). The royalty stack grows as more ENHANZE-based drugs reach commercial scale — a royalty-on-royalties compounding model.","brc":"Halozyme's ENHANZE patent expiry (2034-2036) creates a finite royalty runway. Partners could develop competing subcutaneous delivery technology or not submit additional drugs to ENHANZE licensing. A large one-time GAAP charge distorted recent earnings (Q4 2025 -110.9% surprise) — transparency on one-time items is important for monitoring underlying earnings quality.","cr":"Asset-light royalty model via ENHANZE drug delivery platform. 20% EPS growth with 70%+ gross margins. But royalty concentration risk and patent cliffs."}
{"t":"ICLR","n":"ICON plc","g":"Healthcare Services","cy":true,"p":"$99.99","mc":"$7.8B USD","fpe":8,"tpe":13.5,"eveb":7.1,"evfcf":11.6,"dy":"0%","eg":"14%","eps":7.42,"bas":"Adjusted for cyclical recovery in CRO demand following funding troughs.","br":"-25%","bs":"39%","bu":"120%","en":"fPERG","sc":1.06,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":-39,"r1":-5.8,"n3":false,"ru":1,"rd":7,"su":1,"qcs":-0.48,"cf":"low","al":75,"am":138.64,"ah":220,"roe":"6.3%","fy":"~12%","nd":"2.0x","sh":0.58,"bc":"ICON is the world's second-largest CRO with deep therapeutic expertise in oncology and rare disease. After a severe biotech funding correction drove a -44% selloff, the stock trades at 8x forward PE — an extreme valuation compression. When biotech funding recovers, ICON benefits from pent-up demand for Phase II-III outsourcing. FSP (Functional Service Provider) model provides flexible capacity to large pharma clients.","brc":"NIH budget cuts under DOGE are directly reducing academic research contracts. The biotech funding freeze of 2022-2025 caused trial cancellations that are still clearing backlogs. ICON faces pricing pressure from IQVIA and Syneos competing for large pharma FSP contracts. High fixed costs from headcount make it operationally leveraged in both directions.","cr":"Massive CRO running trials for big pharma. Consistent 12-16% EPS growth, often very reasonably priced."}
{"t":"LLY","n":"Eli Lilly","g":"Healthcare Monopolies","cy":false,"p":"$916.31","mc":"$820.1B USD","fpe":21.8,"tpe":40,"eveb":27,"evfcf":438.4,"dy":"1%","eg":"24%","eps":22.91,"bas":"Maturing mega-cap pharma multiple post-GLP-1 hypergrowth phase","br":"-6%","bs":"33%","bu":"65%","en":"fPERG","sc":0.89,"sg":"PASS","sp":true,"r6":26.5,"r1":-10.3,"n3":true,"ru":5,"rd":1,"su":9.1,"qcs":6.96,"cf":"high","al":850,"am":1209.34,"ah":1500,"roe":"101.2%","fy":"~0%","nd":"1.2x","sh":0.6,"bc":"Mounjaro and Zepbound provide a massive, multi-year runway for revenue growth with operating margins holding near 46-47%.","brc":"Priced for perfection; any clinical setbacks, pricing pressure, or new competitors in the GLP-1 space could contract multiples.","cr":"Duopoly in GLP-1 weight-loss market with ~24% expected EPS growth."}
{"t":"MEDP","n":"Medpace","g":"Healthcare Services","cy":true,"p":"$466.80","mc":"$13.2B USD","fpe":24.4,"tpe":30.6,"eveb":22.9,"evfcf":27.3,"dy":"0%","eg":"12%","eps":15.26,"bas":"Non-GAAP EPS","br":"-30%","bs":"5%","bu":"25%","en":"fPERG","sc":1.97,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-6,"r1":4.4,"n3":false,"ru":7,"rd":0,"su":10.5,"qcs":9.44,"cf":"high","al":329,"am":489.69,"ah":582,"roe":"70.2%","fy":"~4%","nd":"Net cash","sh":-0.12,"bc":"Medpace's focused CRO model (only biotech/specialty pharma clients) enables superior therapeutic expertise. When biotech funding recovers, Medpace benefits from its reputation as the premium small-biotech CRO. Clean balance sheet with significant cash enables opportunistic buybacks. Historically delivered industry-leading EBITDA margins (~30%).","brc":"CRO revenues are directly tied to biotech clinical trial activity — when funding freezes (2022-2025), cancellations and deferrals cascade through revenue pipelines 6-12 months later. NIH budget cuts under DOGE are removing a key source of academic grants that feed into Phase II commercial trials. IQVIA and ICON are competing aggressively for Medpace's specialty clients.","cr":"Leading CRO for small-mid biotech companies with differentiated full-service model. Biotech funding headwinds have compressed near-term growth expectations from 20%+ to ~12%. At 24x forward PE, the stock is pricing in a sustained recovery — which is not guaranteed given NIH budget pressures."}
{"t":"NBIX","n":"Neurocrine Biosciences","g":"Biotech","cy":false,"p":"$131.13","mc":"$13.2B USD","fpe":13.5,"tpe":28.1,"peg":null,"eveb":18.2,"evfcf":30.5,"dy":"0%","eg":"14%","eps":4.67,"bas":"GAAP EPS; specialty pharma peers trade 18-30x; base reflects pipeline optionality","br":"7%","bs":"36%","bu":"66%","en":"fPERG","sc":1.05,"sg":"WAIT","sp":true,"r6":-7.7,"r1":0.4,"n3":false,"ru":1,"rd":4,"su":-18.1,"qcs":-2.96,"cf":"medium","al":140,"am":178.04,"ah":217.15,"roe":"16.4%","fy":"~3%","nd":"Net cash","sh":0.94,"bc":"Ingrezza is the gold standard for tardive dyskinesia with $2.5B+ peak sales potential. Deep neuropsych pipeline (crinecerfont for CAH, muscarinic agonists for schizophrenia). Net cash balance sheet. 15-20% EPS growth through 2028+.","brc":"Ingrezza is ~90% of revenue — extreme concentration risk. Generic competition could emerge. Pipeline clinical trial risk. Neuropsych drug development has high failure rates.","cr":"Dominant franchise in tardive dyskinesia (Ingrezza). 15-20% EPS growth. Strong pipeline in neuropsychiatry. But single-product concentration risk."}
{"t":"NVO","n":"Novo Nordisk","g":"Large-Cap Pharma","cy":false,"p":"$36.33","mc":"$162.5B USD","fpe":10.7,"tpe":10.1,"eveb":null,"evfcf":704.3,"dy":"5%","eg":"13%","eps":3.58,"bas":"Non-GAAP EPS; reflects maturing GLP-1 market share and pipeline resilience","br":"15%","bs":"34%","bu":"80%","en":"totalReturn","sc":0.67,"sg":"REJECTED","nt":"Consensus actively collapsing (analyst lag)","sp":false,"r6":-34.7,"r1":-3.4,"n3":true,"ru":0,"rd":5,"su":2.3,"qcs":2.9,"cf":"high","al":39.91,"am":46.98,"ah":63.69,"roe":"60.7%","fy":"~0%","nd":"0.7x","sh":0.77,"bc":"Novo Nordisk retains the world's most powerful GLP-1 commercial infrastructure — Ozempic and Wegovy have 70%+ market share in established markets. Oral semaglutide (Rybelsus and oral once-weekly formulations) open a new 10x larger addressable market. Manufacturing capacity expansion through 2027 will restore supply constraints. The CagriSema combination, despite a Phase 3 miss vs. expectations, still showed 22.7% weight loss — superior to any non-GLP-1 obesity drug.","brc":"Increasing competition from Eli Lilly's Zepbound and emerging oral challengers. Potential for Medicare pricing negotiations and political pressure on obesity drug pricing in the US.","cr":"Leading GLP-1 manufacturer with Ozempic/Wegovy infrastructure advantage, though LLY is now a genuine competitor. Thesis rests on manufacturing scale, oral semaglutide, and CagriSema combination pipeline."}
{"t":"REGN","n":"Regeneron Pharmaceuticals","g":"Healthcare Monopolies","cy":false,"p":"$749.47","mc":"$79.2B USD","fpe":14.2,"tpe":18.1,"peg":null,"eveb":16.8,"evfcf":21.9,"dy":"1%","eg":"12%","eps":41.45,"bas":"GAAP EPS; exit PE calibrated to 5yr average trading range","br":"-2%","bs":"18%","bu":"42%","en":"fPERG","sc":1.21,"sg":"FAIL","sp":true,"r6":32.9,"r1":-2.8,"n3":true,"ru":3,"rd":2,"su":6.4,"qcs":9.44,"cf":"medium","al":730,"am":873.78,"ah":1057,"roe":"14.9%","fy":"~4%","nd":"Net cash","sh":0.38,"bc":"Dupixent sales surging 32% with multiple label expansions pending. EYLEA HD gaining market share rapidly. At least 4 expected FDA approvals in the next year. Ultra-low beta (0.40) provides portfolio ballast. Aggressive share buybacks enhance EPS.","brc":"If Eylea biosimilar competition intensifies beyond expectations, the cash cow suffers. Drug pricing regulation in the US remains a perennial risk. Post-Dupixent growth story is unclear.","cr":"Monopolistic drug franchises (Dupixent, EYLEA HD) with one of the best R&D engines in pharma. 5-year avg ROIC of 28%. Forward P/E ~17x with 0.40 beta provides defensive ballast."}
{"t":"RXRX","n":"Recursion Pharmaceuticals","g":"Disqualified","cy":false,"p":"$3.17","mc":"$1.7B USD","fpe":-3.7,"tpe":null,"peg":null,"eveb":null,"evfcf":-4.8,"dy":"0%","eg":"0%","bas":"Estimated compounder baseline","br":"-5%","bs":"112%","bu":"247%","en":"totalReturn","sg":"NO_DATA","nt":"Missing/negative forward PE and no trailing EPS fallback","qcs":11.39,"cf":"cut","al":3,"am":6.71,"ah":11,"roe":"-59.5%","fy":"~-12%","nd":"Net cash","sh":1.42,"bc":"A massive + venture cash infusion provides the runway necessary to execute their ambitious AI-driven drug discovery pipeline. If their Phase 2 clinical trials succeed, they possess the structural monopoly of a foundational AI dataset that traditional pharma companies cannot easily replicate.","brc":"DISQUALIFIED: Pre-revenue, binary-outcome biotech. Pricing relies on venture-style clinical trial probabilities, completely breaking the EPS compounding model. A capital incinerator. The business model is mathematically unsustainable without continuous dilution ($368.57M in recent filings). If Phase 2 trials fail, intrinsic equity value approaches zero.","cr":"DISQUALIFIED: Pre-revenue, binary-outcome biotech. Pricing relies on venture-style clinical trial probabilities, completely breaking the EPS compounding model."}
{"t":"VEEV","n":"Veeva Systems","g":"Healthcare Monopolies","cy":false,"p":"$178.11","mc":"$29.3B USD","fpe":18,"tpe":32.8,"peg":null,"eveb":23,"evfcf":21.6,"dy":"0%","eg":"19%","eps":5.43,"bas":"Normalized vertical SaaS multiple; accounts for CRM saturation and platform migration risk.","br":"7%","bs":"52%","bu":"97%","en":"fPERG","sc":0.92,"sg":"PASS","sp":true,"r6":-38.6,"r1":-2.6,"n3":false,"ru":17,"rd":4,"su":6.5,"qcs":9,"cf":"medium","al":190,"am":270.93,"ah":350,"roe":"13.9%","fy":"~4%","nd":"Net cash","sh":1.32,"bc":"The dominant cloud software provider for life sciences. 16% top-line growth at a $3.2B scale proves the industry is highly resistant to macro spending cuts. Strict FDA compliance needs make Veeva virtually irremovable.","brc":"Growth is decelerating as they saturate their core commercial CRM market, and platform migration introduces execution risk.","cr":"Dominant life sciences cloud at 16% growth on $3.2B scale. >99% retention. But core CRM saturation and platform migration risk."}
{"t":"VRTX","n":"Vertex Pharmaceuticals","g":"Healthcare Monopolies","cy":false,"p":"$454.97","mc":"$115.6B USD","fpe":20.7,"tpe":29.7,"peg":null,"eveb":22.8,"evfcf":43.1,"dy":"0%","eg":"13%","eps":15.33,"bas":"GAAP diluted EPS; 5yr avg GAAP PE (2024 distorted by Alpine acquisition charges)","br":"-27%","bs":"20%","bu":"41%","en":"fPERG","sc":1.59,"sg":"FAIL","sp":true,"r6":17.9,"r1":-5.2,"n3":false,"ru":7,"rd":2,"su":-2.3,"qcs":0.24,"cf":"medium","al":330,"am":547.72,"ah":641,"roe":"22.5%","fy":"~2%","nd":"Net cash","sh":0.07,"bc":"An absolute global monopoly in Cystic Fibrosis. Vertex is transitioning into a mature cash-flowing conglomerate, using CF revenues to fund >$0.5B in non-CF product revenue (pain management, sickle cell) in 2026 without diluting shareholders.","brc":"Top-line growth is visibly decelerating. Any unexpected safety issue or novel competitive breakthrough in the core CF franchise would be catastrophic.","cr":"Global CF monopoly funding non-CF pipeline without dilution. But top-line decelerating. 2026 guidance $12.95-13.1B (8.5-9% growth) shows maturing profile."}
{"t":"WST","n":"West Pharmaceutical","g":"Healthcare Monopolies","cy":false,"p":"$247.02","mc":"$17.8B USD","fpe":27.9,"tpe":36.4,"eveb":21.4,"evfcf":63.3,"dy":"0%","eg":"16%","eps":6.79,"bas":"Non-GAAP EPS","br":"7%","bs":"29%","bu":"52%","en":"fPERG","sc":1.69,"sg":"FAIL","sp":true,"r6":-5.5,"r1":-0.8,"n3":false,"ru":7,"rd":4,"su":11.5,"qcs":8.75,"cf":"high","al":265,"am":318.36,"ah":375,"roe":"16.9%","fy":"~2%","nd":"Net cash","sh":0.63,"bc":"West Pharmaceutical is the near-monopoly supplier of drug containment components (stoppers, seals, closures) for injectable pharmaceuticals. Every pre-filled syringe and vial of injectable drug uses West components — this embedded position provides pricing power and secular volume growth from biologics and GLP-1 manufacturing ramp.","brc":"The pandemic-era demand surge (COVID vaccines required 2x normal closure volume) created a massive revenue pull-forward. The post-COVID inventory destocking cycle has been severe, with volumes declining 15-20% from peak. Recovery timeline remains uncertain.","cr":"Near-monopoly on specialized rubber stoppers/seals for injectables (GLP-1s). High-margin, high-moat."}
{"t":"ZTS","n":"Zoetis","g":"Healthcare Monopolies","cy":false,"p":"$116.71","mc":"$51.4B USD","fpe":15.5,"tpe":19.4,"eveb":13.8,"evfcf":31.4,"dy":"2%","eg":"14%","eps":6.02,"bas":"Non-GAAP EPS","br":"13%","bs":"31%","bu":"65%","en":"fPERG","sc":1.07,"sg":"WAIT","sp":false,"r6":-18.7,"r1":-10.1,"n3":true,"ru":3,"rd":3,"su":5.5,"qcs":9.67,"cf":"high","al":130,"am":151,"ah":190,"roe":"66.0%","fy":"~3%","nd":"1.7x","sh":1.19,"bc":"Zoetis is the global leader in animal health medicines and vaccines — a $70B market growing 6-7% annually with no generic substitution risk in veterinary biologics. Librela (monoclonal antibody for osteoarthritis pain in dogs) is the fastest-growing product launch in animal health history. The pet humanization trend drives premiumization of veterinary care globally.","brc":"Zoetis has de-rated from 35-40x to 16x forward PE as growth slowed from 15% to 12-14% EPS. Competition in the monoclonal antibody space (Elanco's Credelio, others) could pressure Librela margins. Livestock segment is directly exposed to agricultural commodity cycles and is structurally less attractive than companion animal.","cr":"Global monopoly in animal health/vaccines. No insurance price caps equals incredible pricing power."}
```

---

## Instructions

Analyze each of the 16 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
