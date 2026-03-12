<script lang="ts">
	import type { PageData } from './$types';

	type Stock = PageData['deployNow'][number];
	type ScenarioKey = 'bear' | 'base' | 'bull';
	type WorldVolSignal = PageData['worldVolSignal'];
	const scenarioKeys: ScenarioKey[] = ['bear', 'base', 'bull'];

	let { data }: { data: PageData } = $props();
	let expandedDeploy = $state<string | null>(null);
	let expandedWait = $state<string | null>(null);
	let showWatchlist = $state(false);
	let expandedWatch = $state<Record<string, boolean>>({});

	function toggleDeploy(ticker: string): void {
		expandedDeploy = expandedDeploy === ticker ? null : ticker;
	}

	function toggleWait(ticker: string): void {
		expandedWait = expandedWait === ticker ? null : ticker;
	}

	function toggleWatch(ticker: string): void {
		expandedWatch = {
			...expandedWatch,
			[ticker]: !expandedWatch[ticker]
		};
	}

	function scoreColor(score: number | null | undefined): string {
		if (score == null) return '#71717a';
		if (score <= 0.5) return '#22c55e';
		if (score <= 0.75) return '#4ade80';
		return '#a3e635';
	}

	function upsideColor(n: number | null | undefined): string {
		if (n == null) return '#52525b';
		if (n < 0) return '#f87171';
		if (n < 15) return '#facc15';
		return '#4ade80';
	}

	function usesGrowthScore(stock: Stock): boolean {
		return stock.screener?.engine !== 'totalReturn' && stock.screener?.engine !== 'N/A';
	}

	function scoreLabel(stock: Stock): string {
		if (usesGrowthScore(stock)) {
			return `${stock.screener?.score ?? 'N/A'} score`;
		}
		return `${stock.screener?.score ?? 'N/A'}% return`;
	}

	function screenerLabel(stock: Stock): string {
		return stock.screener?.inputs?.multipleType ?? stock.screener?.engine ?? 'N/A';
	}

	function detailLabel(stock: Stock): string {
		if (usesGrowthScore(stock)) {
			return `${stock.screener?.inputs?.growth ?? 'N/A'}% growth · ${stock.screener?.inputs?.multiple ?? 'N/A'}× ${screenerLabel(stock)}`;
		}

		const dividendYield = stock.screener?.inputs?.dividendYield ?? 'N/A';
		const growth = stock.screener?.inputs?.growth ?? 'N/A';
		const debtPenalty = stock.screener?.inputs?.debtPenalty ? ' · 30% debt penalty' : '';
		return `${dividendYield}% yield + ${growth}% growth${debtPenalty}`;
	}

	function stabilizationReturn(value: number | null | undefined = 0): string {
		const displayValue = value ?? 0;
		return `${displayValue > 0 ? '+' : ''}${displayValue}%`;
	}

	function deploymentReason(stock: Stock): string {
		return stock.deployment?.reason ?? 'No deployment rationale available.';
	}

	function screenerNote(stock: Stock): string {
		return stock.screener?.note ?? 'No screener note available.';
	}

	function revisionsSummary(stock: Stock): string {
		const up30d = stock.screener?.realityChecks?.revisions?.up30d ?? 0;
		const down30d = stock.screener?.realityChecks?.revisions?.down30d ?? 0;
		return `✓ ${up30d}↑ ${down30d}↓ revisions`;
	}

	function scenarioValue(stock: Stock, scenario: ScenarioKey): string | null {
		return stock.cagrModel?.scenarios?.[scenario] ?? null;
	}

	function volToneClass(signal: WorldVolSignal): string {
		return signal.available ? signal.tone : 'unavailable';
	}

	function componentWeight(weight: number | null | undefined): string | null {
		return weight == null ? null : `${Math.round(weight * 100)}%`;
	}

	function watchSignalClass(stock: Stock): string {
		return stock.deployment?.status ? stock.deployment.status.toLowerCase() : 'no_data';
	}
</script>

