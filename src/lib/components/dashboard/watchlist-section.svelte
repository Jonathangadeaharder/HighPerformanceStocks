<script lang="ts">
	import type { DashboardCounts, FindingStock } from '$lib/types/dashboard';
	import { detailLabel, stabilizationReturn, watchSignalClass } from './helpers';

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
			{counts.reject} rejected · {counts.overpriced} overpriced · {counts.fail} insufficient edge/return · {counts.noData} no data
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
						{#if stock.screener?.engine === 'N/A'}
							<!-- No screener data to display -->
						{:else}
							<span class="watch-score">
								{stock.screener?.score != null ? `${stock.screener.score} · ` : ''}{detailLabel(
									stock
								)}
							</span>
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
							<div class="watch-reason">
								{stock.deployment?.reason}
							</div>
							<div class="watch-cagr">
								CAGR {stock.expectedCAGR} · {stock.currentPrice}
								{#if stock.upside != null}
									→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%)
								{/if}
							</div>

							<div
								class="watch-cases"
								style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.5rem; text-align:left;"
							>
								{#if stock.bullCase}
									<div
										class="case bull"
										style="border-left: 2px solid #4ade80; padding-left: 0.5rem;"
									>
										<div
											class="case-label"
											style="font-weight:600; font-size:0.75rem; color:#4ade80; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.1rem;"
										>
											Bull
										</div>
										<p style="margin:0; font-size:0.875rem; color:#d4d4d8; line-height:1.4;">
											{stock.bullCase}
										</p>
									</div>
								{/if}
								{#if stock.bearCase}
									<div
										class="case bear"
										style="border-left: 2px solid #f87171; padding-left: 0.5rem;"
									>
										<div
											class="case-label"
											style="font-weight:600; font-size:0.75rem; color:#f87171; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.1rem;"
										>
											Bear
										</div>
										<p style="margin:0; font-size:0.875rem; color:#d4d4d8; line-height:1.4;">
											{stock.bearCase}
										</p>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</section>
