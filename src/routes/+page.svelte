<script>
	let { data } = $props();
	let expandedDeploy = $state(null);
	let expandedWait = $state(null);
	let showWatchlist = $state(false);
	let expandedWatch = $state({});

	function toggleDeploy(ticker) {
		expandedDeploy = expandedDeploy === ticker ? null : ticker;
	}

	function toggleWait(ticker) {
		expandedWait = expandedWait === ticker ? null : ticker;
	}

	function toggleWatch(ticker) {
		expandedWatch[ticker] = !expandedWatch[ticker];
	}

	function scoreColor(score) {
		if (score == null) return '#71717a';
		if (score <= 0.5) return '#22c55e';
		if (score <= 0.75) return '#4ade80';
		return '#a3e635';
	}

	function upsideColor(n) {
		if (n == null) return '#52525b';
		if (n < 0) return '#f87171';
		if (n < 15) return '#facc15';
		return '#4ade80';
	}

	function usesGrowthScore(stock) {
		return stock.screener.engine !== 'totalReturn' && stock.screener.engine !== 'N/A';
	}

	function scoreLabel(stock) {
		if (usesGrowthScore(stock)) {
			return `${stock.screener.score} score`;
		}
		return `${stock.screener.score}% return`;
	}
</script>

<svelte:head>
	<title>Portfolio Dashboard</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="page">
	<header>
		<h1>Portfolio Dashboard</h1>
		<p class="meta">Updated {data.lastUpdated} · {data.counts.total} stocks tracked</p>
	</header>

	<!-- Core Allocation -->
	<section class="section">
		<div class="section-label">Core Allocation</div>
		<div class="mini-guide">Why this is here: ETFs are the default portfolio. Stocks only earn capital when the evidence is unusually strong.</div>
		<div class="alloc-grid">
			<div class="alloc-box scv">
				<div class="alloc-pct">45%</div>
				<div class="alloc-name">Small Cap Value</div>
				<div class="alloc-sub">Global developed markets</div>
			</div>
			<div class="alloc-box mom">
				<div class="alloc-pct">45%</div>
				<div class="alloc-name">Momentum</div>
				<div class="alloc-sub">MSCI developed markets</div>
			</div>
			<div class="alloc-box em">
				<div class="alloc-pct">10%</div>
				<div class="alloc-name">Emerging Markets</div>
				<div class="alloc-sub">Cap-weighted</div>
			</div>
		</div>
		<p class="alloc-note">Default position is to stay in ETFs. Move capital into individual stocks only when valuation, forward return, and stabilization all agree.</p>
	</section>

	<!-- Deploy Now -->
	<section class="section">
		<div class="section-label">
			Deploy Now
			{#if data.deployNow.length > 0}
				<span class="count-badge green">{data.deployNow.length}</span>
			{/if}
		</div>
		<div class="mini-guide">Why this is here: these names are cheap enough, strong enough, and stable enough to justify leaving the ETF default.</div>
		<p class="section-note">Must pass the screener, be stabilized, and still beat the ETF alternative with base CAGR at least {data.hurdles.etfCagr}% and bear CAGR above {data.hurdles.bearFloor}%.</p>

		{#if data.topPicks.length > 0}
			<div class="top-picks">
				{#each data.topPicks as stock (stock.ticker)}
					<div class="top-pick">
						<div class="top-pick-label">{stock.pickLabel}</div>
						<div class="top-pick-header">
							<span class="ticker">{stock.ticker}</span>
							<span class="name">{stock.name}</span>
						</div>
						<div class="top-pick-metrics">
							<span>{scoreLabel(stock)}</span>
							<span>{stock.screener.inputs?.multipleType ?? stock.screener.engine}</span>
							<span>Base {stock.cagrModel?.scenarios?.base}</span>
							{#if stock.upside != null}
								<span style="color:{upsideColor(stock.upside)}">Upside {stock.upside > 0 ? '+' : ''}{stock.upside}%</span>
							{/if}
						</div>
						<div class="top-pick-note">Strong mix of valuation, expected return, and resilience right now.</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if data.deployNow.length === 0}
			<div class="empty-state">
				<p class="empty-title">No deployable stock signals</p>
				<p class="empty-sub">Nothing currently clears all three gates. Stay the course with ETFs.</p>
			</div>
		{:else}
			<div class="signal-list">
				{#each data.deployNow as stock (stock.ticker)}
					<button
						class="signal-card"
						class:expanded={expandedDeploy === stock.ticker}
						onclick={() => toggleDeploy(stock.ticker)}
					>
						<div class="signal-row1">
							<span class="ticker">{stock.ticker}</span>
							<span class="name">{stock.name}</span>
							<span class="group-tag">{stock.group}</span>
						</div>

						<div class="signal-row2">
							<span class="score" style="color:{usesGrowthScore(stock) ? scoreColor(stock.screener.score) : '#22c55e'}">
								{scoreLabel(stock)}
							</span>
							<span class="detail">
								{#if usesGrowthScore(stock)}
									{stock.screener.inputs.growth}% growth · {stock.screener.inputs.multiple}× {stock.screener.inputs.multipleType}
								{:else}
									{stock.screener.inputs.dividendYield}% yield + {stock.screener.inputs.growth}% growth{#if stock.screener.inputs.debtPenalty} · 30% debt penalty{/if}
								{/if}
							</span>
						</div>

						{#if stock.screener.realityChecks}
							<div class="signal-row3">
								{#if stock.screener.realityChecks.stabilization}
									<span class="rc pass">✓ {stock.screener.realityChecks.stabilization.return6m > 0 ? '+' : ''}{stock.screener.realityChecks.stabilization.return6m}% 6m</span>
									<span class="rc pass">✓ {stock.screener.realityChecks.stabilization.return1m > 0 ? '+' : ''}{stock.screener.realityChecks.stabilization.return1m}% 1m</span>
								{/if}
								{#if stock.screener.realityChecks.revisions}
									<span class="rc pass">✓ {stock.screener.realityChecks.revisions.up30d}↑ {stock.screener.realityChecks.revisions.down30d}↓ revisions</span>
								{/if}
							</div>
						{/if}

						<div class="signal-row4">
							<span class="mono">{stock.currentPrice}</span>
							{#if stock.targetPrice}
								<span class="arrow">→</span>
								<span class="mono">{stock.targetPrice}</span>
								{#if stock.upside != null}
									<span class="mono" style="color:{upsideColor(stock.upside)}">
										({stock.upside > 0 ? '+' : ''}{stock.upside}%)
									</span>
								{/if}
							{/if}
							<span class="spacer"></span>
							<span class="cagr">Rank {stock.deploymentRank} · Bear/Base/Bull {stock.cagrModel?.scenarios?.bear} / {stock.cagrModel?.scenarios?.base} / {stock.cagrModel?.scenarios?.bull}</span>
						</div>

						{#if expandedDeploy === stock.ticker}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="expanded" onclick={(e) => e.stopPropagation()}>
								<div class="summary-line success">{stock.deployment.reason}</div>
								{#if stock.cagrModel?.scenarios}
									<div class="scenarios-panel">
										<div class="scenarios-label">CAGR Scenarios ({stock.cagrModel.horizon || 5}yr)</div>
										<div class="scenarios-row">
											{#each ['bear', 'base', 'bull'] as s}
												{#if stock.cagrModel.scenarios[s]}
													<div class="scenario" class:base={s === 'base'}>
														<span class="scenario-label">{s}</span>
														<span class="scenario-value">{stock.cagrModel.scenarios[s]}</span>
													</div>
												{/if}
											{/each}
										</div>
										<div class="scenario-params">
											{#if stock.cagrModel.epsGrowth}EPS growth {stock.cagrModel.epsGrowth}{/if}
											{#if stock.cagrModel.exitPE?.base} · Exit PE {stock.cagrModel.exitPE.bear}/{stock.cagrModel.exitPE.base}/{stock.cagrModel.exitPE.bull}{/if}
											{#if stock.cagrModel.dividendYield && stock.cagrModel.dividendYield !== '0%'} · DY {stock.cagrModel.dividendYield}{/if}
										</div>
										{#if stock.cagrModel.basis}
											<div class="basis">{stock.cagrModel.basis}</div>
										{/if}
									</div>
								{/if}

								{#if stock.bullCase}
									<div class="case bull">
										<div class="case-label">Bull</div>
										<p>{stock.bullCase}</p>
									</div>
								{/if}
								{#if stock.bearCase}
									<div class="case bear">
										<div class="case-label">Bear</div>
										<p>{stock.bearCase}</p>
									</div>
								{/if}
							</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Cheap but wait -->
	<section class="section">
		<div class="section-label">
			Cheap, But Wait
			{#if data.cheapWait.length > 0}
				<span class="count-badge amber">{data.cheapWait.length}</span>
			{/if}
		</div>
		<div class="mini-guide">Why this is here: these may become opportunities, but the price action still suggests patience.</div>
		<p class="section-note">These stocks look cheap enough, but the drawdown still looks active. They are candidates for monitoring, not deployment.</p>

		{#if data.cheapWait.length === 0}
			<div class="empty-state compact">
				<p class="empty-sub">No stabilization candidates right now.</p>
			</div>
		{:else}
			<div class="signal-list">
				{#each data.cheapWait as stock (stock.ticker)}
					<button
						class="signal-card wait"
						class:expanded={expandedWait === stock.ticker}
						onclick={() => toggleWait(stock.ticker)}
					>
						<div class="signal-row1">
							<span class="ticker">{stock.ticker}</span>
							<span class="name">{stock.name}</span>
							<span class="group-tag">{stock.group}</span>
						</div>

						<div class="signal-row2">
							<span class="score" style="color:{scoreColor(stock.screener.score)}">{scoreLabel(stock)}</span>
							<span class="detail">{stock.deployment.reason}</span>
						</div>

						{#if stock.screener.realityChecks?.stabilization}
							<div class="signal-row3">
								<span class="rc wait">{stock.screener.realityChecks.stabilization.return6m > 0 ? '+' : ''}{stock.screener.realityChecks.stabilization.return6m}% 6m</span>
								<span class="rc wait">{stock.screener.realityChecks.stabilization.return1m > 0 ? '+' : ''}{stock.screener.realityChecks.stabilization.return1m}% 1m</span>
								{#if stock.screener.realityChecks.stabilization.near3mLow}
									<span class="rc wait">near 3m low</span>
								{/if}
							</div>
						{/if}

						<div class="signal-row4">
							<span class="mono">{stock.currentPrice}</span>
							{#if stock.targetPrice}
								<span class="arrow">→</span>
								<span class="mono">{stock.targetPrice}</span>
								{#if stock.upside != null}
									<span class="mono" style="color:{upsideColor(stock.upside)}">({stock.upside > 0 ? '+' : ''}{stock.upside}%)</span>
								{/if}
							{/if}
							<span class="spacer"></span>
							<span class="cagr">Bear/Base/Bull {stock.cagrModel?.scenarios?.bear} / {stock.cagrModel?.scenarios?.base} / {stock.cagrModel?.scenarios?.bull}</span>
						</div>

						{#if expandedWait === stock.ticker}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="expanded" onclick={(e) => e.stopPropagation()}>
								<div class="summary-line warn">{stock.screener.note}</div>
								{#if stock.bullCase}
									<div class="case bull">
										<div class="case-label">Bull</div>
										<p>{stock.bullCase}</p>
									</div>
								{/if}
								{#if stock.bearCase}
									<div class="case bear">
										<div class="case-label">Bear</div>
										<p>{stock.bearCase}</p>
									</div>
								{/if}
							</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Watchlist -->
	<section class="section">
		<button class="watchlist-header" onclick={() => showWatchlist = !showWatchlist}>
			<span class="section-label" style="margin:0">Watchlist</span>
			<span class="watchlist-counts">
				{data.counts.reject} rejected · {data.counts.fail} insufficient edge/return · {data.counts.noData} no data
			</span>
			<span class="chevron" class:open={showWatchlist}>›</span>
		</button>
		<div class="mini-guide" style="margin-top:0.5rem">Why this is here: these names currently fail on value, return, trend, revisions, or data quality.</div>

		{#if showWatchlist}
			<div class="watchlist">
				{#each data.watchlist as stock (stock.ticker)}
					<button class="watch-row" onclick={() => toggleWatch(stock.ticker)}>
						<div class="watch-main">
							<span class="watch-ticker">{stock.ticker}</span>
							<span class="watch-name">{stock.name}</span>
							<span class="watch-signal {stock.deployment?.status?.toLowerCase() ?? 'no_data'}">
								{stock.deployment?.status ?? 'N/A'}
							</span>
							{#if stock.screener?.engine !== 'N/A' && stock.screener?.score != null}
								<span class="watch-score">{stock.screener.inputs?.multipleType ?? stock.screener.engine} · {stock.screener.score}</span>
							{/if}
							{#if stock.screener?.realityChecks?.stabilization}
								<span class="watch-mom" class:neg={stock.screener.realityChecks.stabilization.return6m < 0}>{stock.screener.realityChecks.stabilization.return6m > 0 ? '+' : ''}{stock.screener.realityChecks.stabilization.return6m}%</span>
							{/if}
						</div>
						{#if expandedWatch[stock.ticker]}
							<div class="watch-detail">
								<span>{stock.deployment?.reason}</span>
								<span>CAGR {stock.expectedCAGR} · {stock.currentPrice}{#if stock.upside != null} → {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%){/if}</span>
							</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #09090b;
		color: #e4e4e7;
		-webkit-font-smoothing: antialiased;
	}

	.page {
		max-width: 860px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	header {
		margin-bottom: 2.5rem;
	}

	header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
		letter-spacing: -0.02em;
	}

	.meta {
		font-size: 0.75rem;
		color: #52525b;
		margin: 0;
	}

	/* ── Sections ── */
	.section {
		margin-bottom: 2.5rem;
	}

	.section-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #52525b;
		font-weight: 600;
		margin-bottom: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.section-note {
		font-size: 0.72rem;
		color: #52525b;
		margin: 0 0 0.75rem;
		line-height: 1.5;
	}

	.mini-guide {
		font-size: 0.72rem;
		color: #71717a;
		margin: 0 0 0.5rem;
		line-height: 1.45;
	}

	.count-badge {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 4px;
	}

	.count-badge.green {
		background: rgba(34, 197, 94, 0.12);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.25);
	}

	.count-badge.amber {
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.25);
	}

	.top-picks {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0 0 0.9rem;
	}

	.top-pick {
		padding: 0.8rem 0.9rem;
		border-radius: 8px;
		background: #111113;
		border: 1px solid rgba(34, 197, 94, 0.12);
	}

	.top-pick-label {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #4ade80;
		font-weight: 700;
		margin-bottom: 0.35rem;
	}

	.top-pick-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.top-pick-metrics {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		color: #a1a1aa;
	}

	.top-pick-note {
		font-size: 0.68rem;
		color: #71717a;
		margin-top: 0.45rem;
		line-height: 1.4;
	}

	/* ── Allocation ── */
	.alloc-grid {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.alloc-box {
		flex: 1;
		padding: 0.875rem 1rem;
		border-radius: 8px;
		background: #111113;
		border: 1px solid #1e1e22;
	}

	.alloc-box.scv { border-left: 3px solid rgba(59, 130, 246, 0.5); }
	.alloc-box.mom { border-left: 3px solid rgba(139, 92, 246, 0.5); }
	.alloc-box.em { border-left: 3px solid rgba(20, 184, 166, 0.5); }

	.alloc-pct {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.alloc-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #a1a1aa;
		margin-top: 0.125rem;
	}

	.alloc-sub {
		font-size: 0.68rem;
		color: #3f3f46;
		margin-top: 0.125rem;
	}

	.alloc-note {
		font-size: 0.72rem;
		color: #3f3f46;
		margin: 0;
		line-height: 1.5;
	}

	/* ── Empty state ── */
	.empty-state {
		padding: 2.5rem 2rem;
		text-align: center;
		background: #111113;
		border: 1px solid #1e1e22;
		border-radius: 8px;
	}

	.empty-state.compact {
		padding: 1.25rem;
		text-align: left;
	}

	.empty-title {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
		color: #71717a;
		font-weight: 500;
	}

	.empty-sub {
		margin: 0;
		font-size: 0.75rem;
		color: #3f3f46;
	}

	/* ── Signal cards ── */
	.signal-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.signal-card {
		all: unset;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		background: #111113;
		border: 1px solid #1e1e22;
		border-radius: 8px;
		text-align: left;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}

	.signal-card:hover { border-color: #27272a; }
	.signal-card.expanded { border-color: rgba(34, 197, 94, 0.2); }
	.signal-card.wait.expanded { border-color: rgba(245, 158, 11, 0.2); }

	.signal-row1 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.signal-row2 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.signal-row3 {
		display: flex;
		gap: 0.5rem;
	}

	.signal-row4 {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
	}

	.ticker {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 1rem;
		color: #f4f4f5;
	}

	.name {
		font-size: 0.78rem;
		color: #52525b;
	}

	.group-tag {
		font-size: 0.6rem;
		color: #3f3f46;
		margin-left: auto;
	}

	.score {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.score-unit {
		font-size: 0.65rem;
		font-weight: 500;
		opacity: 0.7;
	}

	.detail {
		font-size: 0.75rem;
		color: #71717a;
	}

	.rc {
		font-size: 0.7rem;
		font-family: 'JetBrains Mono', monospace;
		padding: 2px 8px;
		border-radius: 4px;
		font-weight: 500;
	}

	.rc.pass {
		background: rgba(34, 197, 94, 0.08);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.15);
	}

	.rc.wait {
		background: rgba(245, 158, 11, 0.08);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.15);
	}

	.mono {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		color: #a1a1aa;
	}

	.arrow { color: #3f3f46; font-size: 0.75rem; }
	.spacer { flex: 1; }

	.cagr {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.72rem;
		color: #71717a;
	}

	/* ── Expanded signal detail ── */
	.expanded {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid #1e1e22;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.summary-line {
		font-size: 0.72rem;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-weight: 500;
	}

	.summary-line.success {
		background: rgba(34, 197, 94, 0.05);
		color: #86efac;
		border: 1px solid rgba(34, 197, 94, 0.1);
	}

	.summary-line.warn {
		background: rgba(245, 158, 11, 0.05);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.1);
	}

	.scenarios-panel {
		background: #0a0a0e;
		padding: 0.75rem;
		border-radius: 6px;
	}

	.scenarios-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #3f3f46;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.scenarios-row {
		display: flex;
		gap: 0.375rem;
	}

	.scenario {
		flex: 1;
		text-align: center;
		padding: 0.5rem;
		background: #111113;
		border-radius: 6px;
		border: 1px solid #1e1e22;
	}

	.scenario.base { border-color: #27272a; }

	.scenario-label {
		display: block;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #52525b;
		font-weight: 500;
	}

	.scenario-value {
		display: block;
		font-family: 'JetBrains Mono', monospace;
		font-size: 1rem;
		font-weight: 700;
		color: #a1a1aa;
		margin-top: 0.125rem;
	}

	.scenario-params {
		font-size: 0.62rem;
		color: #3f3f46;
		font-family: 'JetBrains Mono', monospace;
		margin-top: 0.5rem;
		text-align: center;
	}

	.basis {
		font-size: 0.6rem;
		color: #27272a;
		margin-top: 0.375rem;
		text-align: center;
		font-style: italic;
	}

	.case {
		font-size: 0.73rem;
		line-height: 1.55;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
	}

	.case p { margin: 0; }

	.case-label {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.case.bull {
		background: rgba(34, 197, 94, 0.04);
		color: #86efac;
		border: 1px solid rgba(34, 197, 94, 0.08);
	}

	.case.bull .case-label { color: #4ade80; }

	.case.bear {
		background: rgba(239, 68, 68, 0.04);
		color: #fca5a5;
		border: 1px solid rgba(239, 68, 68, 0.08);
	}

	.case.bear .case-label { color: #f87171; }

	/* ── Watchlist ── */
	.watchlist-header {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: #111113;
		border: 1px solid #1e1e22;
		border-radius: 8px;
		box-sizing: border-box;
	}

	.watchlist-header:hover { border-color: #27272a; }

	.watchlist-counts {
		font-size: 0.68rem;
		color: #3f3f46;
		flex: 1;
	}

	.chevron {
		font-size: 1rem;
		color: #3f3f46;
		transition: transform 0.2s;
	}

	.chevron.open { transform: rotate(90deg); }

	.watchlist {
		margin-top: 0.5rem;
		border: 1px solid #1e1e22;
		border-radius: 8px;
		overflow: hidden;
	}

	.watch-row {
		all: unset;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid #141416;
		box-sizing: border-box;
		transition: background 0.1s;
	}

	.watch-row:last-child { border-bottom: none; }
	.watch-row:hover { background: #111113; }

	.watch-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.watch-ticker {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: #a1a1aa;
		width: 5.5rem;
		flex-shrink: 0;
	}

	.watch-name {
		font-size: 0.72rem;
		color: #3f3f46;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.watch-signal {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: 3px;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.watch-signal.reject {
		background: rgba(245, 158, 11, 0.1);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.2);
	}

	.watch-signal.fail {
		background: rgba(113, 113, 122, 0.08);
		color: #52525b;
		border: 1px solid rgba(113, 113, 122, 0.12);
	}

	.watch-signal.no_data {
		background: rgba(63, 63, 70, 0.08);
		color: #3f3f46;
		border: 1px solid rgba(63, 63, 70, 0.15);
	}

	.watch-score {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		color: #52525b;
		flex-shrink: 0;
	}

	.watch-mom {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		color: #52525b;
		flex-shrink: 0;
	}

	.watch-mom.neg { color: #f87171; }

	.watch-detail {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin-top: 0.375rem;
		padding-top: 0.375rem;
		border-top: 1px solid #141416;
		font-size: 0.68rem;
		color: #52525b;
	}

	/* ── Responsive ── */
	@media (max-width: 640px) {
		.page { padding: 1rem; }
		.alloc-grid { flex-direction: column; }
		.top-picks { grid-template-columns: 1fr; }
		.signal-row4 { flex-wrap: wrap; }
		.watch-name { display: none; }
	}
</style>
