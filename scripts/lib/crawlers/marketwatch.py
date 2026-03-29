import asyncio
import nodriver as uc
import sys
import json
import random

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def resolve_mw_url(ticker: str) -> str:
    ticker_upper = ticker.upper()
    
    # Hong Kong (e.g. 0700.HK -> hk:700 or just 700 with ?countrycode=hk)
    if ticker_upper.endswith('.HK'):
        base = ticker_upper.replace('.HK', '').lstrip('0')
        return f"https://www.marketwatch.com/investing/stock/{base}/analystestimates?countrycode=hk"
        
    # Canada (e.g. CSU.TO, TOI.V, BAM.CN)
    if ticker_upper.endswith('.TO') or ticker_upper.endswith('.V') or ticker_upper.endswith('.CN'):
        base = ticker_upper.split('.')[0]
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=ca"
        
    # UK / London
    if ticker_upper.endswith('.L') or ticker_upper.endswith('.IL'):
        base = ticker_upper.split('.')[0]
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=uk"
        
    # Sweden
    if ticker_upper.endswith('.ST'):
        base = ticker_upper.split('.')[0].replace('_', '-').replace(' ', '-')
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=se"
        
    # Netherlands / Amsterdam
    if ticker_upper.endswith('.AS'):
        base = ticker_upper.split('.')[0]
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=nl"
        
    # France / Paris
    if ticker_upper.endswith('.PA'):
        base = ticker_upper.split('.')[0]
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=fr"
        
    # Germany (Frankfurt/Xetra)
    if ticker_upper.endswith('.DE'):
        base = ticker_upper.split('.')[0]
        return f"https://www.marketwatch.com/investing/stock/{base.lower()}/analystestimates?countrycode=dx"

    # Default US Ticker
    return f"https://www.marketwatch.com/investing/stock/{ticker.lower()}/analystestimates"

async def extract_marketwatch_estimates(ticker: str) -> dict | None:
    eprint(f"[{ticker}] Initializing CDP-Native Browser...")
    browser = await uc.start(
        headless=False, # MarketWatch blocks headless Chrome
        browser_args=[
            '--window-size=1920,1080',
            '--lang=en-US',
            '--accept-lang=en-US,en'
        ]
    )

    try:
        eprint(f"[{ticker}] Warming session on MarketWatch root...")
        page = await browser.get('https://www.marketwatch.com')
        await asyncio.sleep(random.uniform(2.0, 3.5))

        target_url = resolve_mw_url(ticker)
        eprint(f"[{ticker}] Navigating to {target_url}")
        
        # We need a page variable reference that carries over navigation
        await page.get(target_url)
        await asyncio.sleep(4)
        
        eprint(f"[{ticker}] Dismissing consent banners...")
        consent_js = """
        (() => {
            const buttons = document.querySelectorAll('button, a');
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('accept') || text.includes('agree') || text.includes('got it')) {
                    btn.click(); return 'clicked raw';
                }
            }
            const otAccept = document.getElementById('onetrust-accept-btn-handler');
            if (otAccept) { otAccept.click(); return 'clicked onetrust'; }
            
            const spFrames = document.querySelectorAll('iframe[id*="sp_message"]');
            if (spFrames.length > 0) return 'sp_consent_iframe_detected';
            return 'no tracking banners found';
        })()
        """
        consent_result = await page.evaluate(consent_js)
        eprint(f"[{ticker}] Consent: {consent_result}")
        
        if consent_result and 'sp_consent_iframe' in str(consent_result):
            eprint(f"[{ticker}] Expanding IFRAME consent override...")
            sp_js = """
            (() => {
                const frames = document.querySelectorAll('iframe');
                for (const frame of frames) {
                    try {
                        const doc = frame.contentDocument || frame.contentWindow?.document;
                        if (!doc) continue;
                        const btns = doc.querySelectorAll('button');
                        for (const btn of btns) {
                            const t = btn.textContent?.toLowerCase() || '';
                            if (t.includes('agree') || t.includes('accept') || t.includes('yes')) {
                                btn.click(); return 'iframe bypass success';
                            }
                        }
                    } catch(e) { }
                }
                return 'iframe bypass failed';
            })()
            """
            sp_result = await page.evaluate(sp_js)
            eprint(f"[{ticker}] SP iframe: {sp_result}")

        await asyncio.sleep(3)

        eprint(f"[{ticker}] Simulating human scrolling...")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
        await asyncio.sleep(2)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.75)")
        await asyncio.sleep(2)

        js_extract = """
        (() => {
            const tables = document.querySelectorAll('table');
            for (const table of tables) {
                const hcells = Array.from(table.querySelectorAll('thead th, thead td'));
                const headers = hcells.map(th => th.textContent.trim());
                
                const yearHeaders = headers.filter(h => /^20\\d{2}$/.test(h));
                if (yearHeaders.length < 2) continue;
                
                const bodyRows = table.querySelectorAll('tbody tr');
                const result = {};
                
                for (const row of bodyRows) {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const label = cells[0]?.textContent?.trim()?.toLowerCase() || '';
                    if (['high', 'low', 'average'].includes(label)) {
                        for (let i = 1; i < cells.length && i <= yearHeaders.length; i++) {
                            const year = yearHeaders[i - 1];
                            if (!result[year]) result[year] = {};
                            const val = parseFloat(cells[i]?.textContent?.trim());
                            if (!isNaN(val)) result[year][label] = val;
                        }
                    }
                }
                if (Object.keys(result).length > 0) return JSON.stringify(result);
            }
            return null;
        })()
        """

        eprint(f"[{ticker}] Executing JS DOM Table payload...")
        raw_result = await page.evaluate(js_extract)

        if raw_result and raw_result != 'null':
            estimates = json.loads(raw_result)
            eprint(f"[{ticker}] Success: Fetched {len(estimates)} forward years.")
            return estimates
        else:
            eprint(f"[{ticker}] WARNING: DOM Table JS Evaluation Failed.")
            return None

    except Exception as e:
        import traceback
        eprint(f"[{ticker}] Fatal Execution Error: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        return None

    finally:
        eprint(f"[{ticker}] Terminating Headless instance.")
        if browser:
            browser.stop()

async def batch_extract(tickers: list[str]) -> dict:
    results = {}
    for idx, ticker in enumerate(tickers):
        eprint(f"\n--- Processing {ticker} [{idx+1}/{len(tickers)}] ---")
        try:
            data = await extract_marketwatch_estimates(ticker)
            if data:
                results[ticker] = data
        except Exception:
            pass # Error logged to stderr inside extract

        if idx < len(tickers) - 1:
            delay = random.uniform(3.0, 7.0)
            eprint(f"--- Sleeping {delay:.2f}s (Jitter) ---")
            await asyncio.sleep(delay)
            
    return results

if __name__ == "__main__":
    try:
        raw_arg = sys.argv[1]
        tickers = json.loads(raw_arg)
    except Exception:
        # Fallback if no stringified JSON Array is passed in ARGV 1
        tickers = [t.strip().upper() for t in sys.argv[1].split(',')] if len(sys.argv) > 1 else []
        
    if not tickers:
        eprint("No tickers provided.")
        sys.exit(1)
        
    results = asyncio.run(batch_extract(tickers))
    
    # stdout MUST be purely the JSON dictionary output to avoid corrupting NodeJS JSON.parse payload!
    print(json.dumps(results))
