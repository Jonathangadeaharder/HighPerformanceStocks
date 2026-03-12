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
