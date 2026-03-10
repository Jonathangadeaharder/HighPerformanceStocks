<script>
	let { data } = $props();
	let expanded = $state({});
	let showAll = $state(false);
	let activeGroup = $state('All');

	let filtered = $derived.by(() => {
		let list = data.stocks;
		if (activeGroup !== 'All') {
			list = list.filter(s => s.group === activeGroup);
		}
		if (!showAll) {
			list = list.filter(s => !s.belowCAGRFloor && s.confidence !== 'cut');
		}
		return list;
	});

	let stats = $derived.by(() => {
		const f = filtered;
		const high = f.filter(s => s.confidence === 'high').length;
		const medium = f.filter(s => s.confidence === 'medium').length;
		const low = f.filter(s => s.confidence === 'low').length;
		const avgSharpe = f.length > 0
			? (f.reduce((sum, s) => sum + (s.sharpeRatio ?? 0), 0) / f.length).toFixed(2)
			: '—';
		return { high, medium, low, avgSharpe };
	});

	function toggle(ticker) {
		expanded[ticker] = !expanded[ticker];
	}

	const badgeColors = {
		high: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
		medium: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#facc15' },
		low: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#fb923c' },
		cut: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171' }
	};

	function upsideColor(u) {
		if (u == null) return '#525252';
		if (u < 0) return '#f87171';
		if (u < 10) return '#fb923c';
		if (u < 20) return '#facc15';
		return '#4ade80';
	}

	function scenarioColor(val) {
		const n = parseFloat(val);
		if (isNaN(n)) return '#737373';
		if (n <= 0) return '#f87171';
		if (n < 5) return '#fb923c';
		if (n < 10) return '#facc15';
		if (n < 15) return '#a3e635';
		return '#4ade80';
	}

	function formatMetricLabel(key) {
		const map = {
			fcfMargin: 'FCF Margin',
			fcfYield: 'FCF Yield',
			roic: 'ROIC',
			roe: 'ROE',
			netDebtEbitda: 'Net Debt / EBITDA',
			ruleOf40: 'Rule of 40',
			grossMargin: 'Gross Margin',
			aum: 'AUM'
		};
		return map[key] || key;
	}
</script>

<svelte:head>
	<title>Quality Torque Dashboard</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
</svelte:head>

