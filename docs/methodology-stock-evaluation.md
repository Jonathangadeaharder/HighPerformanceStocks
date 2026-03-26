# In-Depth Stock Methodology Evaluation

This document goes stock-for-stock through the data to analyze how our quantitative methodology values each asset, acknowledging where it is highly accurate and where it may introduce flawed heuristics or systemic biases.

## Deep Cyclicals

**Methodology Context:** Cyclical stocks naturally violate basic Forward P/E assumptions because their earnings are highly volatile. They trade at low multiples at the peak (when earnings are highest) and high multiples at the trough.

**How Proper is the Valuation Baseline?** Partially Flawed. The system applies fPERG, which can trigger completely false PASS signals during cyclical peaks. The UI warning handles the human element, but the quantitative engine doesn't adjust normalized cycle earnings.

### 0700.HK (Tencent)

- **Screener:** fPERG (Score: 0.91) | **Signal:** PASS | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **No/Risk.** 0700.HK is evaluated using `fPERG` with 16%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.91 with 49% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ALAB (Astera Labs)

- **Screener:** fPERG (Score: 1.08) | **Signal:** WAIT | **Implied Upside:** 71%
- **Metrics:** Div Yield 0, EPS Growth 35%
- _Properly Valued?_ **No/Risk.** ALAB is evaluated using `fPERG` with 35%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.08 with 71% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### AMAT (Applied Materials)

- **Screener:** fPERG (Score: 1.03) | **Signal:** WAIT | **Implied Upside:** 17%
- **Metrics:** Div Yield 0, EPS Growth 25%
- _Properly Valued?_ **No/Risk.** AMAT is evaluated using `fPERG` with 25%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.03 with 17% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### AMD (Advanced Micro Devices)

- **Screener:** fPERG (Score: 0.6) | **Signal:** PASS | **Implied Upside:** 44%
- **Metrics:** Div Yield 0, EPS Growth 35%
- _Properly Valued?_ **No/Risk.** AMD is evaluated using `fPERG` with 35%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.6 with 44% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ANET (Arista Networks)

- **Screener:** fPERG (Score: 1.48) | **Signal:** FAIL | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 21%
- _Properly Valued?_ **No/Risk.** ANET is evaluated using `fPERG` with 21%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.48 with 34% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### APO (Apollo Global Management)

- **Screener:** fANIG (Score: 0.8) | **Signal:** WAIT | **Implied Upside:** 41%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** APO is evaluated using `fANIG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.8 with 41% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### APP (AppLovin)

- **Screener:** fPERG (Score: 0.7) | **Signal:** PASS | **Implied Upside:** 53%
- **Metrics:** Div Yield 0, EPS Growth 30%
- _Properly Valued?_ **No/Risk.** APP is evaluated using `fPERG` with 30%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.7 with 53% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ARES (Ares Management)

- **Screener:** totalReturn (Score: 0.69) | **Signal:** REJECTED | **Implied Upside:** 55%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **No/Risk.** ARES is evaluated using `totalReturn` with 20%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.69 with 55% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ASML (ASML Holding)

- **Screener:** fPERG (Score: 1.21) | **Signal:** FAIL | **Implied Upside:** 9%
- **Metrics:** Div Yield 0, EPS Growth 26%
- _Properly Valued?_ **No/Risk.** ASML is evaluated using `fPERG` with 26%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.21 with 9% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### AVGO (Broadcom)

- **Screener:** fPERG (Score: 0.56) | **Signal:** PASS | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 35%
- _Properly Valued?_ **No/Risk.** AVGO is evaluated using `fPERG` with 35%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.56 with 49% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### BABA (Alibaba)

- **Screener:** tPERG (Score: 1.24) | **Signal:** REJECTED | **Implied Upside:** 60%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **No/Risk.** BABA is evaluated using `tPERG` with 13%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.24 with 60% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### BKNG (Booking Holdings)

- **Screener:** fPERG (Score: 0.86) | **Signal:** PASS | **Implied Upside:** 35%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **No/Risk.** BKNG is evaluated using `fPERG` with 17%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.86 with 35% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### BN (Brookfield Corporation)

- **Screener:** fPERG (Score: 0.91) | **Signal:** PASS | **Implied Upside:** 39%
- **Metrics:** Div Yield 0, EPS Growth 16.5%
- _Properly Valued?_ **No/Risk.** BN is evaluated using `fPERG` with 16.5%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.91 with 39% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### BRK.B (Berkshire Hathaway)

- **Screener:** tPERG (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 8%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **No/Risk.** BRK.B is evaluated using `tPERG` with 10%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.5 with 8% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### CCJ (Cameco)

- **Screener:** fPERG (Score: 3.79) | **Signal:** FAIL | **Implied Upside:** 20%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** CCJ is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 3.79 with 20% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### CRDO (Credo Technology Group)

- **Screener:** fPERG (Score: 0.76) | **Signal:** PASS | **Implied Upside:** 91%
- **Metrics:** Div Yield 0, EPS Growth 28%
- _Properly Valued?_ **No/Risk.** CRDO is evaluated using `fPERG` with 28%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.76 with 91% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### DHR (Danaher Corporation)

- **Screener:** fEVG (Score: 1.31) | **Signal:** FAIL | **Implied Upside:** 39%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **No/Risk.** DHR is evaluated using `fEVG` with 14%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.31 with 39% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### EQT.ST (EQT AB)

- **Screener:** fFREG (Score: 1.04) | **Signal:** WAIT | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **No/Risk.** EQT.ST is evaluated using `fFREG` with 20%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.04 with 49% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ET (Energy Transfer)

- **Screener:** totalReturn (Score: 0.71) | **Signal:** PASS | **Implied Upside:** 15%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **No/Risk.** ET is evaluated using `totalReturn` with 10%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.71 with 15% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### FFH.TO (Fairfax Financial)

- **Screener:** tPERG (Score: 0.86) | **Signal:** FAIL | **Implied Upside:** 14%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **No/Risk.** FFH.TO is evaluated using `tPERG` with 17%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.86 with 14% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### FNV (Franco-Nevada)

- **Screener:** fCFG (Score: 2.83) | **Signal:** FAIL | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** FNV is evaluated using `fCFG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.83 with 34% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### GOOGL (Alphabet)

