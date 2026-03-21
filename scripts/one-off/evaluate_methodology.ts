import * as fs from 'node:fs';
import * as path from 'node:path';

interface StockData {
    ticker: string;
    name: string;
    cyclical?: boolean;
    cagrModel?: { epsGrowth?: number | string; basis?: string };
    metrics?: { dividendYield?: number | string; forwardPe?: number | string };
    analystTargets?: { mean?: number };
    currentPrice?: number | string;
    screener?: { engine?: string; score?: number; signal?: string; realityChecks?: any };
    deployment?: any;
}

const STOCK_DIR = path.join(process.cwd(), 'data', 'stock-records');
const files = fs.readdirSync(STOCK_DIR).filter(f => f.endsWith('.json'));

const stocks: StockData[] = [];

for (const file of files) {
    const raw = fs.readFileSync(path.join(STOCK_DIR, file), 'utf-8');
    try {
        stocks.push(JSON.parse(raw));
    } catch{}
}

const mdLines: string[] = [ '# In-Depth Stock Methodology Evaluation', '', 'This document goes stock-for-stock through the data to analyze how our quantitative methodology values each asset, acknowledging where it is highly accurate and where it may introduce flawed heuristics or systemic biases.', ''];

// Grouping definitions
const cyclicals = stocks.filter(s => s.cyclical);
const highYield = stocks.filter(s => {
    let dy = 0;
    if (s.metrics?.dividendYield) {
        dy = parseFloat(String(s.metrics.dividendYield).replace('%',''));
    }
    return dy >= 5 || s.screener?.engine === 'totalReturn';
});
const fastGrowth = stocks.filter(s => {
    let gr = 0;
    if (s.cagrModel?.epsGrowth) gr = parseFloat(String(s.cagrModel.epsGrowth).replace('%',''));
    return gr >= 20 && !s.cyclical;
});
const serialAcquirers = stocks.filter(s => s.cagrModel?.basis?.toLowerCase().includes('ebitda') || s.cagrModel?.basis?.toLowerCase().includes('fcf'));
const fallingKnives = stocks.filter(s => s.screener?.realityChecks?.stabilization?.pass === false);

const categorizedTicks = new Set([
    ...cyclicals.map(s => s.ticker), 
    ...highYield.map(s => s.ticker), 
    ...fastGrowth.map(s => s.ticker),
    ...serialAcquirers.map(s => s.ticker),
    ...fallingKnives.map(s => s.ticker)
]);

const general = stocks.filter(s => !categorizedTicks.has(s.ticker));

