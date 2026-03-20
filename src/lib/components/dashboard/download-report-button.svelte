<script lang="ts">
	import type { FindingStock, DashboardHurdles } from '$lib/types/dashboard';
	import jsPDF from 'jspdf';

	let {
		deployNow,
		cheapWait,
		watchlist,
		hurdles
	}: {
		deployNow: FindingStock[];
		cheapWait: FindingStock[];
		watchlist: FindingStock[];
		hurdles: DashboardHurdles;
	} = $props();

	let isGenerating = $state(false);
	let error = $state<string | null>(null);

	// ── Colour palette ─────────────────────────────────────────────────────────
	const C = {
		navy:    [15,  23,  42]  as [number,number,number],
		blue:    [37,  99, 235]  as [number,number,number],
		blueL:   [219,234,254]  as [number,number,number],
		green:   [22, 163,  74]  as [number,number,number],
		greenL:  [220,252,231]  as [number,number,number],
		amber:   [180,100,  10]  as [number,number,number],
		amberL:  [254,243,199]  as [number,number,number],
		red:     [220,  38,  38]  as [number,number,number],
		redL:    [254,226,226]  as [number,number,number],
		slate:   [100,116,139]  as [number,number,number],
		slateL:  [241,245,249]  as [number,number,number],
		white:   [255,255,255]  as [number,number,number],
		black:   [  0,  0,  0]  as [number,number,number],
	};

	function fill(doc: jsPDF, c: [number,number,number]) { doc.setFillColor(...c); }
	function ink(doc: jsPDF, c: [number,number,number]) { doc.setTextColor(...c); }
	function stroke(doc: jsPDF, c: [number,number,number]) { doc.setDrawColor(...c); }

	function textLines(doc: jsPDF, text: string, maxWidth: number): number {
		const lines = doc.splitTextToSize(text, maxWidth) as string | string[];
		return Array.isArray(lines) ? lines.length : 1;
	}

	function drawTextLines(doc: jsPDF, text: string, maxWidth: number, x: number, y: number): void {
		const lines = doc.splitTextToSize(text, maxWidth) as string | string[];
		doc.text(lines, x, y);
	}

	function drawScenarioBoxes(doc: jsPDF, yPos: number, stock: FindingStock): number {
		if (stock.bearCagr == null && stock.baseCagr == null && stock.bullCagr == null) return yPos;
		const scenarios = [
			{ label: 'Bear', val: stock.bearCagr, color: C.red },
			{ label: 'Base', val: stock.baseCagr, color: C.green },
			{ label: 'Bull', val: stock.bullCagr, color: C.blue },
		];
		let sx = 14;
		for (const s of scenarios) {
			fill(doc, s.color);
			doc.roundedRect(sx, yPos - 3, 26, 8, 1, 1, 'F');
			ink(doc, C.white);
			doc.setFontSize(7);
			doc.setFont('helvetica', 'bold');
			doc.text(s.label, sx + 13, yPos, { align: 'center' });
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text(s.val == null ? 'N/A' : `${s.val}%`, sx + 13, yPos + 4, { align: 'center' });
			sx += 29;
		}
		ink(doc, C.slate);
		doc.setFontSize(8);
		doc.text(`QCS: ${stock.qcs?.totalScore ?? 'N/A'} / 15`, sx + 2, yPos + 2);
		return yPos + 12;
	}

	function drawThesis(doc: jsPDF, yPos: number, stock: FindingStock): number {
		if (!stock.bullCase && !stock.bearCase) return yPos;
		if (stock.bullCase) {
			ink(doc, C.green);
			doc.setFontSize(7.5);
			doc.setFont('helvetica', 'bold');
			doc.text('BULL', 14, yPos);
			doc.setFont('helvetica', 'normal');
			ink(doc, C.navy);
			drawTextLines(doc, stock.bullCase, 166, 24, yPos);
			yPos += textLines(doc, stock.bullCase, 166) * 4.5 + 2;
		}
		if (stock.bearCase) {
			ink(doc, C.red);
			doc.setFontSize(7.5);
			doc.setFont('helvetica', 'bold');
			doc.text('BEAR', 14, yPos);
			doc.setFont('helvetica', 'normal');
			ink(doc, C.navy);
			drawTextLines(doc, stock.bearCase, 166, 24, yPos);
			yPos += textLines(doc, stock.bearCase, 166) * 4.5;
		}
		return yPos;
	}

	function drawDeployedStock(doc: jsPDF, stock: FindingStock, yPos: number): number {
		fill(doc, C.slateL);
		doc.rect(14, yPos, 182, 8, 'F');
		ink(doc, C.navy);
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text(stock.ticker, 16, yPos + 5.5);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		ink(doc, C.slate);
		doc.text(`${stock.name ?? ''}  ·  ${stock.group ?? ''}`, 38, yPos + 5.5);

		if (stock.deploymentRank != null) {
			fill(doc, C.blue);
			doc.roundedRect(178, yPos + 1, 18, 6, 1, 1, 'F');
			ink(doc, C.white);
			doc.setFontSize(7.5);
			doc.setFont('helvetica', 'bold');
			doc.text(`Rank ${stock.deploymentRank.toFixed(0)}`, 180, yPos + 5.2);
			doc.setFont('helvetica', 'normal');
		}

		yPos += 12;
		const sc = stock.screener;
		const model = stock.cagrModel;
		ink(doc, C.slate);
		doc.setFontSize(8);
		doc.text(
			`Price: ${stock.currentPrice ?? 'N/A'}   Target: ${stock.targetPrice ?? 'N/A'}   Upside: ${stock.upside == null ? 'N/A' : `${stock.upside}%`}   ` +
			`Score: ${sc?.score ?? 'N/A'} (${sc?.engine ?? 'N/A'})   EPS growth: ${model?.epsGrowth ?? 'N/A'}`,
			14, yPos
		);
		yPos += 6;

		yPos = drawScenarioBoxes(doc, yPos, stock);
		yPos = drawThesis(doc, yPos, stock);

		stroke(doc, [220, 220, 230]);
		doc.setLineWidth(0.2);
		doc.line(14, yPos + 4, 196, yPos + 4);
		return yPos + 10;
	}

	function drawNotSelectedStock(doc: jsPDF, stock: FindingStock, yPos: number): number {
		const status = stock.deployment?.status ?? 'UNKNOWN';
		const statusColor: Record<string, [number,number,number]> = {
			WAIT: C.amber, REJECT: C.red, FAIL: C.slate,
			OVERPRICED: C.red, NO_DATA: C.slate
		};
		const sc = stock.screener;

		const sc_ = statusColor[status] ?? C.slate;
		fill(doc, sc_);
		doc.roundedRect(14, yPos - 3, 18, 5, 1, 1, 'F');
		ink(doc, C.white);
		doc.setFontSize(7);
		doc.setFont('helvetica', 'bold');
		doc.text(status, 15, yPos);
		doc.setFont('helvetica', 'normal');

		ink(doc, C.navy);
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text(stock.ticker, 35, yPos);
		doc.setFont('helvetica', 'normal');
		ink(doc, C.slate);
		doc.setFontSize(8);
		doc.text(`${stock.name ?? ''}  ·  ${sc?.engine ?? 'N/A'}  score ${sc?.score ?? 'N/A'}  ·  Base ${stock.baseCagr == null ? 'N/A' : `${stock.baseCagr}%`}  Bear ${stock.bearCagr == null ? 'N/A' : `${stock.bearCagr}%`}`, 55, yPos);
		yPos += 5;

		const reason = stock.deployment?.reason ?? sc?.note ?? 'N/A';
		ink(doc, C.slate);
		doc.setFontSize(7.5);
		drawTextLines(doc, reason, 178, 14, yPos);
		return yPos + textLines(doc, reason, 178) * 4 + 4;
	}

	// ── Helper: draw a gate box ────────────────────────────────────────────────
	function gateBox(
		doc: jsPDF,
		x: number, y: number, w: number, h: number,
		num: string, title: string, lines: string[],
		accent: [number,number,number], bg: [number,number,number]
	) {
		fill(doc, bg);
		doc.roundedRect(x, y, w, h, 2, 2, 'F');
		fill(doc, accent);
		doc.roundedRect(x, y, w, 8, 2, 2, 'F');
		doc.rect(x, y + 4, w, 4, 'F'); // square bottom corners on top bar

		ink(doc, C.white);
		doc.setFontSize(8);
		doc.setFont('helvetica', 'bold');
		doc.text(`${num}  ${title}`, x + 4, y + 5.5);
		doc.setFont('helvetica', 'normal');

		ink(doc, C.navy);
		doc.setFontSize(8);
		let ly = y + 13;
		for (const line of lines) {
			doc.text(line, x + 4, ly);
			ly += 5;
		}
	}

	// ── Page 1: Cover + Pipeline ───────────────────────────────────────────────
	function drawMethodologyPage(doc: jsPDF) {
		const pw = 210;

		fill(doc, C.navy);
		doc.rect(0, 0, pw, 32, 'F');

		ink(doc, C.white);
		doc.setFontSize(18);
		doc.setFont('helvetica', 'bold');
		doc.text('High Performance Stocks', 14, 13);
		doc.setFontSize(10);
		doc.setFont('helvetica', 'normal');
		ink(doc, [148, 163, 184]);
		doc.text('Deployment Report  ·  ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 14, 21);
		doc.text(`${deployNow.length} stocks deployed  ·  ${deployNow.length + cheapWait.length + watchlist.length} stocks screened`, 14, 27.5);

		ink(doc, C.navy);
		doc.setFontSize(13);
		doc.setFont('helvetica', 'bold');
		doc.text('How It Works', 14, 44);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		ink(doc, C.slate);
		doc.text('Every stock passes through three sequential gates before being marked for deployment.', 14, 50);

		const gw = 54, gh = 46, gy = 54, gap = 10;
		gateBox(doc, 14, gy, gw, gh, '(1)', 'SCREEN', [
			'Compare valuation multiple',
			'to EPS growth rate.',
			'Score < 1.0 = cheap.',
			'Lower is better.',
		], C.blue, C.blueL);

		gateBox(doc, 14 + gw + gap, gy, gw, gh, '(2)', 'RETURN CHECK', [
			`Base 1Y return >= ${hurdles.etfCagr}%`,
			`Bear floor > ${hurdles.bearFloor}%`,
			'Derived from analyst',
			'low / mean / high targets.',
		], C.green, C.greenL);

		gateBox(doc, 14 + (gw + gap) * 2, gy, gw, gh, '(3)', 'RANK & DEPLOY', [
			'Multi-factor score:',
			'Valuation + Returns',
			'+ Momentum + Quality',
			'+ Conviction (QCS)',
		], C.amber, C.amberL);

		drawGateArrows(doc, gw, gap, gy, gh);
		drawScreenerEngines(doc, pw);
		drawRankingFormula(doc, pw);
		drawDataSources(doc, pw);
	}

	function drawGateArrows(doc: jsPDF, gw: number, gap: number, gy: number, gh: number): void {
		stroke(doc, C.slate);
		doc.setLineWidth(0.4);
		const ax1 = 14 + gw + 1, ax2 = 14 + gw + gap - 1;
		const ay = gy + gh / 2;
		doc.line(ax1, ay, ax2, ay);
		doc.line(ax2 - 2, ay - 1.5, ax2, ay);
		doc.line(ax2 - 2, ay + 1.5, ax2, ay);
		const bx1 = 14 + (gw + gap) + gw + 1, bx2 = 14 + (gw + gap) * 2 - 1;
		doc.line(bx1, ay, bx2, ay);
		doc.line(bx2 - 2, ay - 1.5, bx2, ay);
		doc.line(bx2 - 2, ay + 1.5, bx2, ay);
		doc.setLineWidth(0.2);
	}

	function drawScreenerEngines(doc: jsPDF, pw: number): void {
		let y = 110;
		ink(doc, C.navy);
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('Screener Engines', 14, y);
		doc.setFont('helvetica', 'normal');
		y += 2;

		stroke(doc, [200, 210, 220]);
		doc.setLineWidth(0.3);
		doc.line(14, y + 1, pw - 14, y + 1);
		doc.setLineWidth(0.2);
		y += 5;

		const engines = [
			['fPERG', 'Forward P/E / EPS Growth x Risk', 'Default engine for growth stocks.'],
			['tPERG', 'Trailing P/E / EPS Growth x Risk', 'Used when no forward P/E is available.'],
			['fEVG',  'EV/EBITDA / EPS Growth x Risk',   'Serial acquirers (amortization distorts earnings).'],
			['fFREG', 'P/FRE / FRE Growth x Risk',       'Alt asset managers on Fee-Related Earnings.'],
			['fANIG', 'P/ANI / ANI Growth x Risk',       'Distributors using Adjusted Net Income.'],
			['fCFG',  'EV/FCF or P/CF / Growth x Risk',  'Capital-light royalty & cash-flow businesses.'],
			['totalReturn', '12% / (Yield + Growth)',    'Income stocks with >=5% dividend yield.'],
		];

		for (const [eng, formula, note] of engines) {
			if (!eng || !formula || !note) continue;
			fill(doc, C.slateL);
			doc.roundedRect(14, y - 3.5, 22, 5.5, 1, 1, 'F');
			ink(doc, C.blue);
			doc.setFontSize(7.5);
			doc.setFont('helvetica', 'bold');
			doc.text(eng, 16, y);
			doc.setFont('helvetica', 'normal');

			ink(doc, C.navy);
			doc.setFontSize(8);
			doc.text(formula, 38, y);
			ink(doc, C.slate);
			doc.setFontSize(7.5);
			doc.text(note, 38, y + 4.5);
			y += 11;
		}

		y += 1;
		ink(doc, C.slate);
		doc.setFontSize(7);
		doc.text('Risk = analyst estimate dispersion multiplier: 1 + 0.6 x (CV - 0.08), where CV = (high - low) / 4 / avg estimate. Defaults to 1.0 when dispersion unavailable.', 14, y);
		y += 4;
		doc.text('12% = total return hurdle for income stocks (Yield + Growth). Score 1.0 = exactly 12%; below 1.0 = above hurdle (PASS); above 1.0 = below hurdle (FAIL).', 14, y);
	}

	function drawRankingFormula(doc: jsPDF, pw: number): void {
		let y = 197;
		y += 2;
		ink(doc, C.navy);
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('Deployment Rank Formula', 14, y);
		doc.setFont('helvetica', 'normal');
		y += 2;
		stroke(doc, [200, 210, 220]);
		doc.setLineWidth(0.3);
		doc.line(14, y + 1, pw - 14, y + 1);
		doc.setLineWidth(0.2);
		y += 6;

		const factors = [
			{ label: 'Valuation',  detail: '(1.2 - score) x 25',                            color: C.blue   },
			{ label: 'Returns',    detail: 'Base x 1.2 + Bear x 0.8 + Upside x 0.1',       color: C.green  },
			{ label: 'Momentum',   detail: '6-1 month Z-score x 7.5  (capped +/-15)',        color: C.amber  },
			{ label: 'Quality',    detail: 'ROE/25% x 5 + FCF Yield/5% x 5  (max 10 pts)', color: C.slate  },
			{ label: 'QCS',        detail: 'Surprise + Smart Money + Revisions  (max 15)',  color: C.red    },
		];

		const bw = (pw - 28 - 16) / factors.length;
		const barH = 6;
		let bx = 14;
		for (const f of factors) {
			fill(doc, f.color);
			doc.roundedRect(bx, y, bw, barH, 1, 1, 'F');
			ink(doc, C.white);
			doc.setFontSize(7);
			doc.setFont('helvetica', 'bold');
			doc.text(f.label, bx + bw / 2, y + 4, { align: 'center' });
			doc.setFont('helvetica', 'normal');
			bx += bw + 4;
		}
		y += barH + 5;

		for (const f of factors) {
			ink(doc, f.color);
			doc.setFontSize(8);
			doc.setFont('helvetica', 'bold');
			doc.text(`${f.label}:`, 14, y);
			doc.setFont('helvetica', 'normal');
			ink(doc, C.navy);
			doc.text(f.detail, 40, y);
			y += 5.5;
		}
	}

	function drawDataSources(doc: jsPDF, pw: number): void {
		const y = 250;
		fill(doc, C.slateL);
		doc.roundedRect(14, y, pw - 28, 20, 2, 2, 'F');
		ink(doc, C.navy);
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text('Data Sources', 18, y + 6);
		doc.setFont('helvetica', 'normal');
		ink(doc, C.slate);
		doc.setFontSize(8);
		doc.text('Yahoo Finance - live prices, analyst targets (low/mean/high), EPS estimates, revisions, earnings history', 18, y + 12);
		doc.text('Financial Modelling Prep - DCF intrinsic value estimates', 18, y + 17);
	}

	function downloadPdf() {
		if (isGenerating) return;

		isGenerating = true;
		error = null;

		try {
			const notSelected = [...cheapWait, ...watchlist];
			const doc = new jsPDF();

			// ── Page 1: Methodology ──────────────────────────────────────────
			drawMethodologyPage(doc);

			// ── Deployed stocks ──────────────────────────────────────────────
			doc.addPage();
			let yPos = 14;

			// Section header
			fill(doc, C.green);
			doc.rect(0, 0, 210, 10, 'F');
			ink(doc, C.white);
			doc.setFontSize(10);
			doc.setFont('helvetica', 'bold');
			doc.text(`Deploy Now  ·  ${deployNow.length} stocks`, 14, 7);
			doc.setFont('helvetica', 'normal');
			yPos = 18;

			for (const stock of deployNow) {
				if (yPos > 230) { doc.addPage(); yPos = 14; }
				yPos = drawDeployedStock(doc, stock, yPos);
			}

			// ── Stocks not selected — audit trail ────────────────────────────
			if (notSelected.length > 0) {
				doc.addPage();
				fill(doc, C.navy);
				doc.rect(0, 0, 210, 10, 'F');
				ink(doc, C.white);
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.text(`Not Selected  ·  ${notSelected.length} stocks  ·  Audit Trail`, 14, 7);
				doc.setFont('helvetica', 'normal');
				yPos = 18;

				ink(doc, C.slate);
				doc.setFontSize(8);
				doc.text(`Hurdles: Base >= ${hurdles.etfCagr}%  ·  Bear > ${hurdles.bearFloor}%  ·  Screener score < 1.0 (lower = better)`, 14, yPos);
				yPos += 8;

				for (const stock of notSelected) {
					if (yPos > 260) { doc.addPage(); yPos = 14; }
					yPos = drawNotSelectedStock(doc, stock, yPos);
				}
			}

			doc.save('HPS_Deployment_Report.pdf');
		} catch (error_) {
			error = 'Failed to generate report. Please try again.';
			console.error('PDF generation error:', error_);
		} finally {
			isGenerating = false;
		}
	}
</script>

<button class="btn-download" onclick={downloadPdf} disabled={isGenerating}>
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
		<polyline points="7 10 12 15 17 10"></polyline>
		<line x1="12" y1="15" x2="12" y2="3"></line>
	</svg>
	{isGenerating ? 'Generating...' : 'Download Report (PDF)'}
</button>

{#if error}
	<p class="error-message">{error}</p>
{/if}

<style>
	.btn-download {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--bg-surface);
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-download:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-download:hover:not(:disabled) {
		background-color: var(--bg-surface-hover);
		border-color: var(--border-hover);
	}

	.error-message {
		margin-top: 0.5rem;
		color: #f87171;
		font-size: 0.875rem;
	}
</style>
