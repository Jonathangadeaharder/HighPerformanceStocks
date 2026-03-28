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

## Batch 7/10: Energy, Royalties & Infrastructure (14 stocks)

> **Batch-specific guidance**: Royalties and energy infrastructure need domain-specific valuation. Pay attention to: (a) totalReturn engine for MLPs/royalties, (b) Price-to-CFO exit multiples for streamers, (c) commodity cyclicality vs structural demand, (d) royalties are held for structural uncorrelated convexity, not just CAGR.

### Stock Data

```jsonl
{"t":"CCJ","n":"Cameco","g":"Energy & Infrastructure","cy":true,"p":"$109.02","mc":"$47.5B USD","fpe":58.5,"tpe":111.2,"eveb":51.9,"evfcf":98.5,"dy":"0%","eg":"15%","eps":0.98,"bas":"GAAP diluted EPS","br":"-25%","bs":"14%","bu":"45%","en":"fPERG","sc":3.96,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":27.4,"r1":-7.8,"n3":false,"ru":2,"rd":5,"su":12.9,"qcs":-4.28,"cf":"high","al":81.52,"am":124.18,"ah":158.08,"roe":"8.9%","fy":"~1%","nd":"Net cash","sh":0.1,"bc":"Global nuclear renaissance and supply deficits drive structural bull market in uranium.","brc":"Uranium price volatility and execution risks in mining operations.","cr":"Tier-1 uranium assets and strong long-term contracts."}
{"t":"EPD","n":"Enterprise Products Partners","g":"Energy","cy":false,"p":"$39","mc":"$84.3B USD","fpe":12.6,"tpe":13.8,"peg":null,"eveb":12.4,"evfcf":5352.7,"dy":"6%","eg":"6%","eps":2.66,"bas":"Distributable Cash Flow per unit","br":"-12%","bs":"4%","bu":"21%","en":"totalReturn","sc":1,"sg":"PASS","sp":true,"r6":23.3,"r1":8.4,"n3":false,"ru":2,"rd":0,"su":8.5,"qcs":1.17,"cf":"medium","al":32,"am":38.24,"ah":45,"roe":"19.5%","fy":"~0%","nd":"3.5x","sh":0,"bc":"Enterprise Products Partners is one of the most financially disciplined MLPs in North America, with a 1.7x+ distribution coverage ratio, AA-/Baa1 credit rating, and a 22-year track record of consecutive distribution increases. The ~7% yield alone provides equity-like total returns, and organic growth from new natural gas infrastructure projects adds upside.","brc":"Midstream infrastructure is a terminal-value business as the energy transition progresses. Volume risk increases if US LNG export permitting slows or if industrial natural gas demand peaks. The 4.0x+ leverage is manageable but constrains financial flexibility.","cr":"Best-in-class midstream MLP. Conservative management, 25 consecutive years of distribution growth. Lower volatility but also lower upside."}
{"t":"ET","n":"Energy Transfer","g":"Energy","cy":true,"p":"$19.14","mc":"$65.8B USD","fpe":11,"tpe":12.6,"peg":null,"eveb":10.2,"evfcf":69.2,"dy":"7%","eg":"10%","eps":1.21,"bas":"Distributable Cash Flow per unit","br":"4%","bs":"22%","bu":"38%","en":"totalReturn","sc":0.71,"sg":"PASS","nt":"(CYCLICAL EPS) (Recent earnings miss)","sp":true,"r6":9.6,"r1":2.4,"n3":false,"ru":3,"rd":2,"su":-30.4,"dcf":62.06,"dd":224,"qcs":-4.09,"cf":"medium","al":18.5,"am":22.02,"ah":25,"roe":"11.9%","fy":"~3%","nd":"4.6x","sh":0.69,"bc":"Energy Transfer has the most diversified midstream footprint in the US, with exposure to crude, natural gas, NGLs, and LNG exports. The $0.32/unit quarterly distribution yields 7-8% and is covered 1.9x. Permian Basin volume growth provides organic throughput growth without new capital commitments.","brc":"At 4.6x Net Debt/EBITDA, ET has the highest leverage among major midstream peers. A deterioration in credit markets, distribution cut risk, or volume decline from customer bankruptcies could trigger significant unit price declines.","cr":"Largest US midstream pipeline network. 7%+ distribution yield with 10%+ EPS growth. Low valuation but high leverage and MLP complexity."}
{"t":"FNV","n":"Franco-Nevada","g":"Royalties","cy":true,"p":"$233.67","mc":"$45.1B USD","fpe":23.6,"tpe":40.5,"peg":5,"eveb":26.9,"evfcf":-41.6,"dy":"1%","eg":"12%","eps":6.8,"bas":"Operating CFO per share; Price-to-CF exit multiple","br":"16%","bs":"32%","bu":"53%","en":"fCFG","sg":"NO_DATA","nt":"Missing/negative EV/FCF","qcs":7.11,"cf":"low","al":269,"am":305.9,"ah":356.09,"roe":"16.3%","fy":"~-2%","nd":"Net cash","sh":0.81,"bc":"Franco-Nevada has the strongest balance sheet in the royalty/streaming space -- zero debt and $280M cash -- giving it unmatched optionality for acquisitions. Revenue is expected to surge 59% to $1.75B as Cobre Panama potentially normalizes. The company just raised its dividend 16% (19th consecutive annual increase). At a forward P/E of ~32x with net cash, FNV is the premium defensive compounder in the gold space.","brc":"At a trailing P/E of ~49x, FNV is pricing in a perfect scenario. The PEG ratio of 5.0x is extremely elevated. Cobre Panama (historically ~15-20% of revenue) remains uncertain, and a permanent impairment would remove a key growth driver. The stock has rallied 99% in 52 weeks, making it vulnerable to profit-taking on any gold pullback. Levered free cash flow was negative (-$1.16B TTM) due to large streaming prepayments.","cr":"Model suggests low CAGR, but Royalties are held for structural uncorrelated convexity, not just organic compounding."}
{"t":"KAP.IL","n":"Kazatomprom","g":"Energy & Infrastructure","cy":true,"p":"$80.20","mc":"$20.8B USD","fpe":0,"tpe":13,"peg":0.74,"eveb":0.3,"dy":"0%","eg":"8%","eps":6.16,"bas":"Reflects structural commodity cyclicality and production constraints.","en":"totalReturn","sc":1.5,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":53.6,"r1":-2.2,"n3":false,"ru":0,"rd":0,"qcs":0,"cf":"medium","roe":"43.3%","fy":"~1881%","nd":"Net cash","sh":0.06,"bc":"Lowest cost producer benefiting from structural uranium deficits.","brc":"Geopolitical risks and potential export route disruptions.","cr":"World's largest uranium producer but carries geopolitical risk."}
{"t":"LEU","n":"Centrus Energy Corp.","g":"Energy & Infrastructure","cy":true,"p":"$193.26","mc":"$3.8B USD","fpe":36.5,"tpe":49.6,"eveb":57.4,"evfcf":80.4,"dy":"0%","eg":"35%","eps":3.9,"bas":"GAAP diluted EPS; lumpy contract revenue; cyclical earnings pattern","br":"-29%","bs":"45%","bu":"102%","en":"fPERG","sc":1.27,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-36.7,"r1":-8.4,"n3":false,"ru":0,"rd":1,"su":-51.4,"qcs":4.17,"cf":"medium","al":137,"am":279.58,"ah":390,"roe":"16.8%","fy":"~1%","nd":"Net cash","sh":0.34,"bc":"Only US-licensed uranium enrichment facility — irreplaceable national security infrastructure. HALEU production is essential for next-gen advanced reactors (Oklo, TerraPower, etc.) with no domestic alternative. DOE contracts provide long-term revenue visibility. Nuclear renaissance accelerating globally as clean baseload demand surges. $1.96B cash fortress with net cash position. 12 analysts see 23%+ upside to $238 consensus target.","brc":"Earnings are wildly lumpy — recent quarters saw both +1,468% beats and -51% misses depending on contract timing. Forward P/E of ~67x is hard to justify even with monopoly pricing. Highly dependent on government funding and single-facility execution risk. 23.6% short interest signals significant skepticism. Revenue growth is ~3-4% annually with lumpiness making any P/E-based valuation extremely uncertain.","cr":"Only US-licensed uranium enrichment company with strategic HALEU monopoly. Forward P/E ~67x is extremely expensive for lumpy contract revenue. Earnings are highly volatile quarter-to-quarter. Strong nuclear renaissance thesis but DOE-contract dependent. EPS growth to be auto-derived from analyst consensus."}
{"t":"LNG","n":"Cheniere Energy","g":"Energy","cy":true,"p":"$284.39","mc":"$61.2B USD","fpe":17,"tpe":11.8,"peg":null,"eveb":8.6,"evfcf":34.1,"dy":"1%","eg":"4%","eps":24.12,"bas":"GAAP EPS at cyclical peak; low growth reflects mean-reversion in LNG supply","br":"-17%","bs":"2%","bu":"19%","en":"totalReturn","sc":3.43,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":19.3,"r1":22.3,"n3":false,"ru":2,"rd":1,"su":-33,"qcs":-1.5,"cf":"medium","al":232,"am":286.64,"ah":336,"roe":"58.7%","fy":"~4%","nd":"2.4x","sh":-0.12,"bc":"Largest US LNG exporter with 20-year take-or-pay contracts providing revenue visibility. Global LNG demand growing 3-4% annually. Sabine Pass and Corpus Christi expansions add capacity through 2030. Massive FCF funds buybacks and debt reduction.","brc":"High leverage (3.5x net debt/EBITDA). Commodity-linked earnings despite contracts. LNG oversupply risk from Qatar/Australia expansions. Capex-heavy expansion cycle. Energy transition could reduce long-term gas demand.","cr":"Dominant US LNG exporter with long-term take-or-pay contracts. ~$17.90 TTM EPS with 8-12% growth. Strong FCF generation but commodity-linked earnings volatility."}
{"t":"PSK.TO","n":"PrairieSky Royalty","g":"Energy & Infrastructure","cy":false,"p":"C$32.43","mc":"C$7.5B","fpe":34.9,"tpe":37.3,"dy":"3%","eg":"10%","eps":0.87,"bas":"Non-GAAP EPS","br":"-11%","bs":"4%","bu":"11%","en":"fPERG","sc":3.36,"sg":"FAIL","sp":true,"r6":22.3,"r1":5.4,"n3":false,"ru":0,"rd":0,"su":52.9,"qcs":3.33,"cf":"high","al":28,"am":32.68,"ah":35,"roe":"7.8%","fy":"~3%","sh":-0.18,"bc":"PrairieSky is Canada's premier royalty company with zero operating cost, zero capital requirement, and net cash position. As a royalty, it benefits from every well drilled on its land without sharing development costs. A royalty land base covering 19 million acres in the Western Canada Sedimentary Basin is a multigenerational asset.","brc":"Almost entirely exposed to Western Canada commodity prices and Montney/Duvernay drilling activity. A 20%+ decline in oil or gas prices would directly reduce royalty revenue with no operational lever to offset. The company is small enough that any governance concern or insider selling creates outsized price volatility.","cr":"Canadian equivalent of TPL. Fee-simple land royalties. Zero capex, pure FCF."}
{"t":"RGLD","n":"Royal Gold","g":"Royalties","cy":true,"p":"$232.99","mc":"$19.8B USD","fpe":15.4,"tpe":34.8,"peg":1.69,"eveb":29.3,"evfcf":-25502.1,"dy":"1%","eg":"12%","eps":8.35,"bas":"Operating CFO per share; Price-to-CF exit multiple","br":"13%","bs":"42%","bu":"62%","en":"fCFG","sg":"NO_DATA","nt":"Missing/negative EV/FCF","qcs":4.01,"cf":"low","al":260,"am":329.64,"ah":375,"roe":"11.0%","fy":"~0%","nd":"Net cash","sh":0.85,"bc":"Royal Gold completed a transformational year with the Sandstorm Gold acquisition, record revenue ($645M TTM), and adjusted EBITDA margins of 82%. The combined portfolio now offers superior diversification with over 30 producing assets globally. At a forward P/E of ~19x with 80%+ margins, RGLD trades at a discount to WPM and FNV. Management has a clear path to repay acquisition debt by mid-2027.","brc":"Net debt of ~$1.2B and a net debt/EBITDA ratio of ~1.6x is elevated for a royalty company. The trailing P/E of ~42x reflects rich pricing. Q4 2025 EPS of $1.92 missed consensus of $2.68 significantly, raising execution concerns. If gold prices revert toward $2,000/oz, cash flows compress sharply and acquisition leverage becomes a headwind.","cr":"Model suggests low CAGR, but Royalties are held for structural uncorrelated convexity, not just organic compounding."}
{"t":"TFPM","n":"Triple Flag Precious Metals","g":"Royalties","cy":true,"p":"$32.47","mc":"$6.7B USD","fpe":19.7,"tpe":27.5,"peg":1.02,"eveb":22.4,"evfcf":-1584.8,"dy":"1%","eg":"8%","eps":1.54,"bas":"Operating CFO per share; Price-to-CF exit multiple","br":"33%","bs":"40%","bu":"52%","en":"totalReturn","sc":1.33,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":13.4,"r1":-19.6,"n3":false,"ru":3,"rd":3,"su":4.1,"qcs":8.03,"cf":"low","al":43,"am":45,"ah":49,"roe":"12.7%","fy":"~0%","nd":"Net cash","sh":0.88,"bc":"Triple Flag is the most attractively valued precious metals streamer, trading at a trailing P/E of ~32x versus 42-74x for peers. The PEG ratio of ~1.0 suggests fair value relative to growth. The company has zero net debt, 61.7% net margins, and a clear production growth path to 140-150K GEOs by 2030. At $8B market cap, TFPM is a potential acquisition target. The negative beta (-0.21) provides excellent portfolio diversification.","brc":"TFPM is the smallest and least liquid of the precious metals streamers. The stock has surged from $17 to $39 in 12 months (+129%), leaving limited upside to current consensus targets ($32-$35 USD). Analyst targets actually imply downside from current prices. The Steppe Gold default in Q3 2025 highlights counterparty risk inherent in smaller streaming portfolios. Forward P/E of 34.7x is higher than trailing P/E, suggesting near-term earnings may disappoint.","cr":"Model suggests low CAGR, but Royalties are held for structural uncorrelated convexity, not just organic compounding."}
{"t":"TPL","n":"Texas Pacific Land","g":"Energy Royalties","cy":true,"p":"$530.36","mc":"$36.6B USD","fpe":7.3,"tpe":76.3,"peg":null,"eveb":55.7,"dy":"0%","eg":"15%","eps":6.95,"bas":"Pure Permian Basin royalty; forward PE at cyclical peak oil revenue; exit PE 35 reflects long-run royalty/land trust multiple","en":"fPERG","sc":1,"sg":"PASS","nt":"Used benchmark CV (missing dispersion data) (CYCLICAL EPS)","sp":true,"r6":66.7,"r1":3.5,"n3":false,"ru":0,"rd":0,"qcs":0,"cf":"medium","roe":"37.2%","fy":"~0%","nd":"Net cash","sh":-0.11,"bc":"Texas Pacific Land is an irreplaceable asset -- 880,000 surface acres in the heart of the Permian Basin generating royalties, surface leases, and water revenues. The 86% EBITDA margin, 39% ROE, and 30% ROIC are world-class. Water revenue (38% of total) is growing as Permian operators demand more water. The Bolt data center partnership (led by Eric Schmidt) could transform the company. Zero debt and $531M cash provide a fortress balance sheet. TPL has no peer -- it is a perpetual royalty on one of the most productive oil basins in history.","brc":"TPL trades at 41x trailing earnings and 31x EV/EBITDA for what is fundamentally an oil royalty and land company. The stock surged 50% in February alone, driven largely by the data center narrative, which is speculative and years from meaningful revenue. Only 1 analyst covers the stock, creating information asymmetry. Royalty revenue still depends on Permian drilling activity, which is sensitive to oil prices. At a $36B market cap, the market is pricing in substantial success from an unproven data center pivot.","cr":"Irreplaceable 880K-acre Permian asset with world-class profitability (39% ROE, 30% ROIC, 62% FCF margin). Data center optionality via Bolt partnership. But 41x P/E after 50% February rally prices in much of the upside."}
{"t":"TPZ.TO","n":"Topaz Energy","g":"Energy & Infrastructure","cy":false,"p":"C$31.05","mc":"C$4.8B","fpe":30.1,"tpe":37.4,"eveb":16.1,"evfcf":46.4,"dy":"4%","eg":"10%","eps":0.83,"bas":"Non-GAAP EPS","br":"-3%","bs":"12%","bu":"20%","en":"fPERG","sc":2.87,"sg":"FAIL","sp":true,"r6":16,"r1":0,"n3":false,"ru":0,"rd":0,"su":90.9,"qcs":6.67,"cf":"high","al":29,"am":33.67,"ah":36,"roe":"8.3%","fy":"~2%","nd":"1.7x","sh":0.17,"bc":"Topaz Energy is a pure-play royalty company with zero capital commitment — it receives net royalty payments on ~3.4 million BOE/d of production across Canada. The 5%+ royalty yield provides a floor return, and Tourmaline Oil's continued development activity drives organic royalty growth. The royalty model provides inflation protection.","brc":"Topaz's revenue is directly exposed to natural gas price cycles. The Montney formation concentration creates single-basin risk, and a prolonged gas price weakness (as seen 2023-2024) directly compresses distributable cash flow and dividend coverage.","cr":"Canadian royalty tied to natural gas and LNG buildout. High yield + growth."}
{"t":"VNOM","n":"Viper Energy","g":"Energy Royalties","cy":true,"p":"$47.46","mc":"$17.8B USD","fpe":22.1,"tpe":23.6,"peg":null,"eveb":12.9,"evfcf":-10.4,"dy":"5%","eg":"8%","eps":3.65,"bas":"Distributable CF per share; Price-to-DCF exit multiple","br":"-4%","bs":"18%","bu":"48%","en":"totalReturn","sc":null,"sg":"FAIL","nt":"Dividend exceeds forward earnings (value trap) (CYCLICAL EPS)","sp":true,"r6":19.5,"r1":2.2,"n3":false,"ru":3,"rd":3,"su":-1.2,"qcs":9.36,"cf":"medium","al":43,"am":53.5,"ah":68,"roe":"-2.9%","fy":"~-9%","nd":"1.7x","sh":0.49,"bc":"Viper owns premier mineral rights in the Permian Basin with the strongest operator (Diamondback) drilling on its acreage. The 93% gross margin and 88% EBITDA margin are among the highest in energy. Management is targeting near-100% cash return to shareholders once $1.5B net debt target is reached. The 8% distributable cash flow yield at $65 WTI provides compelling income. At 7.1x EV/EBITDA, VNOM trades at a significant discount to precious metals royalty peers.","brc":"Viper's earnings are directly tied to oil prices, and any sustained period below $55 WTI would severely compress cash flows and dividends. The Sitio acquisition created $1.6B in net debt and depressed ROIC to ~4% (vs. historical 13.3%). Diamondback controls the board, and the recent secondary offering diluted public shareholders. The forward P/E of 25x above trailing P/E of ~17x suggests analysts expect near-term earnings pressure.","cr":"Premier Permian Basin mineral rights with 93% gross margin and ~8% distributable cash flow yield. But oil price dependency, elevated PEG, and depressed ROIC post-Sitio acquisition add risk."}
{"t":"WPM","n":"Wheaton Precious Metals","g":"Royalties","cy":true,"p":"$122.64","mc":"$55.9B USD","fpe":20,"tpe":37.9,"peg":1.41,"eveb":28.7,"evfcf":722.6,"dy":"1%","eg":"15%","eps":3.26,"bas":"Operating CFO per share; Price-to-CF exit multiple","br":"31%","bs":"57%","bu":"114%","en":"fCFG","sc":53.22,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":12.5,"r1":-23.8,"n3":false,"ru":5,"rd":2,"su":11.7,"qcs":6.25,"cf":"low","al":160,"am":191.59,"ah":260.97,"roe":"18.5%","fy":"~0%","nd":"Net cash","sh":1.51,"bc":"Wheaton offers the best organic production growth in the precious metals streaming space -- 40% growth by 2029, with 2026 guidance of 860-940K GEOs representing a ~28% jump. The company has a pristine balance sheet (net cash of $1.15B), 54.7% net margins, and 13%+ ROIC. With gold prices above $2,800/oz, the fixed-cost streaming model provides massive operating leverage.","brc":"WPM trades at a trailing P/E of 65x and a market cap of $66.7B on $1B of trailing earnings -- pricing in near-flawless execution and sustained high gold prices. The stock has risen 107% in 52 weeks. FCF yield is approximately 1%, which is thin. Any gold price correction toward $2,200/oz would compress earnings significantly.","cr":"Model suggests low CAGR, but Royalties are held for structural uncorrelated convexity, not just organic compounding."}
```

---

## Instructions

Analyze each of the 14 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
