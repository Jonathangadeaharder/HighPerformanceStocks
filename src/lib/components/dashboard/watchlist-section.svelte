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
		onToggleWatchlist?: () => void;
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
		<span class="section-label">Watchlist</span>
		<span class="watchlist-counts">
			{counts.reject} rejected · {counts.overpriced} overpriced · {counts.fail} insufficient edge/return
			· {counts.noData} no data
		</span>
		<div class="chevron-box">
			<span class="chevron" class:open={showWatchlist}>›</span>
		</div>
	</button>
	<div class="mini-guide">
		Why this is here: these names currently fail on value, return, trend, revisions, or data
		quality.
	</div>

	{#if showWatchlist}
		<div class="toggle-row">
			<button
				class="view-toggle"
				class:active={!groupBySector}
				onclick={() => {
					groupBySector = false;
				}}
			>
				By Status
			</button>
			<button
				class="view-toggle"
				class:active={groupBySector}
				onclick={() => {
					groupBySector = true;
				}}
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
						{#if stock.description}
							<div class="watch-brief">
								{stock.description}
							</div>
						{/if}
						{#if expandedWatch[stock.ticker]}
							<div class="watch-detail">
								<div class="watch-reason">
									{stock.deployment?.reason}
								</div>
								<div class="watch-cagr">
									1Y Return {stock.expectedCAGR} · {stock.currentPrice}
									{#if stock.upside != null}
										→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%)
									{/if}
								</div>

								<div class="watch-cases">
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
									{#if stock.description}
										<div class="watch-brief">
											{stock.description}
										</div>
									{/if}
									{#if expandedWatch[stock.ticker]}
										<div class="watch-detail">
											<div class="watch-reason">{stock.deployment?.reason}</div>
											<div class="watch-cagr">
												1Y Return {stock.expectedCAGR} · {stock.currentPrice}
												{#if stock.upside != null}
													→ {stock.targetPrice} ({stock.upside > 0 ? '+' : ''}{stock.upside}%)
												{/if}
											</div>
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
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.section {
		margin-bottom: 2rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		padding: 1.5rem;
	}

	.section-label {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.watchlist-header {
		display: flex;
		align-items: center;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		gap: 1rem;
	}

	.watchlist-counts {
		font-size: 0.875rem;
		color: var(--text-muted);
		flex-grow: 1;
	}

	.chevron-box {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--bg-body);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		transition: all 0.2s;
	}
	.watchlist-header:hover .chevron-box {
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.chevron {
		font-size: 1.5rem;
		line-height: 1;
		transition: transform 0.2s ease;
		margin-top: -4px;
	}

	.chevron.open {
		transform: rotate(90deg) translate(2px, 2px);
	}

	.mini-guide {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
		margin-bottom: 1.5rem;
	}

	.toggle-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.view-toggle {
		background: var(--bg-body);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		padding: 0.375rem 0.875rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}
	.view-toggle:hover {
		border-color: var(--border-hover);
		color: var(--text-primary);
	}
	.view-toggle.active {
		background: var(--bg-surface-hover);
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.watchlist,
	.watchlist-grouped {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sector-group {
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--bg-body);
	}

	.sector-header {
		background: var(--bg-surface-hover);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--border-subtle);
	}
	.sector-count {
		color: var(--text-muted);
		font-size: 0.75rem;
		background: var(--bg-body);
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
	}
	.sector-stocks {
		display: flex;
		flex-direction: column;
	}

	.watch-row {
		display: flex;
		flex-direction: column;
		padding: 1rem;
		background: var(--bg-body);
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		color: inherit;
	}
	.watch-row.compact {
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		border-radius: 0;
	}
	.watch-row.compact:last-child {
		border-bottom: none;
	}
	.watch-row:hover {
		border-color: var(--border-hover);
		transform: translateX(4px);
	}

	.watch-main {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.watch-ticker {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--text-primary);
		min-width: 5rem;
	}

	.watch-name {
		color: var(--text-secondary);
		font-size: 0.875rem;
		flex-grow: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.watch-signal {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.watch-signal.pass {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.watch-signal.fail {
		background: var(--color-danger-bg);
		color: var(--color-danger);
	}
	.watch-signal.hold {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}
	.watch-signal.none {
		background: var(--bg-surface-hover);
		color: var(--text-muted);
	}

	.watch-score {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.watch-mom {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-success);
	}
	.watch-mom.neg {
		color: var(--color-danger);
	}

	.watch-brief {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin-top: 0.25rem;
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.watch-cagr-mini {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.watch-detail {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.watch-reason {
		font-size: 0.875rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.watch-cagr {
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.watch-cases {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.case {
		padding-left: 0.75rem;
		border-left: 2px solid;
	}
	.case.bull {
		border-color: var(--color-success);
	}
	.case.bear {
		border-color: var(--color-danger);
	}

	.case-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
		margin-bottom: 0.125rem;
	}
	.case.bull .case-label {
		color: var(--color-success);
	}
	.case.bear .case-label {
		color: var(--color-danger);
	}

	.case p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin: 0;
	}
</style>
