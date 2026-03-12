<script lang="ts">
	import type { PageData } from './$types';
	import '$lib/components/dashboard/dashboard.css';
	import CoreAllocation from '$lib/components/dashboard/core-allocation.svelte';
	import DashboardHeader from '$lib/components/dashboard/dashboard-header.svelte';
	import DeploySection from '$lib/components/dashboard/deploy-section.svelte';
	import WaitSection from '$lib/components/dashboard/wait-section.svelte';
	import WatchlistSection from '$lib/components/dashboard/watchlist-section.svelte';
	import WorldVolCard from '$lib/components/dashboard/world-vol-card.svelte';

	let { data }: { data: PageData } = $props();
	let expandedDeploy = $state<string | null>(null);
	let expandedWait = $state<string | null>(null);
	let showWatchlist = $state(false);
	let expandedWatch = $state<Record<string, boolean>>({});

	function toggleDeploy(ticker: string): void {
		expandedDeploy = expandedDeploy === ticker ? null : ticker;
	}

	function toggleWait(ticker: string): void {
		expandedWait = expandedWait === ticker ? null : ticker;
	}

	function toggleWatchlist(): void {
		showWatchlist = !showWatchlist;
	}

	function toggleWatch(ticker: string): void {
		expandedWatch = {
			...expandedWatch,
			[ticker]: !expandedWatch[ticker]
		};
	}
</script>

<svelte:head>
	<title>Portfolio Dashboard</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page">
	<DashboardHeader lastUpdated={data.lastUpdated} totalStocks={data.counts.total} />
	<WorldVolCard worldVolSignal={data.worldVolSignal} />
	<CoreAllocation />
	<DeploySection
		deployNow={data.deployNow}
		topPicks={data.topPicks}
		hurdles={data.hurdles}
		expandedTicker={expandedDeploy}
		onToggle={toggleDeploy}
	/>
	<WaitSection cheapWait={data.cheapWait} expandedTicker={expandedWait} onToggle={toggleWait} />
	<WatchlistSection
		watchlist={data.watchlist}
		counts={data.counts}
		{showWatchlist}
		{expandedWatch}
		onToggleWatchlist={toggleWatchlist}
		onToggleWatch={toggleWatch}
	/>
</div>