- **Screener:** fPERG (Score: 1.87) | **Signal:** FAIL | **Implied Upside:** 25%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** GOOGL is evaluated using `fPERG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.87 with 25% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### HEI.A (HEICO Corp)

- **Screener:** fEVG (Score: 1.61) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **No/Risk.** HEI.A is evaluated using `fEVG` with 16%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.61 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### HEI (HEICO Corporation)

- **Screener:** fEVG (Score: 1.79) | **Signal:** FAIL | **Implied Upside:** 36%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** HEI is evaluated using `fEVG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.79 with 36% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### HWM (Howmet Aerospace)

- **Screener:** fPERG (Score: 2.72) | **Signal:** FAIL | **Implied Upside:** 21%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** HWM is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.72 with 21% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### IBKR (Interactive Brokers)

- **Screener:** fPERG (Score: 1.59) | **Signal:** FAIL | **Implied Upside:** 21%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** IBKR is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.59 with 21% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### ICLR (ICON plc)

- **Screener:** fPERG (Score: 1.06) | **Signal:** WAIT | **Implied Upside:** 40%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **No/Risk.** ICLR is evaluated using `fPERG` with 14%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.06 with 40% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### INVE-B.ST (Investor AB)

- **Screener:** fPERG (Score: 2.06) | **Signal:** FAIL | **Implied Upside:** 7%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **No/Risk.** INVE-B.ST is evaluated using `fPERG` with 10%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.06 with 7% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### IT (Gartner)

- **Screener:** fPERG (Score: 1.23) | **Signal:** FAIL | **Implied Upside:** 22%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** IT is evaluated using `fPERG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.23 with 22% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### KAP.IL (Kazatomprom)

- **Screener:** totalReturn (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **No/Risk.** KAP.IL is evaluated using `totalReturn` with 8%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.5 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### KKR (KKR & Co.)

- **Screener:** fANIG (Score: 0.94) | **Signal:** REJECTED | **Implied Upside:** 56%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **No/Risk.** KKR is evaluated using `fANIG` with 20%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.94 with 56% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### KNSL (Kinsale Capital)

- **Screener:** fPERG (Score: 0.74) | **Signal:** REJECTED | **Implied Upside:** 29%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **No/Risk.** KNSL is evaluated using `fPERG` with 20%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.74 with 29% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### LNG (Cheniere Energy)

- **Screener:** totalReturn (Score: 3.43) | **Signal:** FAIL | **Implied Upside:** -5%
- **Metrics:** Div Yield 0, EPS Growth 4%
- _Properly Valued?_ **No/Risk.** LNG is evaluated using `totalReturn` with 4%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 3.43 with -5% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### LRCX (Lam Research)

- **Screener:** fPERG (Score: 2.28) | **Signal:** FAIL | **Implied Upside:** 20%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** LRCX is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.28 with 20% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### MCO (Moody's)

- **Screener:** fPERG (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 25%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** MCO is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.5 with 25% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### MEDP (Medpace)

- **Screener:** fPERG (Score: 1.93) | **Signal:** FAIL | **Implied Upside:** 8%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** MEDP is evaluated using `fPERG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.93 with 8% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### META (Meta Platforms)

- **Screener:** fPERG (Score: 1.1) | **Signal:** WAIT | **Implied Upside:** 46%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** META is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.1 with 46% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### MRVL (Marvell Technology)

- **Screener:** fPERG (Score: 0.54) | **Signal:** PASS | **Implied Upside:** 35%
- **Metrics:** Div Yield 0, EPS Growth 30%
- _Properly Valued?_ **No/Risk.** MRVL is evaluated using `fPERG` with 30%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.54 with 35% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### MU (Micron Technology)

