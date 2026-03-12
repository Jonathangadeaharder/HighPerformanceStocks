<script lang="ts">
	import type { DashboardCounts, FindingStock } from '$lib/types/dashboard';
	import { screenerLabel, stabilizationReturn, watchSignalClass } from './helpers';

	let {
		watchlist,
		counts,
		showWatchlist,
		expandedWatch,
		onToggleWatchlist,
		onToggleWatch
	}: {
		watchlist: FindingStock[];
		counts: DashboardCounts;
		showWatchlist: boolean;
		expandedWatch: Record<string, boolean>;
		onToggleWatchlist: () => void;
		onToggleWatch: (ticker: string) => void;
	} = $props();
</script>

<section class="section">
	<button class="watchlist-header" onclick={onToggleWatchlist}>
		<span class="section-label" style="margin:0">Watchlist</span>
		<span class="watchlist-counts">
			{counts.reject} rejected · {counts.fail} insufficient edge/return · {counts.noData} no data
		</span>
		<span class="chevron" class:open={showWatchlist}>›</span>
	</button>
	<div class="mini-guide" style="margin-top:0.5rem">
		Why this is here: these names currently fail on value, return, trend, revisions, or data
		quality.
	</div>

	{#if showWatchlist}
		<div class="watchlist">
			{#each watchlist as stock (stock.ticker)}
				<button
					class="watch-row"
					onclick={() => {
						onToggleWatch(stock.ticker);
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
							>
								{stabilizationReturn(stock.screener.realityChecks.stabilization.return6m)}
							</span>
						{/if}
					</div>
					{#if expandedWatch[stock.ticker]}
						<div class="watch-detail">
							<span>{stock.deployment?.reason}</span>
							<span>
								CAGR {stock.expectedCAGR} · {stock.currentPrice}
								{#if stock.upside != null}
									→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%)
								{/if}
							</span>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</section>
