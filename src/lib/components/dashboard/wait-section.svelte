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