<svelte:head>
	<title>Portfolio Dashboard</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page">
	<header>
		<h1>Portfolio Dashboard</h1>
		<p class="meta">Updated {data.lastUpdated} · {data.counts.total} stocks tracked</p>
	</header>

	<section class="section">
		<div class="section-label">Global Developed Volatility</div>
		<div class="mini-guide">
			Why this is here: a broad-market stress proxy helps decide whether 2x developed-markets
			exposure is attractive, neutral, or too risky.
		</div>
		<div class="vol-card {volToneClass(data.worldVolSignal)}">
			{#if data.worldVolSignal.available}
				<div class="vol-main">
					<div class="vol-value">{data.worldVolSignal.impliedVol}%</div>
					<div class="vol-meta">
						<div class="vol-action">{data.worldVolSignal.action}</div>
						<div class="vol-detail">
							Band {data.worldVolSignal.band}
							{#if data.worldVolSignal.expiry}
								· Expiry {data.worldVolSignal.expiry} ({data.worldVolSignal.daysToExpiry}d)
							{/if}
							· Source {data.worldVolSignal.source}
						</div>
					</div>
				</div>
				{#if data.worldVolSignal.components?.length}
					<div class="vol-components">
						{#each data.worldVolSignal.components as component (component.symbol)}
							<span class="vol-chip">
								{component.label}
								{#if componentWeight(component.weight)}
									{componentWeight(component.weight)}
								{/if}
								{#if component.value != null}
									· {component.value}
								{/if}
								{#if component.fresh === false}
									· stale
								{/if}
							</span>
						{/each}
					</div>
				{/if}
				<div class="vol-note">{data.worldVolSignal.note}</div>
			{:else}
				<div class="vol-main">
					<div class="vol-value">N/A</div>
					<div class="vol-meta">
						<div class="vol-action">Signal unavailable</div>
						<div class="vol-detail">
							Source {data.worldVolSignal.source} · {data.worldVolSignal.reason}
						</div>
					</div>
				</div>
				<div class="vol-note">
					This card prefers a VIX/VSTOXX blend and falls back gracefully when one of the feeds is
					unavailable.
				</div>
			{/if}
		</div>
	</section>

	<!-- Core Allocation -->
	<section class="section">
		<div class="section-label">Core Allocation</div>
		<div class="mini-guide">
			Why this is here: ETFs are the default portfolio. Stocks only earn capital when the evidence
			is unusually strong.
		</div>
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
		<p class="alloc-note">
			Default position is to stay in ETFs. Move capital into individual stocks only when valuation,
			forward return, and stabilization all agree.
		</p>
	</section>

	<!-- Deploy Now -->
	<section class="section">
		<div class="section-label">
			Deploy Now
			{#if data.deployNow.length > 0}
				<span class="count-badge green">{data.deployNow.length}</span>
			{/if}
		</div>
		<div class="mini-guide">
			Why this is here: these names are cheap enough, strong enough, and either stabilized already
			or sitting on a likely value floor.
		</div>
		<p class="section-note">
			Must beat the ETF alternative with base CAGR at least {data.hurdles.etfCagr}% and bear CAGR
			above {data.hurdles.bearFloor}%. Near 3-month-low names can still qualify when the downside
			floor looks unusually strong.
		</p>

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
							<span>{screenerLabel(stock)}</span>
							<span>Base {stock.cagrModel?.scenarios?.base}</span>
							{#if stock.upside != null}
								<span style="color:{upsideColor(stock.upside)}"
									>Upside {stock.upside > 0 ? '+' : ''}{stock.upside}%</span
								>
							{/if}
						</div>
						<div class="top-pick-note">
							Strong mix of valuation, expected return, and resilience right now.
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if data.deployNow.length === 0}
			<div class="empty-state">
				<p class="empty-title">No deployable stock signals</p>
				<p class="empty-sub">
					Nothing currently clears all three gates. Stay the course with ETFs.
				</p>
			</div>
		{:else}
			<div class="signal-list">
				{#each data.deployNow as stock (stock.ticker)}
					<button
						class="signal-card"
						class:expanded={expandedDeploy === stock.ticker}
						onclick={() => {
							toggleDeploy(stock.ticker);
						}}
					>
						<div class="signal-row1">
							<span class="ticker">{stock.ticker}</span>
							<span class="name">{stock.name}</span>
							<span class="group-tag">{stock.group}</span>
						</div>

						<div class="signal-row2">
							<span
								class="score"
								style="color:{usesGrowthScore(stock)
									? scoreColor(stock.screener?.score)
									: '#22c55e'}"
							>
								{scoreLabel(stock)}
							</span>
							<span class="detail">{detailLabel(stock)}</span>
						</div>

						{#if stock.screener?.realityChecks}
							<div class="signal-row3">
								{#if stock.screener.realityChecks.stabilization}
									<span class="rc pass"
										>✓ {stabilizationReturn(stock.screener.realityChecks.stabilization.return6m)} 6m</span
									>
									<span class="rc pass"
										>✓ {stabilizationReturn(stock.screener.realityChecks.stabilization.return1m)} 1m</span
									>
								{/if}
								{#if stock.screener.realityChecks.revisions}
									<span class="rc pass">{revisionsSummary(stock)}</span>
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
							<span class="cagr"
								>Rank {stock.deploymentRank} · Bear/Base/Bull {stock.cagrModel?.scenarios?.bear} / {stock
									.cagrModel?.scenarios?.base} / {stock.cagrModel?.scenarios?.bull}</span
							>
						</div>

						{#if expandedDeploy === stock.ticker}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="expanded"
								onclick={(e) => {
									e.stopPropagation();
								}}
							>
								<div class="summary-line success">{deploymentReason(stock)}</div>
								{#if stock.cagrModel?.scenarios}
									<div class="scenarios-panel">
										<div class="scenarios-label">
											CAGR Scenarios ({stock.cagrModel.horizon ?? 5}yr)
										</div>
										<div class="scenarios-row">
											{#each scenarioKeys as scenario (scenario)}
												{#if scenarioValue(stock, scenario)}
													<div class="scenario" class:base={scenario === 'base'}>
														<span class="scenario-label">{scenario}</span>
														<span class="scenario-value">{scenarioValue(stock, scenario)}</span>
													</div>
												{/if}
											{/each}
										</div>
										<div class="scenario-params">
											{#if stock.cagrModel.epsGrowth}EPS growth {stock.cagrModel.epsGrowth}{/if}
											{#if stock.cagrModel.exitPE?.base}
												· Exit PE {stock.cagrModel.exitPE.bear}/{stock.cagrModel.exitPE.base}/{stock
													.cagrModel.exitPE.bull}{/if}
											{#if stock.cagrModel.dividendYield && stock.cagrModel.dividendYield !== '0%'}
												· DY {stock.cagrModel.dividendYield}{/if}
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
		<div class="mini-guide">
			Why this is here: these may become opportunities, but the price action still suggests
			patience.
		</div>
		<p class="section-note">
			These stocks look cheap enough, but the drawdown still looks active. They are candidates for
			monitoring, not deployment.
		</p>

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
						onclick={() => {
							toggleWait(stock.ticker);
						}}
					>
						<div class="signal-row1">
							<span class="ticker">{stock.ticker}</span>
							<span class="name">{stock.name}</span>
							<span class="group-tag">{stock.group}</span>
						</div>

						<div class="signal-row2">
							<span class="score" style="color:{scoreColor(stock.screener?.score)}"
								>{scoreLabel(stock)}</span
							>
							<span class="detail">{deploymentReason(stock)}</span>
						</div>

						{#if stock.screener?.realityChecks?.stabilization}
							<div class="signal-row3">
								<span class="rc wait"
									>{stabilizationReturn(stock.screener.realityChecks.stabilization.return6m)} 6m</span
								>
								<span class="rc wait"
									>{stabilizationReturn(stock.screener.realityChecks.stabilization.return1m)} 1m</span
								>
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
									<span class="mono" style="color:{upsideColor(stock.upside)}"
										>({stock.upside > 0 ? '+' : ''}{stock.upside}%)</span
									>
								{/if}
							{/if}
							<span class="spacer"></span>
							<span class="cagr"
								>Bear/Base/Bull {stock.cagrModel?.scenarios?.bear} / {stock.cagrModel?.scenarios
									?.base} / {stock.cagrModel?.scenarios?.bull}</span
							>
						</div>

						{#if expandedWait === stock.ticker}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="expanded"
								onclick={(e) => {
									e.stopPropagation();
								}}
							>
								<div class="summary-line warn">{screenerNote(stock)}</div>
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
		<button
			class="watchlist-header"
			onclick={() => {
				showWatchlist = !showWatchlist;
			}}
		>
			<span class="section-label" style="margin:0">Watchlist</span>
			<span class="watchlist-counts">
				{data.counts.reject} rejected · {data.counts.fail} insufficient edge/return · {data.counts
					.noData} no data
			</span>
			<span class="chevron" class:open={showWatchlist}>›</span>
		</button>
		<div class="mini-guide" style="margin-top:0.5rem">
			Why this is here: these names currently fail on value, return, trend, revisions, or data
			quality.
		</div>

		{#if showWatchlist}
			<div class="watchlist">
				{#each data.watchlist as stock (stock.ticker)}
					<button
						class="watch-row"
						onclick={() => {
							toggleWatch(stock.ticker);
						}}
					>
						<div class="watch-main">
							<span class="watch-ticker">{stock.ticker}</span>
							<span class="watch-name">{stock.name}</span>
							<span class="watch-signal {watchSignalClass(stock)}">
								{stock.deployment?.status ?? 'N/A'}
							</span>
							{#if stock.screener?.engine !== 'N/A' && stock.screener?.score != null}
								<span class="watch-score">{screenerLabel(stock)} · {stock.screener.score}</span>
							{/if}
							{#if stock.screener?.realityChecks?.stabilization}
								<span
									class="watch-mom"
									class:neg={(stock.screener.realityChecks.stabilization.return6m ?? 0) < 0}
									>{stabilizationReturn(stock.screener.realityChecks.stabilization.return6m)}</span
								>
							{/if}
						</div>
						{#if expandedWatch[stock.ticker]}
							<div class="watch-detail">
								<span>{stock.deployment?.reason}</span>
								<span
									>CAGR {stock.expectedCAGR} · {stock.currentPrice}{#if stock.upside != null}
										→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%){/if}</span
								>
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
		font-family:
			'DM Sans',
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
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

	.vol-card {
		padding: 0.9rem 1rem;
		border-radius: 8px;
		background: #111113;
		border: 1px solid #1e1e22;
	}

	.vol-card.buy {
		border-color: rgba(34, 197, 94, 0.22);
	}

	.vol-card.hold {
		border-color: rgba(245, 158, 11, 0.22);
	}

	.vol-card.sell {
		border-color: rgba(239, 68, 68, 0.22);
	}

	.vol-card.unavailable {
		border-color: rgba(113, 113, 122, 0.16);
	}

	.vol-main {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.vol-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.6rem;
		font-weight: 700;
		color: #f4f4f5;
		min-width: 5.5rem;
	}

	.vol-meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.vol-action {
		font-size: 0.9rem;
		font-weight: 600;
		color: #e4e4e7;
	}

	.vol-detail {
		font-size: 0.72rem;
		color: #71717a;
		line-height: 1.45;
	}

	.vol-note {
		margin-top: 0.5rem;
		font-size: 0.72rem;
		color: #52525b;
		line-height: 1.45;
	}

	.vol-components {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.55rem;
	}

	.vol-chip {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.64rem;
		color: #a1a1aa;
		padding: 2px 8px;
		border-radius: 999px;
		background: #0a0a0e;
		border: 1px solid #1e1e22;
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

	.alloc-box.scv {
		border-left: 3px solid rgba(59, 130, 246, 0.5);
	}
	.alloc-box.mom {
		border-left: 3px solid rgba(139, 92, 246, 0.5);
	}
	.alloc-box.em {
		border-left: 3px solid rgba(20, 184, 166, 0.5);
	}

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

	.signal-card:hover {
		border-color: #27272a;
	}
	.signal-card.expanded {
		border-color: rgba(34, 197, 94, 0.2);
	}
	.signal-card.wait.expanded {
		border-color: rgba(245, 158, 11, 0.2);
	}

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

	.arrow {
		color: #3f3f46;
		font-size: 0.75rem;
	}
	.spacer {
		flex: 1;
	}

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

	.scenario.base {
		border-color: #27272a;
	}

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
		background: rgba(34, 197, 94, 0.04);
		color: #86efac;
		border: 1px solid rgba(34, 197, 94, 0.08);
	}

	.case.bull .case-label {
		color: #4ade80;
	}

	.case.bear {
		background: rgba(239, 68, 68, 0.04);
		color: #fca5a5;
		border: 1px solid rgba(239, 68, 68, 0.08);
	}

	.case.bear .case-label {
		color: #f87171;
	}

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

	.watchlist-header:hover {
		border-color: #27272a;
	}

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

	.chevron.open {
		transform: rotate(90deg);
	}

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

	.watch-row:last-child {
		border-bottom: none;
	}
	.watch-row:hover {
		background: #111113;
	}

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

	.watch-mom.neg {
		color: #f87171;
	}

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
		.page {
			padding: 1rem;
		}
		.alloc-grid {
			flex-direction: column;
		}
		.top-picks {
			grid-template-columns: 1fr;
		}
		.vol-main {
			flex-direction: column;
			align-items: flex-start;
		}
		.vol-value {
			min-width: 0;
		}
		.signal-row4 {
			flex-wrap: wrap;
		}
		.watch-name {
			display: none;
		}
	}
</style>
