<script lang="ts">
	import type { DashboardHurdles, FindingStock } from '$lib/types/dashboard';
	import { scoreLabel, screenerLabel, upsideColor } from './helpers';
	import SignalCard from './signal-card.svelte';

	let {
		deployNow,
		topPicks,
		hurdles,
		expandedTicker,
		onToggle
	}: {
		deployNow: FindingStock[];
		topPicks: FindingStock[];
		hurdles: DashboardHurdles;
		expandedTicker: string | null;
		onToggle: (ticker: string) => void;
	} = $props();
</script>

<section class="section">
	<div class="section-label">
		Deploy Now
		{#if deployNow.length > 0}
			<span class="count-badge green">{deployNow.length}</span>
		{/if}
	</div>
	<div class="mini-guide">
		Why this is here: these names are cheap enough, strong enough, and either stabilized already or
		sitting on a likely value floor.
	</div>
	<p class="section-note">
		Must beat the ETF alternative with base CAGR at least {hurdles.etfCagr}% and bear CAGR above
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
						<span>Base {stock.cagrModel?.scenarios?.base}</span>
						{#if stock.upside != null}
							<span style="color:{upsideColor(stock.upside)}">
								Upside {stock.upside > 0 ? '+' : ''}{stock.upside}%
							</span>
						{/if}
					</div>
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
