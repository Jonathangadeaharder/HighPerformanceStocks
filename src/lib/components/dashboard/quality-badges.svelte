<script lang="ts">
	import type { StockMetrics } from '$lib/types/dashboard';
	import { qualityColor } from './helpers';

	let { metrics }: { metrics?: StockMetrics } = $props();
</script>

{#if metrics}
	<div class="quality-badges">
		{#if metrics.roe}
			<span class="quality-badge" style="color:{qualityColor('roe', metrics.roe)}">
				ROE {metrics.roe}
			</span>
		{/if}
		{#if metrics.fcfYield}
			<span class="quality-badge" style="color:{qualityColor('fcfYield', metrics.fcfYield)}">
				FCF {metrics.fcfYield}
			</span>
		{/if}
		{#if metrics.ruleOf40}
			<span class="quality-badge" style="color:{qualityColor('ruleOf40', metrics.ruleOf40)}">
				R40 {metrics.ruleOf40}
			</span>
		{/if}
		{#if metrics.netDebtEbitda}
			<span
				class="quality-badge"
				style="color:{qualityColor('netDebtEbitda', metrics.netDebtEbitda)}"
			>
				ND/EBITDA {metrics.netDebtEbitda}
			</span>
		{/if}
	</div>
{/if}

<style>
	.quality-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.quality-badge {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--bg-surface-hover);
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
	}
</style>