- **Screener:** fPERG (Score: 1.39) | **Signal:** FAIL | **Implied Upside:** -1%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** MU is evaluated using `fPERG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.39 with -1% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### NNI (Nelnet)

- **Screener:** tPERG (Score: 1.59) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 9%
- _Properly Valued?_ **No/Risk.** NNI is evaluated using `tPERG` with 9%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.59 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### NU (Nu Holdings)

- **Screener:** fPERG (Score: 0.54) | **Signal:** PASS | **Implied Upside:** 45%
- **Metrics:** Div Yield 0, EPS Growth 28%
- _Properly Valued?_ **No/Risk.** NU is evaluated using `fPERG` with 28%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.54 with 45% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### NVDA (NVIDIA)

- **Screener:** fPERG (Score: 0.56) | **Signal:** PASS | **Implied Upside:** 53%
- **Metrics:** Div Yield 0, EPS Growth 29%
- _Properly Valued?_ **No/Risk.** NVDA is evaluated using `fPERG` with 29%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.56 with 53% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### OWL (Blue Owl Capital)

- **Screener:** totalReturn (Score: 0.48) | **Signal:** REJECTED | **Implied Upside:** 74%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** OWL is evaluated using `totalReturn` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.48 with 74% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### PDD (PDD Holdings)

- **Screener:** fPERG (Score: 0.83) | **Signal:** REJECTED | **Implied Upside:** 54%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** PDD is evaluated using `fPERG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.83 with 54% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### RGLD (Royal Gold)

- **Screener:** fCFG (Score: 2.36) | **Signal:** FAIL | **Implied Upside:** 52%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **No/Risk.** RGLD is evaluated using `fCFG` with 12%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.36 with 52% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### SE (Sea Limited)

- **Screener:** fPERG (Score: 0.74) | **Signal:** REJECTED | **Implied Upside:** 75%
- **Metrics:** Div Yield 0, EPS Growth 22%
- _Properly Valued?_ **No/Risk.** SE is evaluated using `fPERG` with 22%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.74 with 75% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### SMSN.IL (Samsung Electronics)

- **Screener:** tPERG (Score: 3.78) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 9%
- _Properly Valued?_ **No/Risk.** SMSN.IL is evaluated using `tPERG` with 9%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 3.78 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### SPGI (S&P Global)

- **Screener:** fPERG (Score: 1.24) | **Signal:** FAIL | **Implied Upside:** 27%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** SPGI is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.24 with 27% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TDG (TransDigm Group)

- **Screener:** fEVG (Score: 1.1) | **Signal:** WAIT | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** TDG is evaluated using `fEVG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.1 with 34% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TFPM (Triple Flag Precious Metals)

- **Screener:** totalReturn (Score: 1.33) | **Signal:** FAIL | **Implied Upside:** 43%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **No/Risk.** TFPM is evaluated using `totalReturn` with 8%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.33 with 43% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TPL (Texas Pacific Land)

- **Screener:** fPERG (Score: 1) | **Signal:** PASS | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** TPL is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TSM (TSMC)

- **Screener:** fPERG (Score: 1) | **Signal:** WAIT | **Implied Upside:** 30%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** TSM is evaluated using `fPERG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1 with 30% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TVK.TO (TerraVest Industries)

