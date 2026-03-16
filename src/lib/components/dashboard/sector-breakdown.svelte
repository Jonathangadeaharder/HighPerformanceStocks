<script lang="ts">
	import type { ConcentrationAnalysis } from '$lib/domain/portfolio';

	let { analysis }: { analysis: ConcentrationAnalysis } = $props();
</script>

<div class="sector-breakdown">
	<div class="section-label">Sector Concentration</div>
	{#each analysis.sectors as sector (sector.group)}
		<div class="sector-row" class:concentrated={sector.isConcentrated}>
			<span class="sector-group">{sector.group}</span>
			<span class="sector-count">{sector.count}</span>
			<span class="sector-weight mono" style="color:{sector.isConcentrated ? '#f59e0b' : '#a1a1aa'}">
				{sector.weightPct}%
			</span>
			{#if sector.isConcentrated}
				<span class="sector-flag">concentrated</span>
			{/if}
		</div>
	{/each}
	{#if analysis.topTwoWarning}
		<div class="concentration-warning">
			Top 2 sectors represent {analysis.topTwoPct}% — consider diversifying across more groups.
		</div>
	{/if}
</div>

<style>
	.sector-breakdown {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}
	.section-label {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}
	.sector-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.sector-row:last-of-type {
		border-bottom: none;
	}
	.sector-group {
		flex-grow: 1;
		font-size: 0.875rem;
		color: var(--text-primary);
		font-weight: 500;
	}
	.sector-count {
		font-size: 0.875rem;
		color: var(--text-muted);
		background: var(--bg-body);
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
		border: 1px solid var(--border-subtle);
	}
	.sector-weight {
		font-size: 0.875rem;
		font-weight: 600;
		min-width: 4rem;
		text-align: right;
	}
	.sector-flag {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-warning);
		background: var(--color-warning-bg);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}
	.concentration-warning {
		margin-top: 1rem;
		padding: 0.75rem;
		background: var(--color-warning-bg);
		border-left: 3px solid var(--color-warning);
		border-radius: 0 0.375rem 0.375rem 0;
		color: var(--color-warning);
		font-size: 0.875rem;
	}
	.mono {
		font-family: var(--font-mono);
	}
</style>
