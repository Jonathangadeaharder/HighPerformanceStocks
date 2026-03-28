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

## Batch 3/10: Software & Data Monopolies (16 stocks)

> **Batch-specific guidance**: Structural monopolies and platform businesses. Pay attention to: (a) the 15/20/25 exit PE default trap - these businesses NEVER mean-revert to 20x, (b) Rule of 40 for SaaS, (c) pre-profit or extreme-multiple names (PLTR, DDOG, SHOP).

### Stock Data

```jsonl
{"t":"AMZN","n":"Amazon","g":"Data & Software Monopolies","cy":false,"p":"$211.71","mc":"$2272.7B USD","fpe":22.6,"tpe":29.5,"eveb":16,"evfcf":97.9,"dy":"0%","eg":"22%","eps":7.17,"bas":"Non-GAAP Operating EPS (GAAP EPS adjusted for stock-based compensation and depreciation normalization; AWS FCF inflection is primary driver)","br":"-17%","bs":"32%","bu":"70%","en":"fPERG","sc":1.08,"sg":"WAIT","sp":true,"r6":-3.7,"r1":1.8,"n3":false,"ru":4,"rd":5,"su":-0.5,"dcf":141.58,"dd":-33,"qcs":3.59,"cf":"high","al":175,"am":280.47,"ah":360,"roe":"22.3%","fy":"~1%","nd":"0.4x","sh":0.63,"bc":"AWS is inflecting to 30%+ growth as AI training and inference workloads drive the next compute supercycle. Amazon Advertising is a $55B+ revenue stream growing 20%+ annually at 60%+ margins. The retail segment is approaching structural profitability as third-party seller fees and delivery efficiency improve. FCF is compounding toward $100B+/year.","brc":"Amazon's massive CapEx ($75B+ in 2025) on AWS and logistics infrastructure compresses near-term FCF. If the AWS growth reacceleration proves temporary (Google Cloud and Azure competing aggressively), the multiple contracts sharply. Antitrust actions targeting Prime bundling or AWS dominance could restructure the business.","cr":"Dual monopolies in e-commerce logistics and cloud computing (AWS). Currently undergoing massive FCF margin inflection."}
{"t":"BKNG","n":"Booking Holdings","g":"Data & Software Monopolies","cy":true,"p":"$4237.75","mc":"$136.6B USD","fpe":13.5,"tpe":25.6,"eveb":13.5,"evfcf":20.8,"dy":"1%","eg":"17%","eps":165.7,"bas":"Non-GAAP EPS","br":"7%","bs":"38%","bu":"84%","en":"fPERG","sc":0.86,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":-23.6,"r1":-0.3,"n3":false,"ru":11,"rd":8,"su":0.3,"qcs":4.5,"cf":"high","al":4495,"am":5802.23,"ah":7746,"fy":"~5%","nd":"0.2x","sh":1.28,"bc":"Booking Holdings operates the global OTA duopoly (with Expedia) and is the near-monopoly in European accommodation. Its asset-light model generates 40%+ operating margins. The shift to connected trip — flights, hotels, rental cars, attractions in a single booking — is expanding wallet share per customer. Aggressive share buybacks at 7%+ annually provide EPS floor.","brc":"Travel spending is among the most discretionary consumer categories — Booking's revenue fell 90%+ in COVID and is sensitive to recession and geopolitical disruption. At 14x forward PE, valuation is attractive but the stock has historically compressed to 10-11x in downturns. Airbnb is taking share in leisure accommodation, particularly in major European cities.","cr":"Textbook GARP. Shrinking float, increasing margins, stable 15%+ EPS growth."}
{"t":"CRM","n":"Salesforce","g":"Data & Software Monopolies","cy":false,"p":"$181.96","mc":"$170.5B USD","fpe":12.2,"tpe":23.3,"peg":0.88,"eveb":14,"evfcf":10.8,"dy":"1%","eg":"15%","eps":7.81,"bas":"Non-GAAP EPS (excl. SBC and acquisition amortization); exit PE calibrated to 10yr median discount analysis","br":"5%","bs":"51%","bu":"162%","en":"fPERG","sc":0.81,"sg":"PASS","sp":false,"r6":-25.3,"r1":-8.8,"n3":true,"ru":17,"rd":15,"su":24.9,"qcs":11.2,"cf":"medium","al":190,"am":273.66,"ah":475,"roe":"12.4%","fy":"~10%","nd":"0.6x","sh":2.26,"bc":"The dominant enterprise CRM platform with 150,000+ customers and massive switching costs. Agentforce AI initiative is driving re-acceleration with Q4 FY26 non-GAAP EPS beating consensus by 25%. FCF margins at 33% are best-in-class for enterprise SaaS. A $50B buyback plan provides a strong capital return floor. Trading at just 26x trailing PE — 79% below its 10-year median of 127x — offers rare value entry for a software monopoly.","brc":"Sales Cloud growth has slowed to 8.4% YoY, and FY27 revenue guidance fell short of expectations. Competition from Microsoft Copilot and ServiceNow AI is intensifying. The stock has declined 31% over the past 52 weeks, suggesting the market sees structural deceleration. If Agentforce fails to drive meaningful revenue uplift, the re-rating thesis collapses.","cr":"Dominant enterprise CRM platform with 33% FCF margins and PEG of 0.88. Agentforce AI momentum strong, but competition from Microsoft and ServiceNow, plus slowing Sales Cloud growth (8.4% YoY)."}
{"t":"DDOG","n":"Datadog","g":"Cloud Infrastructure","cy":false,"p":"$123.29","mc":"$43.6B USD","fpe":46.6,"tpe":397.7,"eveb":5349.1,"evfcf":45.8,"dy":"0%","eg":"20%","eps":2.12,"bas":"2026E non-GAAP adjusted EPS; high-growth observability SaaS multiple","br":"-2%","bs":"48%","bu":"111%","en":"fPERG","sc":2.37,"sg":"FAIL","sp":true,"r6":-11.3,"r1":5.9,"n3":false,"ru":3,"rd":28,"su":6.3,"qcs":5.87,"cf":"low","al":121,"am":182.43,"ah":260,"roe":"3.3%","fy":"~2%","nd":"Net cash","sh":0.93,"bc":"The premier cloud infrastructure monitoring platform. Essential utility as workloads shift to the cloud and become more complex.","brc":"Recent profitability guidance disappointed; intense competition from Cloudflare, Dynatrace, and hyperscalers' native tools.","cr":"Cloud observability leader with durable 20% growth, but valuation remains rich versus current guidance."}
{"t":"DSG.TO","n":"Descartes Systems","g":"Data & Software Monopolies","cy":false,"p":"C$96.76","mc":"C$8.3B","fpe":21.8,"tpe":37.8,"eveb":25.9,"evfcf":33.8,"dy":"0%","eg":"17%","eps":2.56,"bas":"Price-to-FCF; Non-GAAP EPS originally, transitioned to FCF due to serial acquirer mechanics","en":"fCFG","sc":1.98,"sg":"FAIL","sp":true,"r6":-26.9,"r1":4.2,"n3":false,"ru":4,"rd":0,"su":-5.8,"qcs":0.36,"cf":"high","roe":"10.9%","fy":"~3%","nd":"Net cash","sh":0.74,"bc":"Descartes holds a near-monopoly position in global logistics software (customs, routing, compliance), with 32%+ FCF margins and a serial acquisition model. A 20x exit P/E significantly undervalues an asset-light SaaS compounder with captive government-agency and logistics-operator clients.","brc":"Organic revenue growth of 8-10% limits EPS expansion without meaningful acquisitions. A global trade slowdown (tariffs, recession) would hit volumes and depress the ARR base. The 20x exit P/E leaves no cushion if the market reclassifies it as an industrial.","cr":"Logistics/supply chain software serial acquirer (similar to CSU focused on global trade)."}
{"t":"GOOGL","n":"Alphabet","g":"Data & Software Monopolies","cy":true,"p":"$290.93","mc":"$3519.4B USD","fpe":21.7,"tpe":26.9,"peg":2.3,"eveb":23,"evfcf":90.8,"dy":"0%","eg":"12%","eps":10.82,"bas":"Non-GAAP EPS (SBC & Depreciation adjusted)","br":"-36%","bs":"29%","bu":"52%","en":"fPERG","sc":1.8,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":18,"r1":-5.4,"n3":true,"ru":4,"rd":4,"su":7,"dcf":154.44,"dd":-47,"qcs":5.18,"cf":"medium","al":185,"am":376.75,"ah":443,"roe":"35.7%","fy":"~1%","nd":"Net cash","sh":0.12,"bc":"An unstoppable cash-generating monopoly trading at a severe mathematical discount to its intrinsic cash-flow generation capability.","brc":"The PEG ratio of 2.3x indicates slowing growth expectations. It acts as a low-beta gravity well, dragging down the geometric compounding rate of a leveraged basket.","cr":"Google Search retains 90%+ query share despite AI Overviews cannibalizing some clicks. YouTube is growing ad revenue 15%+ annually. Google Cloud is accelerating to 30%+ growth with Gemini AI integration. At 23x forward PE on 12% EPS growth, the stock is reasonably valued for a monopoly-quality business."}
{"t":"IT","n":"Gartner","g":"Data & Software Monopolies","cy":true,"p":"$150.23","mc":"$10.8B USD","fpe":10.4,"tpe":15.6,"eveb":9.3,"evfcf":13.2,"dy":"0%","eg":"12%","eps":9.64,"bas":"Reduced sensitivity to mean-reversion; reflects modest growth profile.","br":"0%","bs":"27%","bu":"70%","en":"fPERG","sc":1.23,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-43.1,"r1":-3.6,"n3":false,"ru":3,"rd":6,"su":12.2,"qcs":8.67,"cf":"high","al":150,"am":190.46,"ah":255,"roe":"86.9%","fy":"~9%","nd":"1.2x","sh":0.58,"bc":"Gartner's enterprise IT research is the most defensible subscription moat in B2B services — Fortune 500 clients renew at 90%+ rates because Gartner's Magic Quadrant dictates vendor selection. Aggressive buybacks (~6% float reduction annually) compound EPS well above organic growth. After a 36% selloff, the stock trades at an anomalously low 11x forward PE.","brc":"Enterprise IT budgets are among the first to be cut in a downturn. If new contract volumes slow in a recession, Gartner's double-digit growth engine stalls. The buyback program — funded by FCF — is the primary EPS driver; any FCF pressure creates a compounding miss.","cr":"Monopoly in enterprise IT research. Massive free cash flow and relentless share buybacks."}
{"t":"MCO","n":"Moody's","g":"Data & Software Monopolies","cy":true,"p":"$428.05","mc":"$76.2B USD","fpe":22.9,"tpe":31.4,"eveb":21.7,"evfcf":39.4,"dy":"1%","eg":"15%","eps":13.65,"bas":"Non-GAAP EPS","br":"8%","bs":"29%","bu":"55%","en":"fPERG","sc":1.47,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-10.2,"r1":-10.7,"n3":false,"ru":10,"rd":2,"su":6,"qcs":6.82,"cf":"high","al":460,"am":546.7,"ah":660,"roe":"62.1%","fy":"~3%","nd":"1.3x","sh":0.9,"bc":"Moody's Analytics (MA) subscription segment now represents ~60% of revenue and grows 10%+ regardless of issuance cycles, providing a structural recurring revenue floor. The MIS ratings segment benefits from the refinancing wave as $8T in corporate debt comes due by 2026. Fee-based pricing power with no regulatory cap.","brc":"If investment-grade issuance dries up in a recession or credit freeze, MIS revenue collapses rapidly (2022: -18% MIS revenue). At 23x forward PE, Moody's trades at a premium that requires sustained mid-teens EPS growth; any miss compresses the multiple sharply.","cr":"Asset-light, unregulated duopoly with infinite pricing power."}
{"t":"MKTX","n":"MarketAxess","g":"Data & Software Monopolies","cy":false,"p":"$166.11","mc":"$6.2B USD","fpe":18.3,"tpe":25,"eveb":13.2,"evfcf":24.9,"dy":"2%","eg":"9%","eps":6.64,"bas":"Non-GAAP EPS","br":"4%","bs":"19%","bu":"53%","en":"fPERG","sc":1.96,"sg":"FAIL","sp":true,"r6":-7.8,"r1":-10.1,"n3":false,"ru":1,"rd":0,"su":51.4,"qcs":-0.63,"cf":"high","al":169,"am":193.7,"ah":250,"roe":"19.4%","fy":"~4%","nd":"Net cash","sh":0.89,"bc":"MarketAxess retains dominant share in high-yield and emerging market bond trading where Tradeweb has less penetration. Portfolio trading volumes are growing rapidly. At 20x forward PE — a historic low — the market is pricing in permanent share loss that may be overstated.","brc":"Tradeweb continues taking IG credit market share and now offers better price discovery through its dealer network. MKTX revenue was essentially flat in 2023-2024. At a current forward PE of 20x on 9% EPS growth, there is limited upside if share losses continue.","cr":"MarketAxess pioneered electronic credit trading and still leads in high-yield and EM bonds. However, Tradeweb has been taking significant market share in investment-grade credit. The recovery thesis rests on defending its HY/EM moat and rebuilding IG share — execution risk is high."}
{"t":"MSFT","n":"Microsoft","g":"Data & Software Monopolies","cy":false,"p":"$371.04","mc":"$2757.7B USD","fpe":19.7,"tpe":23.2,"eveb":15.9,"evfcf":52,"dy":"1%","eg":"14%","eps":16,"bas":"Non-GAAP EPS (CapEx depreciation adjusted)","br":"7%","bs":"60%","bu":"98%","en":"fPERG","sc":1.43,"sg":"FAIL","sp":false,"r6":-27.5,"r1":-7.6,"n3":true,"ru":2,"rd":2,"su":34.1,"dcf":321.03,"dd":-13,"qcs":0.32,"cf":"high","al":392,"am":591.6,"ah":730,"roe":"34.4%","fy":"~2%","nd":"0.2x","sh":1.85,"bc":"Microsoft is the infrastructure layer for enterprise AI — Azure is growing 29% YoY and accelerating as Copilot for M365 and GitHub Copilot begin generating material revenue at $30+/seat. Office 365 pricing power continues with AI-tier upsells. The OpenAI equity stake provides uncapped upside from AGI development. 95%+ recurring revenue base.","brc":"Azure growth faces increasing competition from Google Cloud (BigQuery, Vertex AI) and AWS as hyperscaler lock-in weakens with multi-cloud adoption. Copilot enterprise adoption has been slower than Wall Street expected as enterprises navigate AI governance policies. At 21x forward PE, Microsoft trades at a premium that requires sustained 14%+ EPS growth.","cr":"Enterprise software and cloud computing monopoly. Unparalleled B2B distribution network and AI infrastructure leadership via Azure/OpenAI."}
{"t":"NFLX","n":"Netflix","g":"Data & Software Monopolies","cy":false,"p":"$92.28","mc":"$391.4B USD","fpe":24,"tpe":36.5,"eveb":29.1,"evfcf":16,"dy":"0%","eg":"18%","eps":2.53,"bas":"Non-GAAP EPS / Cash FCF parity","br":"-13%","bs":"23%","bu":"64%","en":"fPERG","sc":1.31,"sg":"FAIL","sp":true,"r6":-23.8,"r1":9.1,"n3":false,"ru":8,"rd":1,"su":1.4,"dcf":112.28,"dd":22,"qcs":1.39,"cf":"medium","al":80,"am":113.21,"ah":151.4,"roe":"42.8%","fy":"~6%","nd":"0.6x","sh":0.62,"bc":"Netflix won the streaming wars. It is the only pure-play streaming platform with global scale (300M+ subscribers), consistent content investment discipline, and a growing advertising tier that creates a new high-margin revenue stream. Live sports and events (NFL, WWE) are extending the addressable audience. FCF has inflected to $7B+ annually.","brc":"At 24x forward PE for an 18% EPS grower, Netflix is not cheap. Subscriber growth in developed markets is approaching saturation — the next growth leg requires LatAm/Asia penetration at lower ARPU. The advertising tier depends on Netflix building an ad tech stack from scratch. Password sharing re-enforcement tailwind is exhausted in 2025-2026.","cr":"Won the streaming wars. Transitioned from high-burn content spending to predictable, compounding free cash flow and advertising tier optionality."}
{"t":"PLTR","n":"Palantir","g":"Enterprise Software","cy":false,"p":"$154.96","mc":"$370.6B USD","fpe":83,"tpe":242.1,"eveb":252.6,"evfcf":288.5,"dy":"0%","eg":"35%","eps":0.64,"bas":"GAAP diluted EPS","br":"-55%","bs":"20%","bu":"68%","en":"fPERG","sc":2.62,"sg":"FAIL","sp":true,"r6":-12.7,"r1":14,"n3":false,"ru":1,"rd":0,"su":8.6,"dcf":9.63,"dd":-94,"qcs":4.16,"cf":"medium","al":70,"am":186.6,"ah":260,"roe":"26.0%","fy":"~0%","nd":"Net cash","sh":0.04,"bc":"Palantir's AIP platform is becoming the enterprise AI operating system — AIP bootcamps are converting Fortune 500 trials to paid contracts at an accelerating pace. US commercial revenue grew 55%+ in 2025. The US government remains a structural buyer (DoD, CIA, NHS equivalent) regardless of political cycles. AIP's value proposition strengthens as AI adoption deepens.","brc":"At 83x forward PE and $370B market cap, Palantir is priced for decades of compounding. Government contract cancellations under DOGE budget cuts pose direct revenue risk. European data sovereignty laws restrict PLTR's commercial expansion on the continent. The AIP e-commerce expansion is early-stage and unproven at scale.","cr":"AIP platform gaining massive traction in commercial sector."}
{"t":"SHOP","n":"Shopify","g":"High-Growth Tech","cy":false,"p":"$118.42","mc":"$154.5B USD","fpe":51.5,"tpe":126,"eveb":77.1,"evfcf":115.7,"dy":"0%","eg":"26%","eps":1.89,"bas":"2026E adjusted EPS; premium software and e-commerce platform multiple","br":"-7%","bs":"35%","bu":"69%","en":"fPERG","sc":2.07,"sg":"FAIL","sp":true,"r6":-15.6,"r1":-6,"n3":false,"ru":13,"rd":11,"su":-5.7,"dcf":18.13,"dd":-85,"qcs":1.05,"cf":"medium","al":110,"am":160.15,"ah":200,"roe":"9.8%","fy":"~1%","nd":"Net cash","sh":0.44,"bc":"The default operating system for independent e-commerce globally. Expanding merchant solutions and strong operating leverage driving earnings.","brc":"Current forward PE is ~96x, leaving zero margin for error in growth execution. Consumer spending slowdowns impact gross merchandise volume.","cr":"E-commerce infrastructure leader with 26-28% adjusted EPS growth and strong operating leverage, though valuation remains premium."}
{"t":"SPGI","n":"S&P Global","g":"Data & Software Monopolies","cy":true,"p":"$408.48","mc":"$123.7B USD","fpe":18.5,"tpe":27.9,"eveb":18.2,"evfcf":28.5,"dy":"1%","eg":"15%","eps":14.66,"bas":"Non-GAAP EPS","br":"19%","bs":"33%","bu":"54%","en":"fPERG","sc":1.18,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":true,"r6":-16.2,"r1":-6.6,"n3":false,"ru":1,"rd":2,"su":-0.8,"qcs":5,"cf":"high","al":480,"am":538.52,"ah":625,"roe":"13.1%","fy":"~4%","nd":"1.6x","sh":1.07,"bc":"S&P Global's Ratings segment benefits from surging debt issuance volumes at still-elevated rates. Market Intelligence and Mobility segments are growing 10%+ organically on subscription revenue. After absorbing the IHS Markit integration, operating margins are expanding toward 50%+, driving compounding non-GAAP EPS.","brc":"Ratings revenue is highly sensitive to debt issuance cycles — a credit freeze or prolonged rate inversion collapses new issuance and cuts Ratings revenue materially (as seen in 2022). At 19x forward PE, any deceleration below 12% EPS growth would re-rate the stock.","cr":"Asset-light, unregulated duopoly with infinite pricing power."}
{"t":"TW","n":"Tradeweb","g":"Data & Software Monopolies","cy":true,"p":"$119.95","mc":"$26.2B USD","fpe":26.7,"tpe":31.7,"dy":"0%","eg":"15%","eps":3.78,"bas":"Non-GAAP EPS","br":"-7%","bs":"10%","bu":"69%","en":"fPERG","sc":1.74,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":8.1,"r1":-1.6,"n3":false,"ru":2,"rd":1,"su":3,"qcs":7.52,"cf":"high","al":111,"am":132.31,"ah":203,"roe":"13.6%","sh":0.88,"bc":"Tradeweb is systematically replacing voice-brokered bond trading with electronic protocols, growing market share in US Treasuries, IG credit, and rates derivatives. Commission-per-ticket is rising as automation reduces headcount costs for clients. At 30%+ revenue CAGR, it is taking share from both MKTX and legacy dealers simultaneously.","brc":"At 28x forward PE, TW is priced for continued share gains in fixed income e-trading. If bond market volumes collapse (credit freeze, rate stability), revenue growth stalls. MKTX is fighting back in US credit and dealer internalization poses a long-term structural risk.","cr":"Electronic bond trading matching traditional voice-brokers. Asset-light, massive operating leverage."}
{"t":"VRSK","n":"Verisk Analytics","g":"Data & Software Monopolies","cy":false,"p":"$185.05","mc":"$25.8B USD","fpe":21.5,"tpe":28.6,"eveb":19,"evfcf":27.9,"dy":"1%","eg":"14%","eps":6.48,"bas":"Non-GAAP EPS","br":"0%","bs":"25%","bu":"50%","en":"fPERG","sc":1.48,"sg":"FAIL","sp":true,"r6":-25.1,"r1":-8.7,"n3":false,"ru":2,"rd":2,"su":12.9,"qcs":9.17,"cf":"high","al":183,"am":230,"ah":275,"roe":"437.9%","fy":"~4%","nd":"1.8x","sh":0.68,"bc":"Verisk is the FICO of insurance — the essential data and analytics infrastructure for P&C underwriting. After divesting Energy and Financial Services, it is a pure-play insurance analytics monopoly with 92%+ recurring revenue. ISO/AIR catastrophe modeling is non-substitutable for carrier pricing and reinsurance.","brc":"Verisk's 14x forward PE and 14% EPS growth trajectory are attractive but execution risk exists as the company refocuses post-divestitures. If the P&C insurance market softens significantly, data licensing volumes plateau. Data breach risk for a company holding underwriting data on nearly every US property.","cr":"The 'FICO of insurance'. Proprietary databases for P&C insurers. Asset-light, massive margins."}
```

---

## Instructions

Analyze each of the 16 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group (e.g., are exit PEs consistently too conservative?)
2. **Peer comparison anomalies** (e.g., stock A is scored cheaper than stock B despite worse metrics)
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch (over-valued or under-valued by the model)