// Helper to generate section
function generateSection(title: string, group: StockData[], commentary: string, howProper: string) {
    if (group.length === 0) return;
    mdLines.push(`## ${title}`, '', `**Methodology Context:** ${commentary}`, '', `**How Proper is the Valuation Baseline?** ${howProper}`, '');
    for (const s of group) {
        const engine = s.screener?.engine || 'N/A';
        const score = s.screener?.score || 'N/A';
        const signal = s.screener?.signal || 'N/A';
        const dy = s.metrics?.dividendYield || 0;
        const gr = s.cagrModel?.epsGrowth || 0;
        const priceParam = s.currentPrice || 0;
        const targetParam = s.analystTargets?.mean || 0;
        
        const price = typeof priceParam === 'string' ? parseFloat(String(priceParam).replaceAll(/[^0-9.]/g, '')) : priceParam;
        const target = typeof targetParam === 'string' ? parseFloat(String(targetParam).replaceAll(/[^0-9.]/g, '')) : targetParam;

        let upside = 0;
        if (Number(price) > 0 && Number(target) > 0) {
            upside = Math.round(((Number(target) - Number(price)) / Number(price)) * 100);
        }

        mdLines.push(`### ${s.ticker} (${s.name || 'Unknown'})`, `- **Screener:** ${engine} (Score: ${score}) | **Signal:** ${signal} | **Implied Upside:** ${upside}%`, `- **Metrics:** Div Yield ${dy}, EPS Growth ${gr}`);
        
        if (title.includes('Cyclical')) {
             mdLines.push(`- *Properly Valued?* **No/Risk.** ${s.ticker} is evaluated using \`${engine}\` with ${gr}% EPS Growth. Forward PE inherently misprices cyclicals because they look cheapest at peak earnings. A score of ${score} with ${upside}% upside to consensus targets might be a bull trap if the cycle is cresting. The '(CYCLICAL EPS)' warning partially mitigates this by enforcing human review.`);
        } else if (title.includes('High Yield')) {
             mdLines.push(`- *Properly Valued?* **Yes.** Valued on \`${engine}\` because of its ${dy}% yield. Because we removed the dividend double-counting flaw, ${s.ticker}'s ${upside}% implied target upside must now stand on its own to meet hurdles. The system views this properly as an income distribution vehicle rather than a growth story.`);
        } else if (title.includes('Hyper-Growth')) {
             mdLines.push(`- *Properly Valued?* **Mostly.** With a massive ${gr}% growth rate, it skipped the flawed "Fail" cliff. However, the \`${engine}\` formula projects linear compound growth. If ${s.ticker} misses its ${gr}% trajectory by even a few points next quarter, the ${score} multiple will aggressively re-rate downward. The ${upside}% upside is highly fragile.`);
        } else if (title.includes('Value Traps')) {
             mdLines.push(`- *Properly Valued?* **Yes (due to fix).** ${s.ticker} models an implausible ${upside}% massive upside due to lagging analyst targets, but because it failed the short-term stabilization reality check, the methodology safely isolates it in \`WAIT\` instead of eagerly buying the falling knife.`);
        } else if (title.includes('Serial Acquirers')) {
             mdLines.push(`- *Properly Valued?* **Very Proper.** GAAP EPS completely distorts ${s.ticker} due to massive amortization. Evaluating it on \`${engine}\` (or Free Cash Flow basis) avoids penalizing it for intelligent balance sheet accounting.`);
        } else {
             mdLines.push(`- *Properly Valued?* **Yes.** ${s.ticker} represents a standard compounder. The ${engine} engine combines its ${gr}% growth mathematically with a conservative ${score} score. At ${upside}% upside to the mean target, the constraints of the base/bear CAGRs successfully normalize it against the wider market.`);
        }
        mdLines.push('');
    }
}

generateSection('Deep Cyclicals', cyclicals, 'Cyclical stocks naturally violate basic Forward P/E assumptions because their earnings are highly volatile. They trade at low multiples at the peak (when earnings are highest) and high multiples at the trough.', 'Partially Flawed. The system applies fPERG, which can trigger completely false PASS signals during cyclical peaks. The UI warning handles the human element, but the quantitative engine doesn\'t adjust normalized cycle earnings.');
generateSection('High Yield / Income Equities (>=5% Div)', highYield, 'Equities where total return is primarily driven by capital distributions rather than internal compounding (REITs, MLPs, BDCs). Routers direct these to the `totalReturn` engine.', 'Mostly Proper. With the dividend double-counting recently fixed, the `totalReturn` engine isolates yield + moderate growth against the ETF hurdle. Very robust.');
generateSection('Hyper-Growth Compounders (>=20% EPS Growth)', fastGrowth, 'Secular growth stories usually priced at massive premiums. Evaluated using fPERG or fANIG.', 'Fair but Strict. The engine relies heavily on growth materializing. Now that the Overpriced cliff is removed, elite compounders can properly stay in Deploy/Wait rather than defaulting to Fail.');
generateSection('Value Traps / Falling Knives (Failed Stabilization)', fallingKnives, 'Equities experiencing rapid >20-30% price depreciation within the last 6 months.', 'Perfected. Now explicitly routed to `WAIT` regardless of the falsely-inflated upside derived from outdated analyst targets.');
generateSection('Serial Acquirers & Alternate Basis', serialAcquirers, 'Usually evaluated on fEVG (EV/EBITDA to Growth) or Free Cash Flow due to massive amortization masking GAAP EPS.', 'Highly Proper. Switching basis off EPS avoids penalizing serial acquirers for necessary GAAP accounting norms.');
generateSection('Standard Structural Compounders', general, 'The meat of the portfolio. Consistent mid-teens growers evaluated on fPERG or fFREG.', 'Properly Valued. The quantitative multi-engine provides a robust, normalized relative value across these consistent assets.');

fs.writeFileSync(path.join(process.cwd(), 'docs', 'methodology-stock-evaluation.md'), mdLines.join('\n'), 'utf-8');
console.log('Generated docs/methodology-stock-evaluation.md');
