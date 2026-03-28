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

## Batch 08/10: Emerging Markets & Capital Compounders (24 stocks)

> **Batch-specific guidance**: Mixed batch: EM stocks and capital compounders. Pay attention to: (a) EM permanent discount (VIE risk, FX) for Chinese ADRs, (b) SEK/GBP currency risk for Nordic/UK names, (c) capital compounder exit PE norms, (d) holding company NAV discounts.

### Stock Data

```jsonl
{"t":"0700.HK","n":"Tencent","g":"Emerging Markets","cy":true,"p":"HK$495.60","mc":"HK$4479.4B","fpe":12.8,"tpe":18,"peg":null,"eveb":16.9,"evfcf":26.9,"dy":"1%","eg":"12%","eps":29,"bas":"Non-IFRS adjusted EPS (excl SBC & investment gains); HKD; non-IFRS P/E basis","br":"-3%","bs":"45%","bu":"78%","en":"fPERG","sc":1.23,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":false,"r6":-24.9,"r1":-4.3,"n3":true,"ru":4,"rd":19,"su":1.5,"qcs":-0.01,"cf":"high","al":476.87,"am":713.71,"ah":875.25,"roe":"20.0%","fy":"~4%","nd":"Net cash","sh":1.1,"bc":"WeChat's 1.3B MAU ecosystem is an unassailable moat — payments, mini-programs, video accounts, and e-commerce all monetizing within a single super-app. Gaming revenue re-accelerating with new title pipeline and international expansion (Riot Games, Supercell). AI integration across WeChat, cloud, and advertising is driving margin expansion. $100B+ investment portfolio (Spotify, Sea, Epic Games) provides hidden value. Buyback program retiring 3-4% of shares annually. Video Accounts is the fastest-growing short video platform in China, closing the gap with Douyin.","brc":"Chinese regulatory risk remains — gaming license freezes, antitrust actions, or data privacy rules could resurface. Advertising revenue is cyclically exposed to China's weak consumer economy. International gaming competition from Microsoft/Activision intensifying. VIE structure risk similar to BABA for offshore investors. Heavy investment in AI and cloud could compress margins near-term. HKD-denominated stock adds currency layer for USD-based investors (HKD pegged to USD via 7.75-7.85 band, but peg could theoretically break under extreme stress).","cr":"China's most diversified tech platform — WeChat (1.3B MAU), gaming (#1 globally), fintech, cloud, and AI. Non-IFRS EPS growing ~15% with aggressive buybacks. Best risk-reward in China tech."}
{"t":"APP","n":"AppLovin","g":"Ad-Tech","cy":true,"p":"$436.69","mc":"$147.6B USD","fpe":21.6,"tpe":43.5,"peg":0.8,"eveb":34.7,"evfcf":55,"dy":"0%","eg":"30%","eps":10.05,"bas":"Adjusted to reflect execution risk in expansion verticals (CTV/E-commerce).","br":"-22%","bs":"49%","bu":"97%","en":"fPERG","sc":0.73,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":-34.8,"r1":-1.9,"n3":false,"ru":12,"rd":2,"su":10.1,"qcs":4.28,"cf":"high","al":340,"am":648.57,"ah":860,"roe":"212.9%","fy":"~2%","nd":"0.3x","sh":0.41,"bc":"AppLovin is the 'Nvidia of Ad-Tech.' Their AXON 2.0 AI recommendation engine is achieving peerless software metrics (Rule of 40 > 135%, ROIC > 114%). The 2026 expansion of AXON into massive new verticals like E-commerce and Connected TV (CTV) via a self-serve platform creates a massive data flywheel that is completely decoupled from their legacy gaming studios.","brc":"Highly sensitive to Apple (ATT) and Google privacy policy changes. The ongoing SEC investigation into data collection practices remains a regulatory overhang. Additionally, there is significant concentration risk as AXON 2.0's financial metrics are heavily reliant on the mobile gaming sector; its success in E-commerce and CTV is still in the 'prove it' phase. As growth inevitably normalizes from the 70% hyper-growth phase, the stock could face severe multiple contraction.","cr":"Rule of 40 > 135% with an insane 114% ROIC. AXON 2.0 AI engine expanding successfully beyond gaming into e-commerce."}
{"t":"BABA","n":"Alibaba","g":"Emerging Markets","cy":true,"p":"$129.87","mc":"$310.1B USD","fpe":16.7,"tpe":23.1,"peg":null,"eveb":17.5,"evfcf":-92.9,"dy":"1%","eg":"13%","eps":9.01,"bas":"Non-GAAP adjusted EPS (excl SBC & investment gains); non-GAAP P/E basis","br":"-13%","bs":"47%","bu":"99%","en":"tPERG","sc":1.23,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-24.5,"r1":-12.3,"n3":false,"ru":1,"rd":20,"su":-35.2,"dcf":239.73,"dd":85,"qcs":-7.09,"cf":"medium","al":111.74,"am":189.29,"ah":257.41,"roe":"8.2%","fy":"~-8%","nd":"Net cash","sh":0.84,"bc":"Alibaba Cloud is the #1 cloud provider in China with AI-driven re-acceleration. The $25B+ annual buyback program is aggressively reducing share count. Core commerce margins are expanding as Taobao/Tmall refocuses on profitability. International e-commerce (Lazada, AliExpress) is gaining traction in SE Asia and Europe. Sum-of-parts valuation implies 40-60% discount — cloud alone could be worth $80-100B. Regulatory cycle has clearly turned positive with government endorsing private tech sector.","brc":"VIE structure means ADR holders don't own the operating company — existential legal risk if US-China relations deteriorate. China's consumer economy remains sluggish with deflationary pressures. Cloud growth has decelerated as government clients shift to domestic alternatives. Competition from PDD (Temu), JD, and Douyin is intense in core commerce. Jack Ma's reduced role and prior regulatory crackdown created lasting governance concerns. Potential Taiwan conflict would be catastrophic for the stock.","cr":"China's dominant e-commerce and cloud platform. Trading at deep discount to intrinsic value due to regulatory overhang. Non-GAAP EPS growing ~13% with massive buyback program."}
{"t":"BN","n":"Brookfield Corporation","g":"Financials & Alt Assets","cy":false,"p":"$39.91","mc":"$90.3B USD","fpe":6.8,"tpe":81.4,"peg":null,"eveb":15.1,"evfcf":-101.2,"dy":"1%","eg":"16.5%","eps":2.27,"bas":"Conservatively adjusted from management guidance to account for corporate complexity and debt load.","br":"-21%","bs":"36%","bu":"51%","en":"fPERG","sc":0.41,"sg":"PASS","nt":"Used benchmark CV (missing dispersion data)","sp":true,"r6":-12.5,"r1":-12.2,"n3":false,"ru":0,"rd":0,"qcs":2.5,"cf":"medium","al":31,"am":53.95,"ah":60,"roe":"2.0%","fy":"~-5%","nd":"N/M (consolidated)","sh":0.32,"bc":"Management estimates 25% annual earnings growth over the next 5 years. AI infrastructure fund creates massive new growth vector. Insurance reintegration adds fee-generating scale. Ultimate real-asset compounder at scale.","brc":"Extremely complex corporate structure makes analysis difficult. Low reported margins/ROIC due to consolidation accounting with $251B non-recourse debt. Rate-sensitive across many business lines. Valuation looks optically expensive on standard screens.","cr":"19% CAGR for 30 years. $1T+ AUM. Launched $100B AI infrastructure fund. Management estimates 25% annual earnings growth over 5 years. But opaque corporate structure and distorted accounting."}
{"t":"BRK.B","n":"Berkshire Hathaway","g":"The Capital Compounders","cy":true,"p":"$476.19","mc":"$1027.1B USD","fpe":21.9,"tpe":15.3,"peg":null,"eveb":null,"evfcf":-6.4,"dy":"0%","eg":"10%","eps":31.03,"bas":"Estimated compounder baseline; normalized operating EPS (excl. volatile GAAP investment mark-to-market gains/losses)","br":"1%","bs":"10%","bu":"21%","en":"tPERG","sc":1.48,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":-4.8,"r1":-5.3,"n3":true,"ru":0,"rd":2,"su":-8.5,"qcs":-6.07,"cf":"high","al":481,"am":523,"ah":578,"roe":"9.8%","fy":"~4%","nd":"Net cash","sh":0.36,"bc":"The ultimate defensive safe harbor. Trading at a reasonable 1.5x book value, the company's vast cash reserves provide unmatched optionality. The potential initiation of a dividend or massive buybacks under the Greg Abel era serves as a strong forward catalyst.","brc":"The sheer size of the capital base ($380B+ cash) makes high-velocity geometric compounding mathematically impossible. It serves as a volatility dampener rather than a torque engine.","cr":"Ultimate defensive safe harbor with $380B+ cash fortress providing unmatched optionality."}
{"t":"CPRT","n":"Copart","g":"Capital Compounders","cy":false,"p":"$33.08","mc":"$32.0B USD","fpe":19.7,"tpe":20.8,"eveb":13.8,"evfcf":26,"dy":"0%","eg":"16%","eps":1.59,"bas":"Non-GAAP EPS","br":"-3%","bs":"29%","bu":"66%","en":"fPERG","sc":1.2,"sg":"REJECTED","nt":"Consensus actively collapsing (analyst lag)","sp":false,"r6":-26.3,"r1":-11,"n3":true,"ru":0,"rd":10,"su":-8.1,"qcs":3.81,"cf":"high","al":32,"am":42.67,"ah":55,"roe":"17.1%","fy":"~3%","nd":"Net cash","sh":1,"bc":"Copart operates the most defensible marketplace in the salvage vehicle industry — a two-sided network of insurance companies and vehicle dismantlers/exporters, with 50+ years of physical land accumulation that is essentially irreplicable. Total-loss rates are structurally rising as repair costs exceed vehicle values, providing multi-decade volume tailwind.","brc":"Copart's growth is sensitive to used vehicle values — a used-car price collapse reduces salvage vehicle prices and volume simultaneously. Any regulatory or insurance industry change in total-loss thresholds could structurally reduce supply volume.","cr":"Unassailable monopoly in salvage auto auctions. Very little capex requirement, consistent 12–18% growth."}
{"t":"EXO.AS","n":"Exor N.V.","g":"The Capital Compounders","cy":false,"p":"€65.20","mc":"€21.4B","fpe":26.9,"peg":null,"eveb":null,"evfcf":-7.6,"dy":"1%","eg":"12%","eps":6.5,"bas":"Estimated compounder baseline","br":"56%","bs":"75%","bu":"90%","en":"fPERG","sc":2.23,"sg":"FAIL","sp":true,"r6":-21.4,"r1":-12.3,"n3":false,"ru":0,"rd":1,"qcs":0,"cf":"medium","al":101,"am":113.13,"ah":123,"roe":"-10.6%","fy":"~-9%","sh":2.74,"bc":"Under John Elkann, Exor has successfully pivoted from a legacy automotive holding (Fiat) to a diversified compounding engine (Healthcare, Luxury, Tech). Massive stakes in Ferrari and Philips drive baseline growth, while aggressive share buybacks target the extreme NAV discount to synthesize high returns.","brc":"Remaining exposure to cyclical auto sectors (Stellantis) and the risk of unproven ventures in healthcare and tech failing to match legacy automotive returns.","cr":"Deep 40-45% discount to NAV. Pivot to Healthcare and Tech under Elkann."}
{"t":"FFH.TO","n":"Fairfax Financial","g":"The Capital Compounders","cy":true,"p":"C$2336.96","mc":"C$50.1B","fpe":10.8,"tpe":8,"peg":null,"eveb":null,"evfcf":26.6,"dy":"1%","eg":"17%","eps":293.52,"bas":"Reflects strong underwriting performance and high-yield investment tailwinds.","br":"-19%","bs":"19%","bu":"40%","en":"tPERG","sc":0.86,"sg":"PASS","nt":"(CYCLICAL EPS)","sp":true,"r6":-2.6,"r1":0,"n3":false,"ru":2,"rd":0,"su":9.7,"qcs":-3.33,"cf":"high","al":1862.44,"am":2753.58,"ah":3243.4,"roe":"17.8%","fy":"~5%","nd":"0.8x","sh":0.26,"bc":"The purest modern execution of the Berkshire model. A high-yield fixed-income portfolio combined with disciplined underwriting generates massive, predictable cash flows. Massive 'hidden' fair value on the balance sheet makes the stock intrinsically cheaper than it appears.","brc":"Susceptibility to catastrophic 'fat-tail' insurance events and volatility in global bond markets which can temporarily impair book value.","cr":"Consistent 15%+ ROE, massive hidden fair value, and disciplined underwriting."}
{"t":"FIH.U.TO","n":"Fairfax India Holdings","g":"The Capital Compounders","cy":false,"p":"$16.61","mc":"$2.2B USD","fpe":-51.9,"tpe":5.4,"peg":null,"eveb":null,"evfcf":6.7,"dy":"0%","eg":"17%","eps":3.05,"bas":"Captures Bangalore Airport IPO catalyst and narrowing NAV discount.","en":"tPERG","sc":0.32,"sg":"PASS","nt":"Recent earnings miss (Used benchmark CV)","sp":true,"r6":-4.5,"r1":-5,"n3":true,"ru":0,"rd":0,"su":-400,"qcs":5,"cf":"medium","roe":"14.3%","fy":"~19%","sh":0.97,"bc":"A highly discounted vehicle for elite capital allocation in the world's fastest-growing major economy. The impending IPO of Anchorage Infrastructure (Bangalore Airport), now expected in September 2026, is a massive near-term catalyst that will crystallize intrinsic value and narrow the steep NAV discount.","brc":"Significant emerging market FX risk (Rupee depreciation) and illiquidity in its sum-of-the-parts portfolio. Unlocking value relies heavily on specific exit events rather than recurring distributions.","cr":"Trading at a steep discount to NAV, Anchorage Infrastructure IPO catalyst."}
{"t":"HDB","n":"HDFC Bank","g":"Emerging Markets","cy":false,"p":"$25.81","mc":"$132.4B USD","fpe":19,"tpe":18.2,"peg":null,"eveb":null,"dy":"1%","eg":"14%","eps":1.42,"bas":"GAAP diluted EPS (ADR); post 2:1 split Sep 2025","br":"25%","bs":"64%","bu":"83%","en":"fPERG","sc":1.42,"sg":"FAIL","sp":false,"r6":-24.4,"r1":-19.3,"n3":true,"ru":0,"rd":2,"su":1.6,"qcs":0,"cf":"medium","al":32.1,"am":42.15,"ah":47,"roe":"14.0%","nd":null,"sh":2.15,"bc":"India's banking sector is under-penetrated with credit-to-GDP at ~55% vs 150%+ in developed markets, giving HDFC Bank a multi-decade growth runway. The HDFC Ltd merger creates the largest private-sector balance sheet in India with cross-selling opportunities across mortgages, insurance, and asset management. Net interest margins remain best-in-class at ~3.5%. Digital adoption (PayZapp, SmartBUY) is accelerating fee income. Post-merger cost synergies are still being unlocked.","brc":"Post-merger integration is diluting ROE from ~17% to ~15% as the lower-yielding mortgage book gets absorbed. The RBI's tightening cycle has compressed NIMs. Intense competition from Jio Financial and other fintechs could pressure market share in unsecured lending. ADR investors face INR depreciation risk (~3-4% annual drag historically). Regulatory risk from RBI's increasing scrutiny of digital lending practices.","cr":"India's largest private bank by market cap. Consistent ~15% loan growth post-merger with HDFC Ltd. Low NPAs (~1.3%) and strong ROA (~1.9%). ADR trades at slight premium to local shares."}
{"t":"INDT.ST","n":"Indutrade","g":"Capital Compounders","cy":false,"p":"206 SEK","mc":"75.1B SEK","fpe":23,"tpe":29.3,"eveb":16.9,"evfcf":24.4,"dy":"2%","eg":"15%","eps":7.02,"bas":"Non-GAAP EPS","br":"14%","bs":"28%","bu":"57%","en":"fPERG","sc":1.51,"sg":"REJECTED","nt":"Consensus actively collapsing (analyst lag)","sp":true,"r6":-5,"r1":-12.3,"n3":false,"ru":0,"rd":4,"su":-14.7,"qcs":-3.86,"cf":"high","al":230,"am":260.43,"ah":320,"roe":"15.2%","fy":"~5%","nd":"1.5x","sh":1.03,"bc":"Indutrade is Sweden's premier niche industrial serial acquirer, compounding book value at 15%+ for 25 years. Its decentralized model acquires mission-critical technical components and industrial equipment companies at 6-8x EBIT, with organic growth layered on top. The 18x bear exit P/E reflects continued premium to Nordic peers.","brc":"The Swedish and European industrial economy is exposed to the macro slowdown — automotive and heavy industry clients have been reducing capex. Currency risk from SEK exposure and acquisition integration missteps represent the primary execution risks.","cr":"Swedish serial acquirer of niche B2B industrial tech. Extremely consistent 15%+ EPS compounder."}
{"t":"INVE-B.ST","n":"Investor AB","g":"Capital Compounders","cy":true,"p":"348 SEK","mc":"1064.8B SEK","fpe":22.1,"tpe":6.8,"peg":null,"eveb":null,"evfcf":12.1,"dy":"2%","eg":"10%","eps":15.7,"bas":"Normalized EPS (excl. one-time investment gains); forward-earnings basis","br":"-9%","bs":"6%","bu":"15%","en":"fPERG","sc":2.1,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":19.5,"r1":-8,"n3":false,"ru":1,"rd":0,"qcs":-5,"cf":"high","al":310,"am":362.4,"ah":392,"roe":"17.7%","fy":"~9%","nd":"0.6x","sh":-0.07,"bc":"The gold standard of European holding companies, controlled by the Wallenberg family. Combines a portfolio of world-class listed industrials (Atlas Copco, ABB) with a maturing private equity segment. It reliably compounds capital at high rates and benefits from the closing of the PE exit window.","brc":"High exposure to cyclical European and global industrial markets. Sensitivity to macroeconomic tariffs and cyclical downturns could slow NAV growth in the short term.","cr":"Gold standard of European holding companies. 18% historical NAV CAGR. Normalized EPS used to avoid distortion from volatile investment gains."}
{"t":"JDG.L","n":"Judges Scientific","g":"Capital Compounders","cy":false,"p":"£41.13","mc":"£0.3B","fpe":20.2,"tpe":25.2,"eveb":10.7,"evfcf":15,"dy":"3%","eg":"15%","eps":1.63,"bas":"Non-GAAP EPS","br":"1%","bs":"50%","bu":"78%","en":"fPERG","sc":1.29,"sg":"FAIL","sp":true,"r6":-34.7,"r1":-14.7,"n3":false,"ru":0,"rd":1,"qcs":-1,"cf":"high","al":40.15,"am":60.63,"ah":72,"roe":"12.9%","fy":"~8%","nd":"1.6x","sh":0.8,"bc":"Judges Scientific is a UK niche scientific instrument serial acquirer with 20%+ historical ROE and a proven capital allocation model. A 24x exit P/E represents fair value for an asset-light compounder with recurring aftermarket revenue and a deep pipeline of sub-£50M acquisition targets.","brc":"UK domicile adds currency risk (GBP/USD) and limits the acquisition pipeline vs. North American peers. Multiple compression from current 35x levels to 24x base would produce modest returns unless EPS growth exceeds 16%.","cr":"UK-based buyer of specialized scientific instrument manufacturers. Incredible return on capital."}
{"t":"LAGR-B.ST","n":"Lagercrantz Group","g":"Capital Compounders","cy":false,"p":"196 SEK","mc":"40.4B SEK","fpe":36.1,"tpe":35.4,"eveb":23,"evfcf":137.4,"dy":"1%","eg":"15%","eps":5.53,"bas":"Non-GAAP EPS","br":"14%","bs":"29%","bu":"41%","en":"fPERG","sc":2.35,"sg":"FAIL","sp":true,"r6":-3.6,"r1":-11.3,"n3":false,"ru":5,"rd":0,"su":3.3,"qcs":0.1,"cf":"high","al":222,"am":249.86,"ah":275,"roe":"29.4%","fy":"~1%","nd":"2.3x","sh":0.68,"bc":"Lagercrantz follows the same capital-light serial acquisition model as Lifco and Indutrade — acquiring niche industrial product companies with high switching costs and 15%+ EBIT margins. As one of Sweden's most disciplined compounders, it has delivered 20%+ annual returns over the past decade with minimal leverage.","brc":"Multiple expansion from 38x current P/E to any reasonable terminal value implies substantial compression risk. A European industrial recession would simultaneously reduce organic growth and acquisition targets' earnings, compressing the portfolio value.","cr":"Identical niche-B2B M&A model to Addtech/Lifco. Grows EPS beautifully at 15–20%+."}
{"t":"MKL","n":"Markel Group","g":"The Capital Compounders","cy":false,"p":"$1892.82","mc":"$23.9B USD","fpe":15,"tpe":11.2,"peg":null,"eveb":null,"evfcf":-37.1,"dy":"0%","eg":"8%","eps":169.22,"bas":"Estimated compounder baseline NOTE: screener engine should be fPERG/tPERG as dividend yield is 0%; totalReturn routing appears to be a data pipeline error — re-run update-data to recalculate.","br":"-1%","bs":"10%","bu":"18%","en":"totalReturn","sc":1.5,"sg":"FAIL","sp":true,"r6":-1.1,"r1":-8.3,"n3":true,"ru":1,"rd":0,"su":45.4,"qcs":6,"cf":"medium","al":1880,"am":2085.4,"ah":2240,"roe":"11.8%","fy":"~-3%","nd":"Net cash","sh":0.2,"bc":"Markel's ongoing restructuring is bearing fruit as it exits lower-margin reinsurance to focus on highly profitable specialty lines. The 'Markel Ventures' private equity arm provides a robust, non-correlated earnings floor, driving margin expansion.","brc":"Restructuring execution risk remains. If the combined ratio slips above 95%, the compounding math breaks down and the historical premium multiple will face permanent compression.","cr":"Undergoing restructuring, exiting lower-margin reinsurance to boost ROE towards 15%."}
{"t":"MELI","n":"MercadoLibre","g":"Emerging Markets","cy":false,"p":"$1639.47","mc":"$83.1B USD","fpe":21.7,"tpe":41.7,"eveb":22,"evfcf":-35.9,"dy":"0%","eg":"21%","eps":39.35,"bas":"Aligned with deteriorating quantitative composite score and forecast revisions.","br":"28%","bs":"58%","bu":"113%","en":"fPERG","sc":1.09,"sg":"WAIT","sp":false,"r6":-33.6,"r1":-5.8,"n3":true,"ru":1,"rd":11,"su":-3.6,"qcs":-9.4,"cf":"high","al":2100,"am":2595.85,"ah":3500,"roe":"36.0%","fy":"~-3%","nd":"1.3x","sh":1.69,"bc":"Dismantling LatAm legacy banking/retail structures with massive customer acquisition and elite capital efficiency. High ROE and rapid EPS growth.","brc":"Highly correlated to local central bank rates and currency devaluation in emerging markets.","cr":"LatAm e-commerce and fintech dominant platform, 24-39% EPS growth expected."}
{"t":"META","n":"Meta Platforms","g":"Data & Software Monopolies","cy":true,"p":"$594.89","mc":"$1504.8B USD","fpe":16.6,"tpe":25.3,"peg":1.05,"eveb":14.8,"evfcf":64.4,"dy":"0%","eg":"15%","eps":23.5,"bas":"Balanced high AI CapEx intensity with successful monetization of WhatsApp/AI.","br":"14%","bs":"45%","bu":"92%","en":"fPERG","sc":1.11,"sg":"WAIT","nt":"(CYCLICAL EPS)","sp":false,"r6":-20,"r1":-9.5,"n3":true,"ru":3,"rd":2,"su":8,"dcf":283.74,"dd":-52,"qcs":-3.93,"cf":"high","al":676,"am":863.63,"ah":1144,"roe":"30.2%","fy":"~2%","nd":"0.0x","sh":1.28,"bc":"PEG of 1.05 suggests fair pricing for growth. AI-driven ad targeting improvements are accelerating revenue. WhatsApp monetization is still early. Massive buyback program supports EPS growth. Among the cheapest of the Mag 7.","brc":"Enormous CapEx on AI ($66-72B guidance) compresses FCF. Regulatory risk (antitrust, content moderation). Reality Labs remains a cash incinerator. If ad spending slows in a recession, revenue growth decelerates sharply.","cr":"Cheapest Mag 7 stock at PEG 1.05 with 22-26% revenue growth. 82% gross margin, 40-43% operating margins. Massive buybacks (~1.5% annual share reduction)."}
{"t":"NNI","n":"Nelnet","g":"The Capital Compounders","cy":true,"p":"$128.32","mc":"$4.6B USD","fpe":12.8,"tpe":10.9,"peg":null,"eveb":null,"dy":"1%","eg":"9%","eps":11.79,"bas":"Estimated compounder baseline","en":"tPERG","sc":1.59,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":1.7,"r1":-2.3,"n3":true,"ru":1,"rd":0,"su":-4.3,"qcs":10,"cf":"medium","roe":"11.6%","sh":0.28,"bc":"A successful transformation from a melting ice cube (legacy federal student loans) into a diversified tech and services conglomerate. Dominant in education tech and loan servicing (NDS) and highly adept at incubating hidden ventures. It operates as a deep value 'baby Berkshire.'","brc":"Highly complex, sum-of-the-parts business model makes it prone to being misunderstood and ignored by the market. Sensitivity to interest rates and regulatory changes in student loan financing.","cr":"Trading near or below adjusted Book Value. Retains ~68% of earnings for aggressive reinvestment."}
{"t":"PDD","n":"PDD Holdings","g":"Emerging Markets","cy":true,"p":"$102.61","mc":"$145.7B USD","fpe":7.1,"tpe":10.3,"eveb":null,"evfcf":2.1,"dy":"0%","eg":"18%","eps":9.99,"bas":"GAAP diluted EPS","br":"16%","bs":"44%","bu":"99%","en":"fPERG","sc":0.85,"sg":"PASS","nt":"Recent earnings miss (CYCLICAL EPS)","sp":true,"r6":-21.1,"r1":-2.6,"n3":false,"ru":0,"rd":1,"su":-15.8,"qcs":4.19,"cf":"medium","al":118.99,"am":147.95,"ah":204.22,"roe":"27.3%","fy":"~52%","nd":"Net cash","sh":1.47,"bc":"PDD Holdings runs the most efficient e-commerce operation in China (50%+ EBIT margin) while Temu is executing aggressive global expansion. If Temu captures 5% of global cross-border e-commerce, incremental revenue could be $40-60B by 2030. The trailing P/E of 9x prices in a permanent growth halt that fundamentals don't support.","brc":"Temu faces existential tariff risk: US de minimis exemption elimination and 145% tariffs make the sub-$15 product model unprofitable. Pinduoduo's domestic dominance may also erode as JD and Alibaba match its price-discovery algorithm.","cr":"Incredible growth and cash flow, but severe geopolitical and regulatory risks."}
{"t":"SE","n":"Sea Limited","g":"Emerging Markets","cy":true,"p":"$82.47","mc":"$48.8B USD","fpe":16.1,"tpe":32.7,"eveb":18,"evfcf":80.4,"dy":"0%","eg":"22%","eps":2.52,"bas":"GAAP diluted EPS","br":"21%","bs":"71%","bu":"136%","en":"fPERG","sc":0.76,"sg":"REJECTED","nt":"Consensus actively collapsing (analyst lag) (CYCLICAL EPS)","sp":true,"r6":-55.3,"r1":-25.6,"n3":false,"ru":0,"rd":4,"su":-5.5,"qcs":-3.55,"cf":"high","al":100,"am":140.71,"ah":195,"roe":"15.3%","fy":"~1%","nd":"Net cash","sh":1.42,"bc":"Sea Limited holds dominant positions across Southeast Asia in e-commerce (Shopee), digital financial services (SeaMoney), and gaming (Garena). SeaMoney's fintech penetration into underbanked EM populations mirrors the Nu Holdings playbook at scale. If Shopee achieves 15%+ EBIT margins at maturity — already visible in select markets — intrinsic value dramatically exceeds current pricing. The 22x exit P/E represents a modest premium for a dominant EM platform.","brc":"Garena is structurally declining as Free Fire ages and new title launches repeatedly disappoint. TikTok Shop is aggressively competing with Shopee across SEA markets with superior content monetization. SeaMoney faces rising NPL risk in EM credit. The -54% 6-month return reflects genuine fundamental deterioration, not pure macro.","cr":"Dominant position in Southeast Asia e-commerce and gaming, re-accelerating profitable growth."}
{"t":"TVK.TO","n":"TerraVest Industries","g":"The Capital Compounders","cy":true,"p":"C$140.69","mc":"C$3.1B","fpe":22.5,"tpe":33.4,"peg":null,"eveb":15.2,"evfcf":59.4,"dy":"1%","eg":"15%","eps":4.21,"bas":"Estimated compounder baseline","br":"22%","bs":"31%","bu":"43%","en":"fPERG","sc":1.52,"sg":"FAIL","nt":"(CYCLICAL EPS)","sp":true,"r6":1.5,"r1":-11.6,"n3":false,"ru":1,"rd":0,"su":40.1,"qcs":4.2,"cf":"medium","al":170,"am":182.83,"ah":200,"roe":"16.9%","fy":"~2%","nd":"3.5x","sh":0.64,"bc":"'The Constellation Software of Tanks and Trailers.' TerraVest is a premier mid-cap serial acquirer buying unglamorous, fragmented manufacturing assets (storage/transport for energy transition) at rock-bottom multiples and squeezing out high cash flow. High insider ownership and disciplined execution create massive compounding torque.","brc":"Integration risk as the pace of M&A accelerates. Also exposed to the cyclicality of the energy sector, even if its 'picks and shovels' approach mitigates direct commodity price risk.","cr":"Serial acquirer buying at 5-6x EBITDA and optimizing cash flow. Current valuation (33.8x trailing PE) leaves limited margin of safety."}
{"t":"UBER","n":"Uber Technologies","g":"Marketplace Platforms","cy":true,"p":"$73.08","mc":"$151.8B USD","fpe":17,"tpe":15.5,"eveb":24.7,"evfcf":24.6,"dy":"0%","eg":"18%","eps":4.73,"bas":"Factored in Waymo/Tesla disruption risk and terminal value uncertainty.","br":"-4%","bs":"42%","bu":"105%","en":"tPERG","sc":0.9,"sg":"PASS","nt":"Recent earnings miss (CYCLICAL EPS)","sp":true,"r6":-25.8,"r1":-2.3,"n3":false,"ru":1,"rd":2,"su":-81.9,"dcf":141.64,"dd":94,"qcs":5,"cf":"medium","al":70,"am":103.68,"ah":150,"roe":"39.9%","fy":"~4%","nd":"0.7x","sh":1.28,"bc":"Uber is the global rides and delivery platform with 7B+ annual trips. Autonomous vehicle integration (Waymo partnership) will structurally reduce driver costs as AVs scale — Uber's platform owner economics improve dramatically without a fleet. Delivery (Uber Eats) is approaching profitability as density increases. 20%+ EBITDA margin trajectory with operating leverage.","brc":"Waymo and Tesla's robotaxi fleets may eventually disintermediate Uber's driver network, compressing take-rates or rendering the platform redundant. Food delivery faces structural margin pressure with DoorDash competing aggressively on restaurant exclusives. Regulatory headwinds on gig worker classification (AB5-style laws) increase driver costs in key markets.","cr":"Stabilized business yielding margin expansion and forward EPS growth projections."}
{"t":"VIT-B.ST","n":"Vitec Software Group","g":"Serial Acquirers","cy":false,"p":"217 SEK","mc":"8.6B SEK","fpe":16.9,"tpe":19.8,"peg":null,"eveb":8.5,"evfcf":20.2,"dy":"2%","eg":"12%","eps":10.96,"bas":"Current ~22x is cyclical low; base assumes modest reversion, not return to bubble-era 50x avg","br":"77%","bs":"108%","bu":"169%","en":"fEVG","sc":0.69,"sg":"PASS","sp":false,"r6":-34.4,"r1":-9.2,"n3":true,"ru":3,"rd":0,"su":165.6,"qcs":4.17,"cf":"medium","al":380,"am":447.86,"ah":580,"roe":"8.9%","fy":"~7%","nd":"2.0x","sh":2.76,"bc":"37% selloff creates a rare buying opportunity in a proven compounder. FCF yield of 5.7% is high for a quality serial acquirer. Average price target implies 75% upside. Compressed VMS valuations mean Vitec can acquire targets at even better returns. CSU-style playbook in Europe with decades of runway.","brc":"Company-level ROIC (~6%) is low — the 30% figure only applies to incremental M&A capital. Growth has temporarily stalled. European software spending has slowed. Recent equity raises dilute shareholders.","cr":"Closest Nordic equivalent to Constellation Software. Perpetual owner of 45 VMS businesses across 20+ verticals. Acquisition ROIC ~30% is elite. Stock down 37% = potential entry. But company-level ROIC is depressed (~6%). fEVG threshold is 0.60 (stricter than fPERG 1.0), so score 0.74 correctly FAILs."}
{"t":"WSO","n":"Watsco","g":"Capital Compounders","cy":false,"p":"$367.15","mc":"$14.9B USD","fpe":26.1,"tpe":29.9,"eveb":19.1,"evfcf":48.5,"dy":"3%","eg":"10%","eps":12.26,"bas":"Non-GAAP EPS","br":"1%","bs":"16%","bu":"32%","en":"fPERG","sc":2.64,"sg":"FAIL","sp":true,"r6":-7.8,"r1":-10.6,"n3":false,"ru":1,"rd":5,"su":-11,"qcs":-3.34,"cf":"high","al":359,"am":415.17,"ah":475,"roe":"18.7%","fy":"~2%","nd":"Net cash","sh":0.36,"bc":"Watsco is the dominant HVAC equipment distributor with a captive network of ~700 locations and a fragmented, 100,000-contractor customer base that has high switching costs. The mandated refrigerant transition (R-410A to R-454B by 2025) creates a multi-year equipment replacement super-cycle as contractors upgrade installed base.","brc":"HVAC equipment spending is tied to new construction and replacement cycles. A housing market slowdown reduces new construction volume. The refrigerant transition cycle may normalize by 2026, and gross margins could compress as new-format competitors (Carrier, Lennox direct distribution) expand.","cr":"HVAC distribution serial acquirer. Massive dividend growth, zero debt, ruthless efficiency."}
```

---

## Instructions

Analyze each of the 24 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group
2. **Peer comparison anomalies**
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch
