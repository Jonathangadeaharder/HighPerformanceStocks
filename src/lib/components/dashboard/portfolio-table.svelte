<script lang="ts">
	import type { FindingStock } from '$lib/types/dashboard';

	let {
		stocks,
		weights,
		includedTickers,
		onToggle
	}: {
		stocks: FindingStock[];
		weights: Map<string, number>;
		includedTickers: Set<string>;
		onToggle: (ticker: string) => void;
	} = $props();

	function fmt(v: number | null | undefined, suffix = '%'): string {
		if (v == null) return '—';
		return `${v}${suffix}`;
	}
</script>

<div class="portfolio-table-wrap">
	<table class="portfolio-table">
		<thead>
			<tr>
				<th></th>
				<th>Ticker</th>
				<th>Group</th>
				<th>Rank</th>
				<th>Base</th>
				<th>Bear</th>
				<th>Bull</th>
				<th>Vol</th>
				<th>Score</th>
				<th>ROE</th>
				<th>FCF</th>
				<th>R40</th>
				<th>6m Ret</th>
				<th>Weight</th>
			</tr>
		</thead>
		<tbody>
			{#each stocks as stock (stock.ticker)}
				{@const included = includedTickers.has(stock.ticker)}
				{@const weight = weights.get(stock.ticker)}
				<tr class:excluded={!included}>
					<td class="check-cell">
						<input
							type="checkbox"
							checked={included}
							onchange={() => { onToggle(stock.ticker); }}
							aria-label="Include {stock.ticker}"
						/>
					</td>
					<td class="ticker-cell">{stock.ticker}</td>
					<td class="group-cell">{stock.group ?? '—'}</td>
					<td class="mono">{stock.deploymentRank ?? '—'}</td>
					<td class="mono" style="color:#4ade80">{fmt(stock.baseCagr)}</td>
					<td class="mono" style="color:#facc15">{fmt(stock.bearCagr)}</td>
					<td class="mono" style="color:#60a5fa">{fmt(stock.bullCagr)}</td>
					<td class="mono">{stock.expectedVolatility ?? '—'}</td>
					<td class="mono">{stock.screener?.score ?? '—'}</td>
					<td class="mono">{stock.metrics?.roe ?? '—'}</td>
					<td class="mono">{stock.metrics?.fcfYield ?? '—'}</td>
					<td class="mono">{stock.metrics?.ruleOf40 ?? '—'}</td>
					<td class="mono">
						{#if stock.screener?.realityChecks?.stabilization?.return6m == null}
							—
						{:else}
							{@const r = stock.screener.realityChecks.stabilization.return6m}
							<span style="color:{r >= 0 ? '#4ade80' : r >= -10 ? '#facc15' : '#f87171'}">
								{r > 0 ? '+' : ''}{r}%
							</span>
						{/if}
					</td>
					<td class="mono">{weight == null ? '—' : weight.toFixed(1) + '%'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.portfolio-table-wrap {
		width: 100%;
		overflow-x: auto;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}
	.portfolio-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		white-space: nowrap;
	}
	th {
		background: var(--bg-body);
		padding: 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--border-subtle);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	td {
		padding: 0.875rem 1rem;
		font-size: 0.875rem;
		color: var(--text-primary);
		border-bottom: 1px solid var(--border-subtle);
	}
	tr:last-child td {
		border-bottom: none;
	}
	tr:hover td {
		background: var(--bg-surface-hover);
	}
	tr.excluded td {
		opacity: 0.4;
	}
	.ticker-cell {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--text-primary);
	}
	.group-cell {
		color: var(--text-secondary);
	}
	.mono {
		font-family: var(--font-mono);
	}
	.check-cell {
		width: 40px;
		text-align: center;
	}
	input[type="checkbox"] {
		accent-color: var(--color-success);
		cursor: pointer;
		width: 1rem;
		height: 1rem;
	}
</style>
