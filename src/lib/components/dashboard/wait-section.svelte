<script lang="ts">
	import type { FindingStock } from '$lib/types/dashboard';
	import SignalCard from './signal-card.svelte';

	let {
		cheapWait,
		expandedTicker,
		onToggle
	}: {
		cheapWait: FindingStock[];
		expandedTicker: string | null;
		onToggle: (ticker: string) => void;
	} = $props();
</script>

<section class="section">
	<div class="section-label">
		Cheap, But Wait
		{#if cheapWait.length > 0}
			<span class="count-badge amber">{cheapWait.length}</span>
		{/if}
	</div>
	<div class="mini-guide">
		Why this is here: these may become opportunities, but the price action still suggests patience.
	</div>
	<p class="section-note">
		These stocks look cheap enough, but the drawdown still looks active. They are candidates for
		monitoring, not deployment.
	</p>

	{#if cheapWait.length === 0}
		<div class="empty-state compact">
			<p class="empty-sub">No stabilization candidates right now.</p>
		</div>
	{:else}
		<div class="signal-list">
			{#each cheapWait as stock (stock.ticker)}
				<SignalCard
					{stock}
					kind="wait"
					expanded={expandedTicker === stock.ticker}
					onToggle={() => {
						onToggle(stock.ticker);
					}}
				/>
			{/each}
		</div>
	{/if}
</section>

<style>
	.section {
		margin-bottom: 2rem;
	}
	.section-label {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.count-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
		font-weight: 600;
	}
	.count-badge.amber {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}
	.mini-guide {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}
	.section-note {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
	.signal-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}
	.empty-state {
		background: var(--bg-surface);
		border: 1px dashed var(--border-hover);
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
	}
	.empty-state.compact {
		padding: 1rem;
	}
	.empty-sub {
		font-size: 0.875rem;
		color: var(--text-muted);
	}
</style>
