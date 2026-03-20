<script lang="ts">
	import type { DashboardHurdles, FindingStock } from '$lib/types/dashboard';
	import { scoreLabel, screenerLabel, upsideColor } from './helpers';
	import SignalCard from './signal-card.svelte';
	import DownloadReportButton from './download-report-button.svelte';

	let {
		deployNow,
		cheapWait,
		watchlist,
		topPicks,
		hurdles,
		expandedTicker,
		onToggle
	}: {
		deployNow: FindingStock[];
		cheapWait: FindingStock[];
		watchlist: FindingStock[];
		topPicks: FindingStock[];
		hurdles: DashboardHurdles;
		expandedTicker: string | null;
		onToggle: (ticker: string) => void;
	} = $props();
</script>

<section class="section">
	<div class="section-header-row">
		<div class="section-label">
			Deploy Now
			{#if deployNow.length > 0}
				<span class="count-badge green">{deployNow.length}</span>
			{/if}
		</div>
		{#if deployNow.length > 0}
			<DownloadReportButton {deployNow} {cheapWait} {watchlist} {hurdles} />
		{/if}
	</div>
	<div class="mini-guide">
		Why this is here: these names are cheap enough, strong enough, and either stabilized already or
		sitting on a likely value floor.
	</div>
	<p class="section-note">
		Must beat the ETF alternative with base 1Y return at least {hurdles.etfCagr}% and bear return above
		{hurdles.bearFloor}%. Near 3-month-low names can still qualify when the downside floor looks
		unusually strong.
	</p>

	{#if topPicks.length > 0}
		<div class="top-picks">
			{#each topPicks as stock (stock.ticker)}
				<div class="top-pick">
					<div class="top-pick-label">{stock.pickLabel}</div>
					<div class="top-pick-header">
						<span class="ticker">{stock.ticker}</span>
						<span class="name">{stock.name}</span>
					</div>
					<div class="top-pick-metrics">
						<span>{scoreLabel(stock)}</span>
						<span>{screenerLabel(stock)}</span>
						<span>1Y Base {stock.cagrModel?.scenarios?.base}</span>
						{#if stock.upside != null}
							<span style="color:{upsideColor(stock.upside)}">
								Upside {stock.upside > 0 ? '+' : ''}{stock.upside}%
							</span>
						{/if}
					</div>
					{#if stock.description}
						<div class="top-pick-brief">
							{stock.description}
						</div>
					{/if}
					<div class="top-pick-note">
						Strong mix of valuation, expected return, and resilience right now.
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if deployNow.length === 0}
		<div class="empty-state">
			<p class="empty-title">No deployable stock signals</p>
			<p class="empty-sub">Nothing currently clears all three gates. Stay the course with ETFs.</p>
		</div>
	{:else}
		<div class="signal-list">
			{#each deployNow as stock (stock.ticker)}
				<SignalCard
					{stock}
					kind="deploy"
					expanded={expandedTicker === stock.ticker}
					onToggle={() => {
						onToggle(stock.ticker);
					}}
				/>
			{/each}
		</div>
	{/if}
</section>

<style>
	.section {
		margin-bottom: 2rem;
	}
	.section-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.section-label {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.count-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
		font-weight: 600;
	}
	.count-badge.green {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.mini-guide {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}
	.section-note {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
	
	.top-picks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.top-pick {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		padding: 1.25rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		position: relative;
		overflow: hidden;
	}
	.top-pick::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: var(--color-success);
	}
	.top-pick-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
		color: var(--color-success);
		margin-bottom: 0.5rem;
	}
	.top-pick-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.ticker {
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.name {
		font-size: 0.875rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.top-pick-metrics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.875rem;
		font-family: var(--font-mono);
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}
	.top-pick-brief {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 0.75rem;
		font-style: italic;
	}
	.top-pick-note {
		font-size: 0.875rem;
		color: var(--text-muted);
		line-height: 1.4;
	}
	
	.signal-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}
	
	.empty-state {
		background: var(--bg-surface);
		border: 1px dashed var(--border-hover);
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
	}
	.empty-title {
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}
	.empty-sub {
		font-size: 0.875rem;
		color: var(--text-muted);
	}
</style>
