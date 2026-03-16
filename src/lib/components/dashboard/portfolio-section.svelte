<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { FindingStock } from '$lib/types/dashboard';
	import {
		rankWeightedPositions,
		equalWeight,
		analyzeSectorConcentration,
		computePortfolioSummary
	} from '$lib/domain/portfolio';
	import PortfolioSummaryCard from './portfolio-summary.svelte';
	import SectorBreakdown from './sector-breakdown.svelte';
	import PortfolioTable from './portfolio-table.svelte';

	let { deployNow }: { deployNow: FindingStock[] } = $props();

	// untrack: intentionally capture initial value only (user toggles from here)
	let includedTickers = $state(untrack(() => new SvelteSet(deployNow.map((s) => s.ticker))));
	let weightingMode = $state<'equal' | 'rank'>('equal');

	const selected = $derived(deployNow.filter((s) => includedTickers.has(s.ticker)));

	const weights = $derived(
		weightingMode === 'rank'
			? rankWeightedPositions(selected)
			: new Map(selected.map((s) => [s.ticker, equalWeight(selected.length)]))
	);

	const analysis = $derived(analyzeSectorConcentration(selected, weights));
	const summary = $derived(
		computePortfolioSummary(selected, deployNow.length, weights, weightingMode)
	);

	function toggleTicker(ticker: string): void {
		if (includedTickers.has(ticker)) {
			includedTickers.delete(ticker);
		} else {
			includedTickers.add(ticker);
		}
	}

	function toggleMode(): void {
		weightingMode = weightingMode === 'equal' ? 'rank' : 'equal';
	}
</script>

<div class="portfolio-section">
	<PortfolioSummaryCard {summary} onToggleMode={toggleMode} />
	<SectorBreakdown {analysis} />
	<PortfolioTable
		stocks={deployNow}
		{weights}
		{includedTickers}
		onToggle={toggleTicker}
	/>
</div>
