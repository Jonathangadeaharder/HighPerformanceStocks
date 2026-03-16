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
			<span class="ps-label">Avg Base CAGR</span>
			<span class="ps-value mono" style="color:#4ade80">{summary.weightedAvgBaseCagr}%</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Avg Bear CAGR</span>
			<span class="ps-value mono" style="color:#facc15">{summary.weightedAvgBearCagr}%</span>
		</div>
		<div class="ps-stat">
			<span class="ps-label">Avg Bull CAGR</span>
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
