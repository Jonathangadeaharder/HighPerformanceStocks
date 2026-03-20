<script lang="ts">
	import type { PortfolioSummary } from '$lib/domain/portfolio';

	let {
		summary,
		onToggleMode
	}: {
		summary: PortfolioSummary;
		onToggleMode: () => void;
	} = $props();
</script>

<div class="portfolio-summary-card">
	<div class="ps-row">
		<div class="ps-stat">
			<span class="ps-label">Positions</span>
			<span class="ps-value">{summary.selectedCount} / {summary.totalDeployCount}</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Sectors</span>
			<span class="ps-value">{summary.uniqueSectors}</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Avg Base 1Y</span>
			<span class="ps-value mono" style="color:#4ade80">{summary.weightedAvgBaseCagr}%</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Avg Bear 1Y</span>
			<span class="ps-value mono" style="color:#facc15">{summary.weightedAvgBearCagr}%</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Avg Bull 1Y</span>
			<span class="ps-value mono" style="color:#60a5fa">{summary.weightedAvgBullCagr}%</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Max Position</span>
			<span class="ps-value mono">{summary.maxSingleWeight}%</span>
		</div>
		<button class="mode-toggle" onclick={onToggleMode}>
			{summary.weightingMode === 'equal' ? 'Equal Weight' : 'Rank-Weighted'}
		</button>
	</div>
</div>

<style>
	.portfolio-summary-card {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}
	.ps-row {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		align-items: center;
	}
	.ps-stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.ps-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.ps-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.mono {
		font-family: var(--font-mono);
	}
	.mode-toggle {
		margin-left: auto;
		background: var(--bg-body);
		border: 1px solid var(--border-hover);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		transition: all 0.2s;
	}
	.mode-toggle:hover {
		color: var(--text-primary);
		border-color: var(--text-muted);
	}
</style>