- **Screener:** fPERG (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 33%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** TVK.TO is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.5 with 33% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### TW (Tradeweb)

- **Screener:** fPERG (Score: 1.81) | **Signal:** FAIL | **Implied Upside:** 6%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** TW is evaluated using `fPERG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.81 with 6% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### UBER (Uber Technologies)

- **Screener:** tPERG (Score: 0.9) | **Signal:** PASS | **Implied Upside:** 42%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **No/Risk.** UBER is evaluated using `tPERG` with 18%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 0.9 with 42% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### URI (United Rentals)

- **Screener:** fPERG (Score: 1.65) | **Signal:** FAIL | **Implied Upside:** 39%
- **Metrics:** Div Yield 0, EPS Growth 9%
- _Properly Valued?_ **No/Risk.** URI is evaluated using `fPERG` with 9%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.65 with 39% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### VNOM (Viper Energy)

- **Screener:** totalReturn (Score: N/A) | **Signal:** FAIL | **Implied Upside:** 10%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **No/Risk.** VNOM is evaluated using `totalReturn` with 8%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of N/A with 10% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### VRT (Vertiv Holdings)

- **Screener:** fPERG (Score: 1.15) | **Signal:** WAIT | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 30%
- _Properly Valued?_ **No/Risk.** VRT is evaluated using `fPERG` with 30%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 1.15 with 0% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

### WPM (Wheaton Precious Metals)

- **Screener:** fCFG (Score: 2.74) | **Signal:** FAIL | **Implied Upside:** 58%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **No/Risk.** WPM is evaluated using `fCFG` with 15%% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of 2.74 with 58% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.

## High Yield / Income Equities (>=5% Div)

**Methodology Context:** Equities where total return is primarily driven by capital distributions rather than internal compounding (REITs, MLPs, BDCs). Routers direct these to the `totalReturn` engine.

**How Proper is the Valuation Baseline?** Mostly Proper. With the dividend double-counting recently fixed, the `totalReturn` engine isolates yield + moderate growth against the ETF hurdle. Very robust.

### ARES (Ares Management)

- **Screener:** totalReturn (Score: 0.69) | **Signal:** REJECTED | **Implied Upside:** 55%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, ARES's 55% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### EPD (Enterprise Products Partners)

- **Screener:** totalReturn (Score: 1) | **Signal:** PASS | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 6%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, EPD's 0% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### ET (Energy Transfer)

- **Screener:** totalReturn (Score: 0.71) | **Signal:** PASS | **Implied Upside:** 15%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, ET's 15% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### KAP.IL (Kazatomprom)

- **Screener:** totalReturn (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, KAP.IL's 0% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### KYCCF (Keyence Corporation)

- **Screener:** totalReturn (Score: 1.33) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, KYCCF's 0% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### LNG (Cheniere Energy)

- **Screener:** totalReturn (Score: 3.43) | **Signal:** FAIL | **Implied Upside:** -5%
- **Metrics:** Div Yield 0, EPS Growth 4%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, LNG's -5% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### MKL (Markel Group)

- **Screener:** totalReturn (Score: 1.5) | **Signal:** FAIL | **Implied Upside:** 10%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, MKL's 10% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### NVO (Novo Nordisk)

- **Screener:** totalReturn (Score: 0.67) | **Signal:** REJECTED | **Implied Upside:** 29%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, NVO's 29% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### OWL (Blue Owl Capital)

- **Screener:** totalReturn (Score: 0.48) | **Signal:** REJECTED | **Implied Upside:** 74%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, OWL's 74% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### RBRK (Rubrik)

- **Screener:** totalReturn (Score: N/A) | **Signal:** FAIL | **Implied Upside:** 77%
- **Metrics:** Div Yield 0, EPS Growth 0%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, RBRK's 77% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### RXRX (Recursion Pharmaceuticals)

- **Screener:** totalReturn (Score: N/A) | **Signal:** NO_DATA | **Implied Upside:** 101%
- **Metrics:** Div Yield 0, EPS Growth 0%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, RXRX's 101% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### TFPM (Triple Flag Precious Metals)

- **Screener:** totalReturn (Score: 1.33) | **Signal:** FAIL | **Implied Upside:** 43%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, TFPM's 43% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

### VNOM (Viper Energy)

- **Screener:** totalReturn (Score: N/A) | **Signal:** FAIL | **Implied Upside:** 10%
- **Metrics:** Div Yield 0, EPS Growth 8%
- _Properly Valued?_ **Yes.** Valued on `totalReturn` because of its 0% yield. Because we removed the dividend double-counting flaw, VNOM's 10% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.

## Hyper-Growth Compounders (>=20% EPS Growth)

**Methodology Context:** Secular growth stories usually priced at massive premiums. Evaluated using fPERG or fANIG.

**How Proper is the Valuation Baseline?** Fair but Strict. The engine relies heavily on growth materializing. Now that the Overpriced cliff is removed, elite compounders can properly stay in Deploy/Wait rather than defaulting to Fail.

### AMZN (Amazon)

- **Screener:** fPERG (Score: 1.06) | **Signal:** WAIT | **Implied Upside:** 36%
- **Metrics:** Div Yield 0, EPS Growth 22%
- _Properly Valued?_ **Mostly.** With a massive 22%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If AMZN misses its 22%% trajectory by even a few points next quarter, the 1.06 multiple will aggressively re-rate downward. The 36% upside is highly fragile.

### ARGX (argenx SE)

- **Screener:** fPERG (Score: 0.7) | **Signal:** PASS | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 33%
- _Properly Valued?_ **Mostly.** With a massive 33%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If ARGX misses its 33%% trajectory by even a few points next quarter, the 0.7 multiple will aggressively re-rate downward. The 49% upside is highly fragile.

### CDNS (Cadence Design Systems)

- **Screener:** fPERG (Score: 1.45) | **Signal:** FAIL | **Implied Upside:** 31%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Mostly.** With a massive 20%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If CDNS misses its 20%% trajectory by even a few points next quarter, the 1.45 multiple will aggressively re-rate downward. The 31% upside is highly fragile.

### CRWD (CrowdStrike Holdings)

- **Screener:** fPERG (Score: 2.15) | **Signal:** FAIL | **Implied Upside:** 20%
- **Metrics:** Div Yield 0, EPS Growth 32%
- _Properly Valued?_ **Mostly.** With a massive 32%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If CRWD misses its 32%% trajectory by even a few points next quarter, the 2.15 multiple will aggressively re-rate downward. The 20% upside is highly fragile.

### DDOG (Datadog)

- **Screener:** fPERG (Score: 2.42) | **Signal:** FAIL | **Implied Upside:** 45%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Mostly.** With a massive 20%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If DDOG misses its 20%% trajectory by even a few points next quarter, the 2.42 multiple will aggressively re-rate downward. The 45% upside is highly fragile.

### EXEL (Exelixis)

- **Screener:** fPERG (Score: 0.52) | **Signal:** FAIL | **Implied Upside:** 13%
- **Metrics:** Div Yield 0, EPS Growth 21%
- _Properly Valued?_ **Mostly.** With a massive 21%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If EXEL misses its 21%% trajectory by even a few points next quarter, the 0.52 multiple will aggressively re-rate downward. The 13% upside is highly fragile.

### HALO (Halozyme Therapeutics)

- **Screener:** fPERG (Score: 0.31) | **Signal:** PASS | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Mostly.** With a massive 20%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If HALO misses its 20%% trajectory by even a few points next quarter, the 0.31 multiple will aggressively re-rate downward. The 34% upside is highly fragile.

### LLY (Eli Lilly)

- **Screener:** fPERG (Score: 0.9) | **Signal:** PASS | **Implied Upside:** 31%
- **Metrics:** Div Yield 0, EPS Growth 24%
- _Properly Valued?_ **Mostly.** With a massive 24%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If LLY misses its 24%% trajectory by even a few points next quarter, the 0.9 multiple will aggressively re-rate downward. The 31% upside is highly fragile.

### MELI (MercadoLibre)

- **Screener:** fPERG (Score: 1.08) | **Signal:** WAIT | **Implied Upside:** 61%
- **Metrics:** Div Yield 0, EPS Growth 21%
- _Properly Valued?_ **Mostly.** With a massive 21%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If MELI misses its 21%% trajectory by even a few points next quarter, the 1.08 multiple will aggressively re-rate downward. The 61% upside is highly fragile.

### NET (Cloudflare)

- **Screener:** fPERG (Score: 5.76) | **Signal:** FAIL | **Implied Upside:** 5%
- **Metrics:** Div Yield 0, EPS Growth 27%
- _Properly Valued?_ **Mostly.** With a massive 27%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If NET misses its 27%% trajectory by even a few points next quarter, the 5.76 multiple will aggressively re-rate downward. The 5% upside is highly fragile.

### NOW (ServiceNow)

- **Screener:** fPERG (Score: 1.03) | **Signal:** WAIT | **Implied Upside:** 72%
- **Metrics:** Div Yield 0, EPS Growth 21%
- _Properly Valued?_ **Mostly.** With a massive 21%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If NOW misses its 21%% trajectory by even a few points next quarter, the 1.03 multiple will aggressively re-rate downward. The 72% upside is highly fragile.

### PANW (Palo Alto Networks)

- **Screener:** fPERG (Score: 2.18) | **Signal:** FAIL | **Implied Upside:** 26%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Mostly.** With a massive 20%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If PANW misses its 20%% trajectory by even a few points next quarter, the 2.18 multiple will aggressively re-rate downward. The 26% upside is highly fragile.

### PLTR (Palantir)

- **Screener:** fPERG (Score: 2.55) | **Signal:** FAIL | **Implied Upside:** 24%
- **Metrics:** Div Yield 0, EPS Growth 35%
- _Properly Valued?_ **Mostly.** With a massive 35%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If PLTR misses its 35%% trajectory by even a few points next quarter, the 2.55 multiple will aggressively re-rate downward. The 24% upside is highly fragile.

### SHOP (Shopify)

- **Screener:** fPERG (Score: 2.08) | **Signal:** FAIL | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 26%
- _Properly Valued?_ **Mostly.** With a massive 26%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If SHOP misses its 26%% trajectory by even a few points next quarter, the 2.08 multiple will aggressively re-rate downward. The 34% upside is highly fragile.

### TOI.V (Topicus.com)

- **Screener:** fEVG (Score: 1.1) | **Signal:** WAIT | **Implied Upside:** 48%
- **Metrics:** Div Yield 0, EPS Growth 25%
- _Properly Valued?_ **Mostly.** With a massive 25%% growth rate, it skipped the flawed "Fail" cliff. However, the `fEVG` formula projects linear compound growth. If TOI.V misses its 25%% trajectory by even a few points next quarter, the 1.1 multiple will aggressively re-rate downward. The 48% upside is highly fragile.

### ZS (Zscaler)

- **Screener:** fPERG (Score: 1.41) | **Signal:** FAIL | **Implied Upside:** 51%
- **Metrics:** Div Yield 0, EPS Growth 24%
- _Properly Valued?_ **Mostly.** With a massive 24%% growth rate, it skipped the flawed "Fail" cliff. However, the `fPERG` formula projects linear compound growth. If ZS misses its 24%% trajectory by even a few points next quarter, the 1.41 multiple will aggressively re-rate downward. The 51% upside is highly fragile.

## Value Traps / Falling Knives (Failed Stabilization)

**Methodology Context:** Equities experiencing rapid >20-30% price depreciation within the last 6 months.

**How Proper is the Valuation Baseline?** Perfected. Now explicitly routed to `WAIT` regardless of the falsely-inflated upside derived from outdated analyst targets.

### 0700.HK (Tencent)

- **Screener:** fPERG (Score: 0.91) | **Signal:** PASS | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **Yes (due to fix).** 0700.HK models an implausible 49% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### ADYEN.AS (Adyen N.V.)

- **Screener:** fPERG (Score: 1.01) | **Signal:** WAIT | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Yes (due to fix).** ADYEN.AS models an implausible 0% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### BABA (Alibaba)

- **Screener:** tPERG (Score: 1.24) | **Signal:** REJECTED | **Implied Upside:** 60%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **Yes (due to fix).** BABA models an implausible 60% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### BN (Brookfield Corporation)

- **Screener:** fPERG (Score: 0.91) | **Signal:** PASS | **Implied Upside:** 39%
- **Metrics:** Div Yield 0, EPS Growth 16.5%
- _Properly Valued?_ **Yes (due to fix).** BN models an implausible 39% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### CPRT (Copart)

- **Screener:** fPERG (Score: 1.19) | **Signal:** REJECTED | **Implied Upside:** 30%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **Yes (due to fix).** CPRT models an implausible 30% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### EXO.AS (Exor N.V.)

- **Screener:** tPERG (Score: 0.83) | **Signal:** PASS | **Implied Upside:** 76%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes (due to fix).** EXO.AS models an implausible 76% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### FICO (Fair Isaac Corp)

- **Screener:** fPERG (Score: 1.16) | **Signal:** WAIT | **Implied Upside:** 73%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Yes (due to fix).** FICO models an implausible 73% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### HALO (Halozyme Therapeutics)

- **Screener:** fPERG (Score: 0.31) | **Signal:** PASS | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Yes (due to fix).** HALO models an implausible 34% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### HDB (HDFC Bank)

- **Screener:** fPERG (Score: 1.41) | **Signal:** FAIL | **Implied Upside:** 67%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes (due to fix).** HDB models an implausible 67% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### HEI.A (HEICO Corp)

- **Screener:** fEVG (Score: 1.61) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **Yes (due to fix).** HEI.A models an implausible 0% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### HEI (HEICO Corporation)

- **Screener:** fEVG (Score: 1.79) | **Signal:** FAIL | **Implied Upside:** 36%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Yes (due to fix).** HEI models an implausible 36% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### INDT.ST (Indutrade)

- **Screener:** fPERG (Score: 1.49) | **Signal:** REJECTED | **Implied Upside:** 28%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes (due to fix).** INDT.ST models an implausible 28% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### JDG.L (Judges Scientific)

- **Screener:** fPERG (Score: 1.15) | **Signal:** WAIT | **Implied Upside:** 66%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes (due to fix).** JDG.L models an implausible 66% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### KNSL (Kinsale Capital)

- **Screener:** fPERG (Score: 0.74) | **Signal:** REJECTED | **Implied Upside:** 29%
- **Metrics:** Div Yield 0, EPS Growth 20%
- _Properly Valued?_ **Yes (due to fix).** KNSL models an implausible 29% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### LIFCO-B.ST (Lifco AB)

- **Screener:** fEVG (Score: 1.61) | **Signal:** REJECTED | **Implied Upside:** 28%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes (due to fix).** LIFCO-B.ST models an implausible 28% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### MA (Mastercard)

- **Screener:** fPERG (Score: 1.39) | **Signal:** FAIL | **Implied Upside:** 35%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes (due to fix).** MA models an implausible 35% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### MELI (MercadoLibre)

- **Screener:** fPERG (Score: 1.08) | **Signal:** WAIT | **Implied Upside:** 61%
- **Metrics:** Div Yield 0, EPS Growth 21%
- _Properly Valued?_ **Yes (due to fix).** MELI models an implausible 61% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### META (Meta Platforms)

- **Screener:** fPERG (Score: 1.1) | **Signal:** WAIT | **Implied Upside:** 46%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes (due to fix).** META models an implausible 46% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### MSFT (Microsoft)

- **Screener:** fPERG (Score: 1.47) | **Signal:** FAIL | **Implied Upside:** 55%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes (due to fix).** MSFT models an implausible 55% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### NU (Nu Holdings)

- **Screener:** fPERG (Score: 0.54) | **Signal:** PASS | **Implied Upside:** 45%
- **Metrics:** Div Yield 0, EPS Growth 28%
- _Properly Valued?_ **Yes (due to fix).** NU models an implausible 45% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### NVO (Novo Nordisk)

- **Screener:** totalReturn (Score: 0.67) | **Signal:** REJECTED | **Implied Upside:** 29%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **Yes (due to fix).** NVO models an implausible 29% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### PDD (PDD Holdings)

- **Screener:** fPERG (Score: 0.83) | **Signal:** REJECTED | **Implied Upside:** 54%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Yes (due to fix).** PDD models an implausible 54% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### SE (Sea Limited)

- **Screener:** fPERG (Score: 0.74) | **Signal:** REJECTED | **Implied Upside:** 75%
- **Metrics:** Div Yield 0, EPS Growth 22%
- _Properly Valued?_ **Yes (due to fix).** SE models an implausible 75% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### URI (United Rentals)

- **Screener:** fPERG (Score: 1.65) | **Signal:** FAIL | **Implied Upside:** 39%
- **Metrics:** Div Yield 0, EPS Growth 9%
- _Properly Valued?_ **Yes (due to fix).** URI models an implausible 39% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### V (Visa)

- **Screener:** fPERG (Score: 1.42) | **Signal:** FAIL | **Implied Upside:** 34%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes (due to fix).** V models an implausible 34% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### VIT-B.ST (Vitec Software Group)

- **Screener:** fEVG (Score: 0.72) | **Signal:** PASS | **Implied Upside:** 101%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes (due to fix).** VIT-B.ST models an implausible 101% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

### ZTS (Zoetis)

- **Screener:** fPERG (Score: 1.06) | **Signal:** WAIT | **Implied Upside:** 30%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes (due to fix).** ZTS models an implausible 30% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in `WAIT` instead of eagerly buying the falling knife.

## Serial Acquirers & Alternate Basis

**Methodology Context:** Usually evaluated on fEVG (EV/EBITDA to Growth) or Free Cash Flow due to massive amortization masking GAAP EPS.

**How Proper is the Valuation Baseline?** Highly Proper. Switching basis off EPS avoids penalizing serial acquirers for necessary GAAP accounting norms.

### AMZN (Amazon)

- **Screener:** fPERG (Score: 1.06) | **Signal:** WAIT | **Implied Upside:** 36%
- **Metrics:** Div Yield 0, EPS Growth 22%
- _Properly Valued?_ **Very Proper.** GAAP EPS completely distorts AMZN due to massive amortization. Evaluating it on `fPERG` (or Free Cash Flow basis) avoids penalizing it for intelligent balance sheet accounting.

### LMN.V (Lumine Group)

- **Screener:** fEVG (Score: 1.19) | **Signal:** WAIT | **Implied Upside:** 85%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **Very Proper.** GAAP EPS completely distorts LMN.V due to massive amortization. Evaluating it on `fEVG` (or Free Cash Flow basis) avoids penalizing it for intelligent balance sheet accounting.

### NFLX (Netflix)

- **Screener:** fPERG (Score: 1.28) | **Signal:** FAIL | **Implied Upside:** 25%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Very Proper.** GAAP EPS completely distorts NFLX due to massive amortization. Evaluating it on `fPERG` (or Free Cash Flow basis) avoids penalizing it for intelligent balance sheet accounting.

### RBRK (Rubrik)

- **Screener:** totalReturn (Score: N/A) | **Signal:** FAIL | **Implied Upside:** 77%
- **Metrics:** Div Yield 0, EPS Growth 0%
- _Properly Valued?_ **Very Proper.** GAAP EPS completely distorts RBRK due to massive amortization. Evaluating it on `totalReturn` (or Free Cash Flow basis) avoids penalizing it for intelligent balance sheet accounting.

## Standard Structural Compounders

**Methodology Context:** The meat of the portfolio. Consistent mid-teens growers evaluated on fPERG or fFREG.

**How Proper is the Valuation Baseline?** Properly Valued. The quantitative multi-engine provides a robust, normalized relative value across these consistent assets.

### AAPL (Apple)

- **Screener:** fPERG (Score: 2.61) | **Signal:** FAIL | **Implied Upside:** 19%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **Yes.** AAPL represents a standard compounder. The fPERG engine combines its 10%% growth mathematically with a conservative 2.61 score. At 19% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### ABBV (AbbVie Inc.)

- **Screener:** fPERG (Score: 0.83) | **Signal:** PASS | **Implied Upside:** 21%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** ABBV represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 0.83 score. At 21% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### ADDT-B.ST (Addtech AB)

- **Screener:** fEVG (Score: 1.38) | **Signal:** FAIL | **Implied Upside:** 28%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **Yes.** ADDT-B.ST represents a standard compounder. The fEVG engine combines its 17%% growth mathematically with a conservative 1.38 score. At 28% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### COR (Cencora)

- **Screener:** fPERG (Score: 1.07) | **Signal:** WAIT | **Implied Upside:** 24%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** COR represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 1.07 score. At 24% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### CRM (Salesforce)

- **Screener:** fPERG (Score: 0.85) | **Signal:** PASS | **Implied Upside:** 42%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** CRM represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 0.85 score. At 42% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### CSU.TO (Constellation Software)

- **Screener:** fEVG (Score: 1.22) | **Signal:** FAIL | **Implied Upside:** 71%
- **Metrics:** Div Yield 0, EPS Growth 18%
- _Properly Valued?_ **Yes.** CSU.TO represents a standard compounder. The fEVG engine combines its 18%% growth mathematically with a conservative 1.22 score. At 71% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### DPLM.L (Diploma PLC)

- **Screener:** fEVG (Score: 1.41) | **Signal:** FAIL | **Implied Upside:** 4%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **Yes.** DPLM.L represents a standard compounder. The fEVG engine combines its 16%% growth mathematically with a conservative 1.41 score. At 4% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### DSG.TO (Descartes Systems)

- **Screener:** fPERG (Score: 1.29) | **Signal:** FAIL | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **Yes.** DSG.TO represents a standard compounder. The fPERG engine combines its 17%% growth mathematically with a conservative 1.29 score. At 0% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### FIH.U.TO (Fairfax India Holdings)

- **Screener:** tPERG (Score: 0.34) | **Signal:** PASS | **Implied Upside:** 0%
- **Metrics:** Div Yield 0, EPS Growth 17%
- _Properly Valued?_ **Yes.** FIH.U.TO represents a standard compounder. The tPERG engine combines its 17%% growth mathematically with a conservative 0.34 score. At 0% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### FTNT (Fortinet)

- **Screener:** fPERG (Score: 1.63) | **Signal:** FAIL | **Implied Upside:** 9%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** FTNT represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 1.63 score. At 9% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### ISRG (Intuitive Surgical)

- **Screener:** fPERG (Score: 2.9) | **Signal:** FAIL | **Implied Upside:** 26%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes.** ISRG represents a standard compounder. The fPERG engine combines its 14%% growth mathematically with a conservative 2.9 score. At 26% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### LAGR-B.ST (Lagercrantz Group)

- **Screener:** fPERG (Score: 2.37) | **Signal:** FAIL | **Implied Upside:** 26%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** LAGR-B.ST represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 2.37 score. At 26% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### MCK (McKesson)

- **Screener:** fPERG (Score: 1.28) | **Signal:** FAIL | **Implied Upside:** 12%
- **Metrics:** Div Yield 0, EPS Growth 15%
- _Properly Valued?_ **Yes.** MCK represents a standard compounder. The fPERG engine combines its 15%% growth mathematically with a conservative 1.28 score. At 12% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### MKTX (MarketAxess)

- **Screener:** fPERG (Score: 2.05) | **Signal:** FAIL | **Implied Upside:** 12%
- **Metrics:** Div Yield 0, EPS Growth 9%
- _Properly Valued?_ **Yes.** MKTX represents a standard compounder. The fPERG engine combines its 9%% growth mathematically with a conservative 2.05 score. At 12% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### MTRN (Materion)

- **Screener:** fPERG (Score: 1.62) | **Signal:** FAIL | **Implied Upside:** 32%
- **Metrics:** Div Yield 0, EPS Growth 11%
- _Properly Valued?_ **Yes.** MTRN represents a standard compounder. The fPERG engine combines its 11%% growth mathematically with a conservative 1.62 score. At 32% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### NBIX (Neurocrine Biosciences)

- **Screener:** fPERG (Score: 1.03) | **Signal:** WAIT | **Implied Upside:** 37%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes.** NBIX represents a standard compounder. The fPERG engine combines its 14%% growth mathematically with a conservative 1.03 score. At 37% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### PSK.TO (PrairieSky Royalty)

- **Screener:** fPERG (Score: 3.36) | **Signal:** FAIL | **Implied Upside:** 1%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **Yes.** PSK.TO represents a standard compounder. The fPERG engine combines its 10%% growth mathematically with a conservative 3.36 score. At 1% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### REGN (Regeneron Pharmaceuticals)

- **Screener:** fPERG (Score: 1.19) | **Signal:** WAIT | **Implied Upside:** 18%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes.** REGN represents a standard compounder. The fPERG engine combines its 12%% growth mathematically with a conservative 1.19 score. At 18% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### ROP (Roper Technologies)

- **Screener:** fEVG (Score: 1.17) | **Signal:** WAIT | **Implied Upside:** 31%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes.** ROP represents a standard compounder. The fEVG engine combines its 12%% growth mathematically with a conservative 1.17 score. At 31% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### SNPS (Synopsys)

- **Screener:** fPERG (Score: 1.87) | **Signal:** FAIL | **Implied Upside:** 26%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **Yes.** SNPS represents a standard compounder. The fPERG engine combines its 13%% growth mathematically with a conservative 1.87 score. At 26% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### TPZ.TO (Topaz Energy)

- **Screener:** fPERG (Score: 2.95) | **Signal:** FAIL | **Implied Upside:** 6%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **Yes.** TPZ.TO represents a standard compounder. The fPERG engine combines its 10%% growth mathematically with a conservative 2.95 score. At 6% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### VEEV (Veeva Systems)

- **Screener:** fPERG (Score: 0.94) | **Signal:** PASS | **Implied Upside:** 49%
- **Metrics:** Div Yield 0, EPS Growth 19%
- _Properly Valued?_ **Yes.** VEEV represents a standard compounder. The fPERG engine combines its 19%% growth mathematically with a conservative 0.94 score. At 49% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### VRSK (Verisk Analytics)

- **Screener:** fPERG (Score: 1.6) | **Signal:** FAIL | **Implied Upside:** 15%
- **Metrics:** Div Yield 0, EPS Growth 14%
- _Properly Valued?_ **Yes.** VRSK represents a standard compounder. The fPERG engine combines its 14%% growth mathematically with a conservative 1.6 score. At 15% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### VRTX (Vertex Pharmaceuticals)

- **Screener:** fPERG (Score: 1.61) | **Signal:** FAIL | **Implied Upside:** 19%
- **Metrics:** Div Yield 0, EPS Growth 13%
- _Properly Valued?_ **Yes.** VRTX represents a standard compounder. The fPERG engine combines its 13%% growth mathematically with a conservative 1.61 score. At 19% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### WSO (Watsco)

- **Screener:** fPERG (Score: 2.75) | **Signal:** FAIL | **Implied Upside:** 8%
- **Metrics:** Div Yield 0, EPS Growth 10%
- _Properly Valued?_ **Yes.** WSO represents a standard compounder. The fPERG engine combines its 10%% growth mathematically with a conservative 2.75 score. At 8% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### WST (West Pharmaceutical)

- **Screener:** fPERG (Score: 1.65) | **Signal:** FAIL | **Implied Upside:** 32%
- **Metrics:** Div Yield 0, EPS Growth 16%
- _Properly Valued?_ **Yes.** WST represents a standard compounder. The fPERG engine combines its 16%% growth mathematically with a conservative 1.65 score. At 32% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.

### XYZ (Block Inc.)

- **Screener:** fPERG (Score: 1.08) | **Signal:** WAIT | **Implied Upside:** 46%
- **Metrics:** Div Yield 0, EPS Growth 12%
- _Properly Valued?_ **Yes.** XYZ represents a standard compounder. The fPERG engine combines its 12%% growth mathematically with a conservative 1.08 score. At 46% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.