<div class="app">
	<header>
		<div class="header-inner">
			<div class="brand">
				<div class="logo-mark">QT</div>
				<div>
					<h1>Quality Torque</h1>
					<p class="tagline">High-conviction compounders with margin of safety</p>
				</div>
			</div>
			<div class="header-stats">
				<div class="stat">
					<span class="stat-value">{filtered.length}</span>
					<span class="stat-label">Positions</span>
				</div>
				<div class="stat-divider"></div>
				<div class="stat">
					<span class="stat-value">{stats.high}</span>
					<span class="stat-label" style="color:#4ade80">High Conv.</span>
				</div>
				<div class="stat">
					<span class="stat-value">{stats.medium}</span>
					<span class="stat-label" style="color:#facc15">Medium</span>
				</div>
				<div class="stat">
					<span class="stat-value">{stats.low}</span>
					<span class="stat-label" style="color:#fb923c">Low</span>
				</div>
				<div class="stat-divider"></div>
				<div class="stat">
					<span class="stat-value">{stats.avgSharpe}</span>
					<span class="stat-label">Avg Sharpe</span>
				</div>
			</div>
		</div>
	</header>

	<main>
		<div class="controls">
			<nav class="tabs">
				<button class="tab" class:active={activeGroup === 'All'} onclick={() => activeGroup = 'All'}>
					All
					<span class="tab-count">{showAll ? data.stocks.length : data.stocks.filter(s => !s.belowCAGRFloor && s.confidence !== 'cut').length}</span>
				</button>
				{#each data.groups as group (group)}
					{@const count = showAll
						? data.stocks.filter(s => s.group === group).length
						: data.stocks.filter(s => s.group === group && !s.belowCAGRFloor && s.confidence !== 'cut').length}
					{#if count > 0 || showAll}
						<button class="tab" class:active={activeGroup === group} onclick={() => activeGroup = group}>
							{group}
							<span class="tab-count">{count}</span>
						</button>
					{/if}
				{/each}
			</nav>

			<label class="toggle-label">
				<span class="toggle-track" class:on={showAll}>
					<span class="toggle-thumb"></span>
				</span>
				<input type="checkbox" bind:checked={showAll} class="sr-only" />
				<span class="toggle-text">Show below floor & cut</span>
			</label>
		</div>

		<div class="floor-note">
			Min CAGR floor: {data.cagrFloor}% (momentum ETF baseline)
		</div>

		<div class="grid">
			{#each filtered as stock, i (stock.ticker)}
				<button
					class="card"
					class:dimmed={stock.belowCAGRFloor || stock.confidence === 'cut'}
					class:expanded={expanded[stock.ticker]}
					onclick={() => toggle(stock.ticker)}
					style="animation-delay: {Math.min(i * 30, 600)}ms"
				>
					<div class="card-top">
						<div class="card-header">
							<div class="ticker-group">
								<span class="ticker">{stock.ticker}</span>
								{#if activeGroup === 'All'}
									<span class="group-tag">{stock.group}</span>
								{/if}
							</div>
							<div class="badge-row">
								{#if stock.dataAge != null && stock.dataAge > 7}
									<span class="stale-badge" title="Last updated {stock.dataAge} days ago">{stock.dataAge}d</span>
								{/if}
								<span
									class="badge"
									style="background:{badgeColors[stock.confidence].bg};border-color:{badgeColors[stock.confidence].border};color:{badgeColors[stock.confidence].text}"
								>
									{stock.confidence}
								</span>
							</div>
						</div>

						<div class="name">{stock.name}</div>

						<div class="key-metrics">
							<div class="km">
								<span class="km-label">CAGR</span>
								<span class="km-value">{stock.expectedCAGR}</span>
							</div>
							<div class="km">
								<span class="km-label">Sharpe</span>
								<span class="km-value">{stock.sharpeRatio ?? '—'}</span>
							</div>
							{#if stock.currentPrice}
								<div class="km">
									<span class="km-label">Price</span>
									<span class="km-value">{stock.currentPrice}</span>
								</div>
							{/if}
							{#if stock.upside != null}
								<div class="km">
									<span class="km-label">Upside</span>
									<span class="km-value" style="color:{upsideColor(stock.upside)}">{stock.upside > 0 ? '+' : ''}{stock.upside}%</span>
								</div>
							{/if}
						</div>

						{#if stock.belowCAGRFloor}
							<div class="floor-warning">Below {data.cagrFloor}% CAGR floor</div>
						{:else if stock.cagrModel?.scenarios?.base && parseFloat(stock.cagrModel.scenarios.base) < data.cagrFloor && stock.cagrRangeHigh >= data.cagrFloor}
							<div class="floor-borderline">Borderline — base scenario &lt; {data.cagrFloor}%</div>
						{/if}
					</div>

					{#if expanded[stock.ticker]}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="details" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
							<p class="confidence-reason">{stock.confidenceReason}</p>

							{#if stock.cagrModel?.scenarios}
								<div class="scenarios-panel">
									<div class="scenario-header">CAGR Scenarios ({stock.cagrModel.horizon}yr)</div>
									<div class="scenarios-row">
										<div class="scenario-item">
											<span class="scenario-label">Bear</span>
											<span class="scenario-value" style="color:{scenarioColor(stock.cagrModel.scenarios.bear)}">{stock.cagrModel.scenarios.bear}</span>
										</div>
										<div class="scenario-item base">
											<span class="scenario-label">Base</span>
											<span class="scenario-value" style="color:{scenarioColor(stock.cagrModel.scenarios.base)}">{stock.cagrModel.scenarios.base}</span>
										</div>
										<div class="scenario-item">
											<span class="scenario-label">Bull</span>
											<span class="scenario-value" style="color:{scenarioColor(stock.cagrModel.scenarios.bull)}">{stock.cagrModel.scenarios.bull}</span>
										</div>
									</div>
									<div class="scenario-params">
										EPS growth {stock.cagrModel.epsGrowth}
										<span class="param-sep"></span>
										Exit P/E {stock.cagrModel.exitPE.bear}/{stock.cagrModel.exitPE.base}/{stock.cagrModel.exitPE.bull}
										<span class="param-sep"></span>
										DY {stock.cagrModel.dividendYield}
									</div>
									{#if stock.cagrModel.basis}
										<div class="scenario-basis">{stock.cagrModel.basis}</div>
									{/if}
								</div>
							{/if}

							<div class="cases">
								{#if stock.bullCase}
									<div class="case bull">
										<div class="case-label">Bull Case</div>
										<p>{stock.bullCase}</p>
									</div>
								{/if}
								<div class="case bear">
									<div class="case-label">Bear Case</div>
									<p>{stock.bearCase}</p>
								</div>
							</div>

							<div class="data-section">
								<div class="data-label">Fundamentals</div>
								<div class="data-grid">
									{#if stock.marketCap}
										<div class="data-cell"><span class="dc-label">Mkt Cap</span><span class="dc-value">{stock.marketCap}</span></div>
									{/if}
									{#if stock.targetPrice}
										<div class="data-cell">
											<span class="dc-label">Target</span>
											<span class="dc-value">{stock.targetPrice}{#if stock.upside != null} <span style="color:{upsideColor(stock.upside)}; font-size:0.65rem">({stock.upside > 0 ? '+' : ''}{stock.upside}%)</span>{/if}</span>
										</div>
									{/if}
									{#if stock.expectedVolatility}
										<div class="data-cell"><span class="dc-label">Volatility</span><span class="dc-value">{stock.expectedVolatility}</span></div>
									{/if}
									{#if stock.valuation.trailingPE}
										<div class="data-cell"><span class="dc-label">Trail P/E</span><span class="dc-value">{stock.valuation.trailingPE}</span></div>
									{/if}
									{#if stock.valuation.forwardPE}
										<div class="data-cell"><span class="dc-label">Fwd P/E</span><span class="dc-value">{stock.valuation.forwardPE}</span></div>
									{/if}
									{#if stock.valuation.pegRatio}
										<div class="data-cell"><span class="dc-label">PEG</span><span class="dc-value">{stock.valuation.pegRatio}</span></div>
									{/if}
									{#if stock.valuation.evEbitda}
										<div class="data-cell"><span class="dc-label">EV/EBITDA</span><span class="dc-value">{stock.valuation.evEbitda}</span></div>
									{/if}
									{#if stock.valuation.evFcf}
										<div class="data-cell"><span class="dc-label">EV/FCF</span><span class="dc-value">~{stock.valuation.evFcf}x</span></div>
									{/if}
									{#if stock.valuation.priceToFRE}
										<div class="data-cell"><span class="dc-label">P/FRE</span><span class="dc-value">{stock.valuation.priceToFRE}</span></div>
									{/if}
									{#if stock.dcfFairValue}
										<div class="data-cell"><span class="dc-label">DCF Value</span><span class="dc-value">{stock.dcfFairValue}</span></div>
									{/if}
									{#each Object.entries(stock.metrics).filter(([,v]) => v) as [key, val] (key)}
										<div class="data-cell"><span class="dc-label">{formatMetricLabel(key)}</span><span class="dc-value">{val}</span></div>
									{/each}
								</div>
							</div>

							{#if stock.consensus}
								<div class="data-section">
									<div class="data-label">Consensus Targets</div>
									<div class="consensus-row">
										{#each Object.entries(stock.consensus) as [src, val] (src)}
											<div class="consensus-item">
												<span class="consensus-src">{src}</span>
												<span class="consensus-val">{val}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>

		{#if filtered.length === 0}
			<div class="empty-state">
				No stocks match current filters.
			</div>
		{/if}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #08080a;
		color: #e5e5e5;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0,0,0,0);
		border: 0;
	}

	/* ── Header ── */
	header {
		border-bottom: 1px solid #1a1a1e;
		background: linear-gradient(180deg, #0e0e12 0%, #08080a 100%);
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(12px);
	}

	.header-inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.logo-mark {
		width: 38px;
		height: 38px;
		border-radius: 8px;
		background: linear-gradient(135deg, #c9a84c 0%, #8b6914 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 0.875rem;
		color: #000;
		letter-spacing: -0.02em;
		flex-shrink: 0;
	}

	h1 {
		font-family: 'DM Sans', sans-serif;
		font-size: 1.15rem;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.02em;
		color: #f5f5f5;
	}

	.tagline {
		font-size: 0.72rem;
		color: #52525b;
		margin: 0.1rem 0 0;
		letter-spacing: 0.01em;
	}

	.header-stats {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
	}

	.stat-value {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 600;
		font-size: 1.1rem;
		color: #f5f5f5;
	}

	.stat-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #52525b;
		font-weight: 500;
	}

	.stat-divider {
		width: 1px;
		height: 28px;
		background: #1a1a1e;
	}

	/* ── Main ── */
	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.25rem 1.5rem 3rem;
	}

	/* ── Controls ── */
	.controls {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}

	.tabs {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		flex: 1;
	}

	.tab {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
		background: transparent;
		color: #71717a;
		border: 1px solid transparent;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tab:hover {
		color: #a1a1aa;
		background: #12121a;
	}

	.tab.active {
		background: #18181b;
		color: #f5f5f5;
		border-color: #27272a;
	}

	.tab-count {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: #3f3f46;
		font-weight: 600;
	}

	.tab.active .tab-count {
		color: #71717a;
	}

	/* ── Toggle ── */
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.toggle-track {
		width: 32px;
		height: 18px;
		border-radius: 9px;
		background: #27272a;
		position: relative;
		transition: background 0.2s;
	}

	.toggle-track.on {
		background: #c9a84c;
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #71717a;
		transition: all 0.2s;
	}

	.toggle-track.on .toggle-thumb {
		left: 16px;
		background: #000;
	}

	.toggle-text {
		font-size: 0.7rem;
		color: #52525b;
	}

	.floor-note {
		font-size: 0.68rem;
		color: #3f3f46;
		margin-bottom: 1.25rem;
		font-family: 'JetBrains Mono', monospace;
	}

	/* ── Grid ── */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 0.625rem;
	}

	/* ── Card ── */
	@keyframes cardIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.card {
		all: unset;
		cursor: pointer;
		background: #0e0e12;
		border: 1px solid #18181b;
		border-radius: 10px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0;
		transition: all 0.2s ease;
		text-align: left;
		box-sizing: border-box;
		animation: cardIn 0.35s ease both;
		position: relative;
		overflow: hidden;
	}

	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, #27272a 30%, #27272a 70%, transparent);
		opacity: 0;
		transition: opacity 0.2s;
	}

	.card:hover {
		border-color: #27272a;
		background: #101016;
	}

	.card:hover::before {
		opacity: 1;
	}

	.card.expanded {
		border-color: #c9a84c33;
		background: #0f0f14;
	}

	.card.dimmed {
		opacity: 0.4;
	}

	.card-top {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.ticker-group {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.ticker {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 1rem;
		color: #f5f5f5;
		letter-spacing: -0.01em;
	}

	.group-tag {
		font-size: 0.6rem;
		color: #3f3f46;
		font-weight: 500;
	}

	.badge-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.stale-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.55rem;
		font-weight: 600;
		color: #f87171;
		background: rgba(239,68,68,0.1);
		border: 1px solid rgba(239,68,68,0.25);
		padding: 1px 5px;
		border-radius: 3px;
		letter-spacing: 0.02em;
	}

	.badge {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 4px;
		border: 1px solid;
		letter-spacing: 0.04em;
	}

	.name {
		font-size: 0.78rem;
		color: #52525b;
		font-weight: 400;
	}

	/* ── Key Metrics Row ── */
	.key-metrics {
		display: flex;
		gap: 0.125rem;
		margin-top: 0.375rem;
	}

	.km {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.375rem 0.5rem;
		background: #0a0a0e;
		border-radius: 5px;
	}

	.km:first-child { border-radius: 5px 2px 2px 5px; }
	.km:last-child { border-radius: 2px 5px 5px 2px; }

	.km-label {
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #3f3f46;
		font-weight: 500;
	}

	.km-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.72rem;
		font-weight: 600;
		color: #a1a1aa;
	}

	/* ── Floor Warnings ── */
	.floor-warning {
		font-size: 0.65rem;
		color: #fb923c;
		font-weight: 600;
		margin-top: 0.25rem;
	}

	.floor-borderline {
		font-size: 0.65rem;
		color: #facc15;
		margin-top: 0.25rem;
	}

	/* ── Expanded Details ── */
	.details {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #18181b;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.confidence-reason {
		font-size: 0.75rem;
		color: #c9a84c;
		margin: 0;
		line-height: 1.5;
		padding: 0.5rem 0.625rem;
		background: #c9a84c08;
		border-left: 2px solid #c9a84c33;
		border-radius: 0 4px 4px 0;
	}

	/* ── Scenarios ── */
	.scenarios-panel {
		background: #0a0a0e;
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scenario-header {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #3f3f46;
		font-weight: 600;
	}

	.scenarios-row {
		display: flex;
		gap: 0.375rem;
	}

	.scenario-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		background: #0e0e14;
		border-radius: 6px;
		border: 1px solid #18181b;
	}

	.scenario-item.base {
		border-color: #27272a;
		background: #12121a;
	}

	.scenario-label {
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #52525b;
		font-weight: 500;
	}

	.scenario-value {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.scenario-params {
		font-size: 0.62rem;
		color: #3f3f46;
		font-family: 'JetBrains Mono', monospace;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.param-sep {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: #27272a;
		flex-shrink: 0;
	}

	.scenario-basis {
		font-size: 0.6rem;
		color: #27272a;
		text-align: center;
		font-style: italic;
	}

	/* ── Cases ── */
	.cases {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.case {
		font-size: 0.73rem;
		line-height: 1.55;
		padding: 0.5rem 0.625rem;
		border-radius: 6px;
	}

	.case p {
		margin: 0;
	}

	.case-label {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.case.bull {
		background: rgba(34,197,94,0.04);
		color: #86efac;
		border: 1px solid rgba(34,197,94,0.08);
	}

	.case.bull .case-label {
		color: #4ade80;
	}

	.case.bear {
		background: rgba(239,68,68,0.04);
		color: #fca5a5;
		border: 1px solid rgba(239,68,68,0.08);
	}

	.case.bear .case-label {
		color: #f87171;
	}

	/* ── Data Section ── */
	.data-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.data-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #3f3f46;
		font-weight: 600;
	}

	.data-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: #18181b;
		border-radius: 6px;
		overflow: hidden;
	}

	.data-cell {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.35rem 0.5rem;
		background: #0e0e12;
	}

	.dc-label {
		font-size: 0.65rem;
		color: #52525b;
	}

	.dc-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		color: #a1a1aa;
		font-weight: 500;
		text-align: right;
	}

	/* ── Consensus ── */
	.consensus-row {
		display: flex;
		gap: 0.375rem;
	}

	.consensus-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.375rem 0.5rem;
		background: #0a0a0e;
		border-radius: 5px;
	}

	.consensus-src {
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #3f3f46;
		font-weight: 500;
	}

	.consensus-val {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.72rem;
		color: #a1a1aa;
		font-weight: 500;
	}

	/* ── Empty State ── */
	.empty-state {
		text-align: center;
		padding: 4rem 1rem;
		color: #3f3f46;
		font-size: 0.85rem;
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.header-inner {
			flex-direction: column;
			align-items: flex-start;
			padding: 0.875rem 1rem;
		}

		.header-stats {
			gap: 0.75rem;
			width: 100%;
			overflow-x: auto;
		}

		main {
			padding: 1rem;
		}

		.controls {
			flex-direction: column;
		}

		.grid {
			grid-template-columns: 1fr;
		}

		.data-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
