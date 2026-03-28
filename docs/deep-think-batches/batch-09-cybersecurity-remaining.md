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

## Batch 09/10: Cybersecurity & Remaining (7 stocks)

> **Batch-specific guidance**: Cybersecurity stocks with premium multiples. Pay attention to: (a) premium multiple calibration for Rule-of-40 SaaS, (b) GAAP vs non-GAAP profitability, (c) SBC dilution impact, (d) competitive positioning within the cybersecurity platform consolidation wave.

### Stock Data

```jsonl
{"t":"CRWD","n":"CrowdStrike Holdings","g":"Cybersecurity","cy":false,"p":"$385.86","mc":"$97.9B USD","fpe":62.5,"tpe":null,"peg":null,"eveb":null,"evfcf":58.3,"dy":"0%","eg":"32%","eps":3.79,"bas":"Non-GAAP adjusted EPS (excl SBC); hypergrowth premium; bear assumes significant PE compression","br":"-5%","bs":"27%","bu":"83%","en":"fPERG","sc":2.02,"sg":"FAIL","sp":true,"r6":-19.8,"r1":1.2,"n3":false,"ru":23,"rd":6,"su":1.6,"qcs":5.27,"cf":"medium","al":368,"am":490.48,"ah":706,"roe":"-4.1%","fy":"~2%","nd":"Net cash","sh":0.77,"bc":"Best-in-class endpoint security expanding into 28+ modules. ~62% Rule of 40 score is elite. Customers adopting 5+ modules (from 1-2 at entry). AI-native Falcon platform has data advantage from largest endpoint install base. 120%+ net retention.","brc":"55x forward non-GAAP PE is extremely demanding. July 2024 global outage damaged brand trust. Still GAAP unprofitable. High SBC dilution. Competition from SentinelOne, Microsoft, and PANW expanding into endpoint.","cr":"Leading endpoint security platform. 30-35% revenue growth at scale. Module adoption accelerating. But premium valuation and July 2024 outage reputational overhang."}
{"t":"FTNT","n":"Fortinet","g":"Cybersecurity","cy":false,"p":"$78.89","mc":"$58.7B USD","fpe":23.8,"tpe":32.6,"eveb":25.1,"evfcf":32,"dy":"0%","eg":"15%","eps":2.42,"bas":"Non-GAAP EPS","br":"-19%","bs":"13%","bu":"52%","en":"fPERG","sc":1.57,"sg":"FAIL","sp":true,"r6":-6.4,"r1":-0.4,"n3":false,"ru":2,"rd":2,"su":9,"qcs":4.76,"cf":"high","al":64,"am":89.06,"ah":120,"roe":"135.7%","fy":"~3%","nd":"Net cash","sh":0.27,"bc":"Fortinet's billings cycle has fully recovered from the COVID-era pull-forward with accelerating deferred revenue conversion. Its Secure Networking (SASE/SD-WAN) platform is the most price-competitive enterprise security offering, enabling net new customer wins in mid-market. FCF margins approaching 35% with minimal share dilution.","brc":"Fortinet grew at 50%+ in 2021-22 due to a pull-forward. The hangover created two years of below-consensus billings growth. CrowdStrike and Palo Alto are aggressively platformizing into Fortinet's core NGFW market. At 25x forward PE, execution on the billing recovery needs to be consistent.","cr":"Hardware+software security cycles at much cheaper P/E than CRWD/PANW. Buy on billing cycle panics."}
{"t":"NET","n":"Cloudflare","g":"Cybersecurity","cy":false,"p":"$218","mc":"$76.7B USD","fpe":150.9,"eveb":null,"evfcf":196.2,"dy":"0%","eg":"27%","eps":1.12,"bas":"2026E non-GAAP adjusted EPS; premium edge network and security multiple","br":"-38%","bs":"7%","bu":"38%","en":"fPERG","sc":5.67,"sg":"FAIL","sp":true,"r6":0.8,"r1":24.8,"n3":false,"ru":5,"rd":13,"su":3.2,"qcs":0.76,"cf":"low","al":135,"am":232.43,"ah":300,"roe":"-8.2%","fy":"~1%","nd":"Net cash","sh":-0.09,"bc":"Unavoidable tollbooth for internet traffic and edge security. Expanding successfully into AI-agent infrastructure.","brc":"High forward multiple leaves little room for error; requires sustained hyper-growth to maintain valuation.","cr":"Edge network and security platform with ~27% adjusted EPS growth, but still one of the market's richest software valuations."}
{"t":"PANW","n":"Palo Alto Networks","g":"Cybersecurity","cy":false,"p":"$153.22","mc":"$125.0B USD","fpe":38.6,"tpe":85.6,"peg":null,"eveb":78.7,"evfcf":42.3,"dy":"0%","eg":"20%","eps":3.68,"bas":"Non-GAAP adjusted EPS (excl SBC); platform leader premium; bear assumes deceleration","br":"-26%","bs":"36%","bu":"73%","en":"fPERG","sc":2.03,"sg":"FAIL","sp":true,"r6":-24.3,"r1":2.6,"n3":false,"ru":7,"rd":8,"su":9.9,"qcs":2.27,"cf":"medium","al":114,"am":207.75,"ah":265,"roe":"16.3%","fy":"~2%","nd":"Net cash","sh":0.53,"bc":"Platformization strategy is working — customers consolidating 5-10 security tools onto PANW. Best-in-class FCF margins (~38%). Expanding TAM across network, cloud, and SOC security. AI-native security products add growth vectors. Dominant brand with enterprise trust.","brc":"Platformization involves free product periods that depress near-term revenue. 45x trailing PE is premium. Competition from CRWD and ZS in specific segments. Large cap limits upside magnitude. GAAP profitability still low due to SBC.","cr":"Largest pure-play cybersecurity company. Platformization strategy consolidating security spend. 17-22% growth with improving margins. Premium valuation."}
{"t":"RBRK","n":"Rubrik","g":"Cybersecurity","cy":false,"p":"$47.18","mc":"$9.5B USD","fpe":80.4,"eveb":-28.2,"evfcf":23,"dy":"0%","eg":"0%","bas":"Pre-profit cybersecurity platform; track ARR, FCF and analyst target instead of P/E until earnings normalize","br":"36%","bs":"84%","bu":"167%","en":"totalReturn","sc":999,"sg":"FAIL","sp":false,"r6":-42.6,"r1":-13.2,"n3":true,"ru":7,"rd":5,"su":136.9,"qcs":12.92,"cf":"low","al":64,"am":86.71,"ah":126,"fy":"~4%","nd":"Net cash","sh":1.59,"bc":"Zero-trust data security is becoming non-negotiable. 48% YoY revenue growth and recently inflected to profitability and positive FCF.","brc":"Rubrik faces intense competition from Cohesity (now merged with Veritas), Commvault, Veeam, and Zerto in data protection. The path to sustained GAAP profitability requires continued ARR growth at high SBC dilution. Microsoft Backup and AWS native backup services could commoditize the lower end of the market.","cr":"Fast-growing data security platform, but still too early for a rational P/E-based underwriting model."}
{"t":"RTX","n":"RTX Corporation","g":"Industrial Monopolies","cy":false,"p":"$195","mc":"$262.5B USD","fpe":26,"tpe":39.4,"eveb":20.1,"evfcf":45.9,"dy":"1%","eg":"10%","eps":4.95,"bas":"Non-GAAP EPS","br":"-7%","bs":"12%","bu":"24%","en":"fPERG","sc":2.52,"sg":"FAIL","sp":true,"r6":19.4,"r1":-1.3,"n3":false,"ru":2,"rd":1,"su":5.3,"qcs":5.24,"cf":"high","al":179,"am":217.16,"ah":240,"roe":"11.0%","fy":"~2%","nd":"2.2x","sh":0.14,"bc":"Commercial aerospace rebounds strongly while defense budgets globally swell, driving long-term revenue backlogs.","brc":"Supply chain disruptions or engine manufacturing defects lead to costly recalls and lower margins.","cr":"Major defense contractor and aerospace manufacturer with massive backlog, benefiting from global defense spending cycles and commercial aerospace recovery. EPS growth modeled to be auto-derived from analyst consensus."}
{"t":"ZS","n":"Zscaler","g":"Cybersecurity","cy":false,"p":"$139.44","mc":"$22.4B USD","fpe":30.4,"tpe":null,"peg":null,"eveb":-305.4,"evfcf":20.3,"dy":"0%","eg":"24%","eps":4,"bas":"Non-GAAP adjusted EPS (excl SBC); growth premium; bear assumes deceleration + compression","br":"18%","bs":"68%","bu":"140%","en":"fPERG","sc":1.26,"sg":"FAIL","sp":false,"r6":-52.7,"r1":-16.7,"n3":true,"ru":36,"rd":6,"su":12.6,"qcs":14.77,"cf":"medium","al":165,"am":234.79,"ah":335,"roe":"-3.6%","fy":"~5%","nd":"Net cash","sh":1.62,"bc":"Leading zero-trust security platform replacing legacy firewalls. 125%+ net retention rate. TAM expanding as enterprises shift to cloud-native security. Rule of 40 score of ~55%. AI-powered threat detection adds differentiation. Only pure-play zero-trust at scale.","brc":"Still GAAP unprofitable. High SBC dilution. Competition from PANW and CRWD expanding into SASE. CEO transition risk. 40x forward non-GAAP PE is demanding. Customer concentration in large enterprises.","cr":"Pioneer in zero-trust cloud security. 25-35% revenue growth with expanding margins. But elevated non-GAAP PE and execution risk in competitive market."}
```

---

## Instructions

Analyze each of the 7 stocks above using the 6-step framework. For each stock, produce the structured output block. After all individual analyses, add a **Batch Summary** section noting:

1. **Systemic patterns** within this group
2. **Peer comparison anomalies**
3. **Engine assignment errors** specific to this asset class
4. **Top 3 most mispriced** stocks in this batch
