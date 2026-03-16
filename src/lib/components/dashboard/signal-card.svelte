<script lang="ts">
	import type { FindingStock } from '$lib/types/dashboard';
	import {
		deploymentReason,
		detailLabel,
		intrinsicValueColor,
		intrinsicValueLabel,
		returnColor,
		revisionsSummary,
		scenarioKeys,
		scenarioValue,
		scoreColor,
		scoreLabel,
		screenerNote,
		stabilizationReturn,
		upsideColor,
		isGrowthEngine
	} from './helpers';
	import QualityBadges from './quality-badges.svelte';
	import SensitivityLine from './sensitivity-line.svelte';

	type CardKind = 'deploy' | 'wait';

	let {
		stock,
		kind,
		expanded,
		onToggle
	}: {
		stock: FindingStock;
		kind: CardKind;
		expanded: boolean;
		onToggle: () => void;
	} = $props();
</script>

<button class="signal-card" class:wait={kind === 'wait'} class:expanded onclick={onToggle}>
	<div class="signal-row1">
		<span class="ticker">{stock.ticker}</span>
		<span class="name">{stock.name}</span>
		<span class="group-tag">{stock.group}</span>
	</div>

	<div class="signal-row2">
		<span
			class="score"
			style="color:{kind === 'deploy' && !isGrowthEngine(stock)
				? '#22c55e'
				: scoreColor(stock.screener?.score)}"
		>
			{scoreLabel(stock)}
		</span>
		<span class="detail">{kind === 'deploy' ? detailLabel(stock) : deploymentReason(stock)}</span>
	</div>

	{#if stock.screener?.realityChecks}
		<div class="signal-row3">
			{#if stock.screener.realityChecks.stabilization}
				<span class="rc" style="color:{returnColor(stock.screener.realityChecks.stabilization.return6m)}">
					{kind === 'deploy' ? '✓ ' : ''}{stabilizationReturn(
						stock.screener.realityChecks.stabilization.return6m
					)}
					6m
				</span>
				<span class="rc" style="color:{returnColor(stock.screener.realityChecks.stabilization.return1m)}">
					{kind === 'deploy' ? '✓ ' : ''}{stabilizationReturn(
						stock.screener.realityChecks.stabilization.return1m
					)}
					1m
				</span>
				{#if kind === 'wait' && stock.screener.realityChecks.stabilization.near3mLow}
					<span class="rc" style="color:#facc15">near 3m low</span>
				{/if}
			{/if}
			{#if kind === 'deploy' && stock.screener.realityChecks.revisions}
				<span class="rc pass">{revisionsSummary(stock)}</span>
			{/if}
		</div>
	{/if}

	<div class="signal-row4">
		<span class="mono">{stock.currentPrice}</span>
		{#if stock.targetPrice}
			<span class="arrow">→</span>
			<span class="mono">{stock.targetPrice}</span>
			{#if stock.upside != null}
				<span class="mono" style="color:{upsideColor(stock.upside)}">
					({stock.upside > 0 ? '+' : ''}{stock.upside}%)
				</span>
			{/if}
		{/if}
		{#if intrinsicValueLabel(stock)}
			<span class="iv-badge" style="color:{intrinsicValueColor(stock)}">
				{intrinsicValueLabel(stock)}
			</span>
		{/if}
		<span class="spacer"></span>
		<span class="cagr">
			{#if kind === 'deploy'}Rank {stock.deploymentRank} ·
			{/if}Bear/Base/Bull
			{stock.cagrModel?.scenarios?.bear} / {stock.cagrModel?.scenarios?.base} /
			{stock.cagrModel?.scenarios?.bull}
		</span>
	</div>

	{#if expanded}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="expanded"
			onclick={(event) => {
				event.stopPropagation();
			}}
		>
			<div class="summary-line {kind === 'deploy' ? 'success' : 'warn'}">
				{kind === 'deploy' ? deploymentReason(stock) : screenerNote(stock)}
			</div>
			{#if kind === 'deploy' && stock.cagrModel?.scenarios}
				<div class="scenarios-panel">
					<div class="scenarios-label">CAGR Scenarios ({stock.cagrModel.horizon ?? 5}yr)</div>
					<div class="scenarios-row">
						{#each scenarioKeys as scenario (scenario)}
							{#if scenarioValue(stock, scenario)}
								<div class="scenario" class:base={scenario === 'base'}>
									<span class="scenario-label">{scenario}</span>
									<span class="scenario-value">{scenarioValue(stock, scenario)}</span>
								</div>
							{/if}
						{/each}
					</div>
					<div class="scenario-params">
						{#if stock.cagrModel.epsGrowth}EPS growth {stock.cagrModel.epsGrowth}{/if}
						{#if stock.cagrModel.exitPE?.base}
							· Exit PE {stock.cagrModel.exitPE.bear}/{stock.cagrModel.exitPE.base}/{stock.cagrModel
								.exitPE.bull}
						{/if}
						{#if stock.cagrModel.dividendYield && stock.cagrModel.dividendYield !== '0%'}
							· DY {stock.cagrModel.dividendYield}
						{/if}
					</div>
					{#if stock.cagrModel.basis}
						<div class="basis">{stock.cagrModel.basis}</div>
					{/if}
				</div>
			{/if}

			<SensitivityLine
				sensitivityCagr={stock.sensitivityCagr}
				epsGrowth={stock.cagrModel?.epsGrowth}
			/>
			<QualityBadges metrics={stock.metrics} />

			{#if stock.bullCase}
				<div class="case bull">
					<div class="case-label">Bull</div>
					<p>{stock.bullCase}</p>
				</div>
			{/if}
			{#if stock.bearCase}
				<div class="case bear">
					<div class="case-label">Bear</div>
					<p>{stock.bearCase}</p>
				</div>
			{/if}
		</div>
	{/if}
</button>
