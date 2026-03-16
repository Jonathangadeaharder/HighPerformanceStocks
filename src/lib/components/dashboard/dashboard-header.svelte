<script lang="ts">
	let {
		lastUpdated,
		totalStocks
	}: {
		lastUpdated: string;
		totalStocks: number;
	} = $props();
</script>

<header>
	<h1>Portfolio Dashboard</h1>
	<p class="meta">Updated {lastUpdated} · {totalStocks} stocks tracked</p>
</header>

<style>
	header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		color: var(--text-primary);
	}
	.meta {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}
</style>
