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

	function toggle(ticker) {
		expanded[ticker] = !expanded[ticker];
	}

	const badge = { high: '#22c55e', medium: '#eab308', low: '#f97316', cut: '#ef4444' };

	function upsideColor(u) {
		if (u == null) return '#525252';
		if (u < 0) return '#ef4444';
		if (u < 10) return '#f97316';
		if (u < 20) return '#eab308';
		return '#22c55e';
	}
</script>

<svelte:head>
	<title>Quality Torque Dashboard</title>
</svelte:head>

<main>
	<h1>Quality Torque Dashboard</h1>
	<p class="subtitle">
		{filtered.length} stocks shown &middot;
		Min CAGR floor: {data.cagrFloor}% (momentum ETF baseline)
	</p>

	<label class="toggle">
		<input type="checkbox" bind:checked={showAll} />
		Show all {data.stocks.length} assets (including below floor & cut)
	</label>

	<nav class="tabs">
		<button class="tab" class:active={activeGroup === 'All'} onclick={() => activeGroup = 'All'}>All</button>
		{#each data.groups as group (group)}
			<button class="tab" class:active={activeGroup === group} onclick={() => activeGroup = group}>{group}</button>
		{/each}
	</nav>

	<div class="grid">
		{#each filtered as stock (stock.ticker)}
			<button class="card" class:dimmed={stock.belowCAGRFloor || stock.confidence === 'cut'} onclick={() => toggle(stock.ticker)}>
				<div class="card-header">
					<span class="ticker">{stock.ticker}</span>
					<span class="badge" style="background:{badge[stock.confidence]}">{stock.confidence}</span>
				</div>
				<div class="name">{stock.name}</div>
				<div class="meta">
					<span>CAGR {stock.expectedCAGR}</span>
					<span>Sharpe {stock.sharpeRatio ?? stock.sharpeNote ?? '—'}</span>
				</div>
				{#if stock.currentPrice && stock.targetPrice}
					<div class="price-row">
						<span>{stock.currentPrice} &rarr; {stock.targetPrice}</span>
						{#if stock.upside != null}
							<span class="upside" style="color:{upsideColor(stock.upside)}">{stock.upside > 0 ? '+' : ''}{stock.upside}%</span>
						{/if}
					</div>
				{/if}
				{#if activeGroup === 'All'}
					<div class="group">{stock.group}</div>
				{/if}

				{#if stock.belowCAGRFloor}
					<div class="floor-warning">Below {data.cagrFloor}% CAGR floor</div>
				{:else if stock.cagrRangeLow < data.cagrFloor}
					<div class="floor-borderline">Borderline — upper range beats {data.cagrFloor}%</div>
				{/if}

				{#if expanded[stock.ticker]}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="details" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
						<p class="confidence-reason">{stock.confidenceReason}</p>

						{#if stock.bullCase}
							<div class="case bull">
								<strong>Bull:</strong> {stock.bullCase}
							</div>
						{/if}
						<div class="case bear">
							<strong>Bear:</strong> {stock.bearCase}
						</div>

						{#if stock.cagrModel?.scenarios}
							<div class="cagr-scenarios">
								<span class="scenario bear">{stock.cagrModel.scenarios.bear}</span>
								<span class="scenario base">{stock.cagrModel.scenarios.base}</span>
								<span class="scenario bull">{stock.cagrModel.scenarios.bull}</span>
							</div>
							<div class="cagr-labels">
								<span>Bear</span><span>Base</span><span>Bull</span>
							</div>
							<div class="cagr-detail">
								EPS growth {stock.cagrModel.epsGrowth} &middot;
								Exit P/E {stock.cagrModel.exitPE.bear}/{stock.cagrModel.exitPE.base}/{stock.cagrModel.exitPE.bull} &middot;
								DY {stock.cagrModel.dividendYield}
							</div>
							{#if stock.cagrModel.basis}
								<div class="cagr-basis">{stock.cagrModel.basis}</div>
							{/if}
						{/if}

						<table><tbody>
							{#if stock.marketCap}<tr><td>Market Cap</td><td>{stock.marketCap}</td></tr>{/if}
							{#if stock.currentPrice}<tr><td>Current Price</td><td>{stock.currentPrice}</td></tr>{/if}
							{#if stock.targetPrice}<tr><td>Target Price</td><td>{stock.targetPrice}{#if stock.upside != null} <span style="color:{upsideColor(stock.upside)}">({stock.upside > 0 ? '+' : ''}{stock.upside}%)</span>{/if}</td></tr>{/if}
							{#if stock.consensus}
								{#each Object.entries(stock.consensus) as [src, val] (src)}
									<tr><td style="padding-left:1rem">{src}</td><td>{val}</td></tr>
								{/each}
							{/if}
							{#if stock.expectedVolatility}<tr><td>Volatility</td><td>{stock.expectedVolatility}</td></tr>{/if}
							{#if stock.valuation.trailingPE}<tr><td>Trailing P/E</td><td>{stock.valuation.trailingPE}</td></tr>{/if}
							{#if stock.valuation.forwardPE}<tr><td>Forward P/E</td><td>{stock.valuation.forwardPE}</td></tr>{/if}
							{#if stock.valuation.pegRatio}<tr><td>PEG Ratio</td><td>{stock.valuation.pegRatio}</td></tr>{/if}
							{#if stock.valuation.evEbitda}<tr><td>EV/EBITDA</td><td>{stock.valuation.evEbitda}</td></tr>{/if}
							{#if stock.valuation.evFcf}<tr><td>EV/FCF</td><td>~{stock.valuation.evFcf}x</td></tr>{/if}
							{#if stock.valuation.priceToFRE}<tr><td>Price-to-FRE</td><td>{stock.valuation.priceToFRE}</td></tr>{/if}
							{#if stock.dcfFairValue}<tr><td>DCF Fair Value</td><td>{stock.dcfFairValue}</td></tr>{/if}
							{#each Object.entries(stock.metrics).filter(([,v]) => v) as [key, val] (key)}
								<tr><td>{key}</td><td>{val}</td></tr>
							{/each}
						</tbody></table>
					</div>
				{/if}
			</button>
		{/each}
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		background: #0a0a0a;
		color: #e5e5e5;
	}
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
	h1 {
		font-size: 1.5rem;
		margin: 0 0 0.25rem;
	}
	.subtitle {
		color: #a3a3a3;
		margin: 0 0 1rem;
		font-size: 0.875rem;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #a3a3a3;
		margin-bottom: 1.5rem;
		cursor: pointer;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: #333 transparent;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 4px;
	}
	.tab {
		all: unset;
		cursor: pointer;
		padding: 0.375rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 500;
		white-space: nowrap;
		background: #1e1e1e;
		color: #a3a3a3;
		border: 1px solid #333;
		transition: all 0.15s;
	}
	.tab:hover {
		border-color: #525252;
		color: #d4d4d4;
	}
	.tab.active {
		background: #e5e5e5;
		color: #0a0a0a;
		border-color: #e5e5e5;
		font-weight: 600;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 0.75rem;
	}
	.card {
		all: unset;
		cursor: pointer;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		transition: border-color 0.15s;
		text-align: left;
		box-sizing: border-box;
	}
	.card:hover {
		border-color: #404040;
	}
	.card.dimmed {
		opacity: 0.5;
	}
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.ticker {
		font-weight: 700;
		font-size: 1.1rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
	}
	.badge {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 9999px;
		color: #000;
	}
	.name {
		font-size: 0.8rem;
		color: #a3a3a3;
	}
	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		color: #d4d4d4;
		font-family: monospace;
	}
	.price-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.73rem;
		color: #a3a3a3;
		font-family: monospace;
	}
	.upside {
		font-weight: 700;
		font-size: 0.75rem;
	}
	.group {
		font-size: 0.7rem;
		color: #525252;
	}
	.floor-warning {
		font-size: 0.7rem;
		color: #f97316;
		font-weight: 600;
	}
	.floor-borderline {
		font-size: 0.7rem;
		color: #eab308;
	}
	.details {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #262626;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.confidence-reason {
		font-size: 0.8rem;
		color: #fbbf24;
		margin: 0;
		font-style: italic;
	}
	.case {
		font-size: 0.78rem;
		line-height: 1.4;
	}
	.case.bull {
		color: #86efac;
	}
	.case.bear {
		color: #fca5a5;
	}
	.cagr-scenarios {
		display: flex;
		justify-content: space-around;
		gap: 0.5rem;
	}
	.cagr-labels {
		display: flex;
		justify-content: space-around;
		gap: 0.5rem;
		font-size: 0.6rem;
		color: #525252;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}
	.scenario {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-weight: 700;
		font-size: 1rem;
		text-align: center;
		flex: 1;
	}
	.scenario.bear { color: #fca5a5; }
	.scenario.base { color: #e5e5e5; }
	.scenario.bull { color: #86efac; }
	.cagr-detail {
		font-size: 0.68rem;
		color: #737373;
		text-align: center;
		font-family: monospace;
	}
	.cagr-basis {
		font-size: 0.63rem;
		color: #525252;
		text-align: center;
		font-style: italic;
	}
	table {
		width: 100%;
		font-size: 0.72rem;
		border-collapse: collapse;
	}
	td {
		padding: 2px 0;
		border-bottom: 1px solid #1e1e1e;
	}
	td:first-child {
		color: #737373;
		width: 40%;
	}
	td:last-child {
		font-family: monospace;
		text-align: right;
	}
</style>
