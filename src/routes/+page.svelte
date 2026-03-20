<script lang="ts">
	import type { PageData } from './$types';
	import CoreAllocation from '$lib/components/dashboard/core-allocation.svelte';
	import DashboardHeader from '$lib/components/dashboard/dashboard-header.svelte';
	import DeploySection from '$lib/components/dashboard/deploy-section.svelte';
	import WaitSection from '$lib/components/dashboard/wait-section.svelte';
	import WatchlistSection from '$lib/components/dashboard/watchlist-section.svelte';
	import WorldVolCard from '$lib/components/dashboard/world-vol-card.svelte';
	import TabNav from '$lib/components/dashboard/tab-nav.svelte';
	import PortfolioSection from '$lib/components/dashboard/portfolio-section.svelte';

	type TabId = 'signals' | 'wait' | 'watchlist' | 'portfolio';

	let { data }: { data: PageData } = $props();
	let activeTab = $state<TabId>('signals');
	let expandedDeploy = $state<string | null>(null);
	let expandedWait = $state<string | null>(null);
	let expandedWatch = $state<Record<string, boolean>>({});

	function toggleDeploy(ticker: string): void {
		expandedDeploy = expandedDeploy === ticker ? null : ticker;
	}

	function toggleWait(ticker: string): void {
		expandedWait = expandedWait === ticker ? null : ticker;
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
</svelte:head>

<div class="page">
	<DashboardHeader lastUpdated={data.lastUpdated} totalStocks={data.counts.total} />
	<TabNav
		{activeTab}
		onSwitch={(tab: TabId) => {
			activeTab = tab;
		}}
	/>

	{#if activeTab === 'signals'}
		<div id="panel-signals" role="tabpanel" aria-label="Signals tab">
			<WorldVolCard worldVolSignal={data.worldVolSignal} />
			<CoreAllocation />
			<DeploySection
				deployNow={data.deployNow}
				cheapWait={data.cheapWait}
				watchlist={data.watchlist}
				topPicks={data.topPicks}
				hurdles={data.hurdles}
				expandedTicker={expandedDeploy}
				onToggle={toggleDeploy}
			/>
		</div>
	{:else if activeTab === 'wait'}
		<div id="panel-wait" role="tabpanel" aria-label="Wait tab">
			<WaitSection cheapWait={data.cheapWait} expandedTicker={expandedWait} onToggle={toggleWait} />
		</div>
	{:else if activeTab === 'watchlist'}
		<div id="panel-watchlist" role="tabpanel" aria-label="Watchlist tab">
			<WatchlistSection
				watchlist={data.watchlist}
				counts={data.counts}
				showWatchlist={true}
				{expandedWatch}
				onToggleWatchlist={undefined}
				onToggleWatch={toggleWatch}
			/>
		</div>
	{:else if activeTab === 'portfolio'}
		<div id="panel-portfolio" role="tabpanel" aria-label="Portfolio tab">
			<PortfolioSection deployNow={data.deployNow} />
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: var(--max-width, 1400px);
		margin: 0 auto;
		padding: 2rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		min-height: 100vh;
	}

	@media (min-width: 768px) {
		.page {
			padding: 2.5rem 2rem;
			gap: 2.5rem;
		}
	}
</style>
