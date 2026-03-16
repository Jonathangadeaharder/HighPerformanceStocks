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
