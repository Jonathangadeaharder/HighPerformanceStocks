<script lang="ts">
	import type { DashboardCounts, FindingStock } from '$lib/types/dashboard';
	import { detailLabel, stabilizationReturn, watchSignalClass } from './helpers';
	import { SvelteMap } from 'svelte/reactivity';

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

	let groupBySector = $state(false);

	function groupByGroup(stocks: FindingStock[]): SvelteMap<string, FindingStock[]> {
		const groups = new SvelteMap<string, FindingStock[]>();
		for (const stock of stocks) {
			const group = stock.group ?? 'Uncategorized';
			const existing = groups.get(group) ?? [];
			existing.push(stock);
			groups.set(group, existing);
		}
		return groups;
	}
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
		<div style="display:flex; gap:0.5rem; margin:0.5rem 0;">
			<button
				class="view-toggle"
				class:active={!groupBySector}
				onclick={() => { groupBySector = false; }}
			>
				By Status
			</button>
			<button
				class="view-toggle"
				class:active={groupBySector}
				onclick={() => { groupBySector = true; }}
			>
				By Sector
			</button>
		</div>

		{#if !groupBySector}
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
						{#if stock.screener?.engine !== 'N/A'}
							<span class="watch-score">
								{stock.screener?.score == null ? '' : `${stock.screener.score} · `}{detailLabel(
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
		{:else}
			<div class="watchlist-grouped">
				{#each [...groupByGroup(watchlist).entries()] as [group, stocks] (group)}
					<div class="sector-group">
						<div class="sector-header">
							<span class="sector-name">{group}</span>
							<span class="sector-count">{stocks.length}</span>
						</div>
						<div class="sector-stocks">
							{#each stocks as stock (stock.ticker)}
								<button
									class="watch-row compact"
									onclick={() => {
										onToggleWatch(stock.ticker);
									}}
								>
									<div class="watch-main">
										<span class="watch-ticker">{stock.ticker}</span>
										<span class="watch-signal {watchSignalClass(stock)}">
											{stock.deployment?.status ?? 'N/A'}
										</span>
										{#if stock.screener?.score != null}
											<span class="watch-score">{stock.screener.score}</span>
										{/if}
										{#if stock.baseCagr != null}
											<span class="watch-cagr-mini">{stock.baseCagr}%</span>
										{/if}
									</div>
									{#if expandedWatch[stock.ticker]}
										<div class="watch-detail">
											<div class="watch-reason">{stock.deployment?.reason}</div>
											<div class="watch-cagr">
												CAGR {stock.expectedCAGR} · {stock.currentPrice}
												{#if stock.upside != null}
													→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%)
												{/if}
											</div>
											{#if stock.bullCase}
												<div class="case bull" style="border-left: 2px solid #4ade80; padding-left: 0.5rem; margin-top:0.5rem;">
													<div class="case-label" style="font-weight:600; font-size:0.75rem; color:#4ade80; text-transform:uppercase;">Bull</div>
													<p style="margin:0; font-size:0.875rem; color:#d4d4d8;">{stock.bullCase}</p>
												</div>
											{/if}
											{#if stock.bearCase}
												<div class="case bear" style="border-left: 2px solid #f87171; padding-left: 0.5rem; margin-top:0.5rem;">
													<div class="case-label" style="font-weight:600; font-size:0.75rem; color:#f87171; text-transform:uppercase;">Bear</div>
													<p style="margin:0; font-size:0.875rem; color:#d4d4d8;">{stock.bearCase}</p>
												</div>
											{/if}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.section {
		margin-bottom: 2rem;
		background: #18191c;
		border: 1px solid #27272a;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.section-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
		display: block;
	}

	.watchlist-header {
		display: flex;
		align-items: center;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.watchlist-header:hover .section-label {
		color: #e4e4e7;
	}

	.watchlist-counts {
		margin-left: 0.75rem;
		font-size: 0.875rem;
		color: #71717a;
		flex-grow: 1;
	}

	.chevron {
		color: #71717a;
		font-size: 1.25rem;
		line-height: 1;
		transition: transform 0.2s;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.mini-guide {
		font-size: 0.875rem;
		color: #71717a;
		margin-bottom: 1rem;
	}

	.view-toggle {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #a1a1aa;
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}
	.view-toggle:hover {
		background: #3f3f46;
		color: #e4e4e7;
	}
	.view-toggle.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
	}

	.watchlist, .watchlist-grouped {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sector-group {
		margin-bottom: 1rem;
		border: 1px solid #27272a;
		border-radius: 0.25rem;
		overflow: hidden;
	}

	.sector-header {
		background: #27272a;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #e4e4e7;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.sector-count {
		color: #71717a;
		font-size: 0.75rem;
	}
	.sector-stocks {
		background: #18191c;
		display: flex;
		flex-direction: column;
	}

	.watch-row {
		display: flex;
		flex-direction: column;
		padding: 0.75rem;
		background: #27272a;
		border: 1px solid #3f3f46;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		color: inherit;
	}
	.watch-row.compact {
		border: none;
		border-bottom: 1px solid #27272a;
		border-radius: 0;
	}
	.watch-row.compact:last-child {
		border-bottom: none;
	}
	.watch-row:hover {
		border-color: #52525b;
		background: #27272a; /* keep same bg, just border lightens */
	}

	.watch-main {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.watch-ticker {
		font-family:
			ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			Consolas,
			monospace;
		font-weight: 600;
		color: #e4e4e7;
		min-width: 4.5rem;
	}

	.watch-name {
		color: #a1a1aa;
		font-size: 0.875rem;
		flex-grow: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.watch-signal {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.watch-signal.pass {
		background: rgba(74, 222, 128, 0.1);
		color: #4ade80;
	}
	.watch-signal.fail {
		background: rgba(248, 113, 113, 0.1);
		color: #f87171;
	}
	.watch-signal.hold {
		background: rgba(250, 204, 21, 0.1);
		color: #facc15;
	}
	.watch-signal.none {
		background: rgba(161, 161, 170, 0.1);
		color: #a1a1aa;
	}

	.watch-score {
		font-family:
			ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			Consolas,
			monospace;
		font-size: 0.875rem;
		color: #e4e4e7;
	}

	.watch-mom {
		font-family:
			ui-monospace,
			SFMono-Regular,
			monospace;
		font-size: 0.875rem;
		color: #4ade80;
	}
	.watch-mom.neg {
		color: #f87171;
	}

	.watch-cagr-mini {
		font-family:
			ui-monospace,
			SFMono-Regular,
			monospace;
		font-size: 0.875rem;
		color: #a1a1aa;
	}

	.watch-detail {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #3f3f46;
	}

	.watch-reason {
		font-size: 0.875rem;
		color: #d4d4d8;
		margin-bottom: 0.25rem;
	}

	.watch-cagr {
		font-size: 0.875rem;
		color: #a1a1aa;
		font-family:
			ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			monospace;
	}
</style>
