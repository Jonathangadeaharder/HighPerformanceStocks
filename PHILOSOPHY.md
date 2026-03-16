# The High Performance Stocks Philosophy

This document codifies the core principles governing the logic, architecture, and capital allocation algorithms of this project. Any future modifications to the codebase must strictly adhere to these tenets.

## 1. Hyper-Rationality Under Uncertainty
We operate in an environment of fundamentally limited and imperfect information. Analysts are wrong, macroeconomics are unpredictable, and API data is sometimes corrupted. 

A perfectly intelligent agent does not freeze in the face of uncertainty, nor does it seek false comfort in conservative, "safe" heuristics. Instead, it acts **ruthlessly on probability and expected value (EV)**. If the math dictates an aggressive posture based on the available data, we take the aggressive posture. We do not dilute our capital simply because we lack total certainty.

## 2. Maximizing the Mid-to-Long Term Run
We are young. Our timescale is decades. Therefore, we are entirely indifferent to short-term variance.

**Volatility is not risk; it is the price of admission.** True risk is the permanent loss of capital or the failure to compound purchasing power faster than inflation. We embrace supreme near-term volatility so long as the mathematical architecture of the portfolio (GARP + Quality + Momentum) guarantees maximum absolute gains over a 3- to 10-year horizon. 

## 3. The Holy Trinity: Value, Quality, and Momentum
We do not subscribe to restrictive, single-factor dogmas (e.g., "Deep Value only" or "Tech Growth only"). We are purely quantitative:
1. **Value (The Anchor):** We demand a high margin of safety. A stock must mathematically clear traditional ETF hurdle rates even if its multiple compresses violently.
2. **Quality (The Engine):** We demand proof, not just promises. High ROE, immense FCF Yield, and structural capital efficiency are required. We aggressively penalize "fake quality" driven by extreme leverage.
3. **Momentum (The Confirmation):** Cheap stocks can stay cheap forever. We use un-neutered, cross-sectional momentum to aggressively scale into stocks that the market is actively re-pricing. Momentum is treated as a co-equal partner to structural value.

## 4. Academic Rigor and Bias Integration
We synthesize the best available academic findings with expert opinions (such as analyst estimates), but we never take them at face value. We proactively adjust for known historical biases. For example, if studies show analysts exhibit systematic 15% over-optimism on long-term growth, we mathematically haircut the growth rate. 

Crucially, adjusting for uncertainty is **directionally agnostic**. Uncertainty does not automatically equal "reduce expected returns and play it safe." If the data and mathematical logic indicate the market is systematically *underestimating* an asset class, we adjust the EV *upwards* and increase our aggression.

## 5. Minimum Viable Complexity
Models must be structural, un-brittle, and natively resilient to bad inputs. We use Z-scores to handle distribution shifts dynamically. We use decay factors to prevent terminal value hallucinations. We build algorithms that decay gracefully (e.g., substituting VIX for VSTOXX) rather than breaking. 

We write code that is as simple as possible, but exactly as complex as necessary to map the real-world physics of the stock market. Every variable must pull its own weight. If a metric sounds smart but adds no alpha, it is deleted.
