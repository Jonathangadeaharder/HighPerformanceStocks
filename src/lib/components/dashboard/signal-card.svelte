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

<style>
	.signal-card {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 1rem;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.2s ease;
		width: 100%;
	}
	.signal-card:hover {
		border-color: var(--border-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}
	.signal-card.expanded {
		background: var(--bg-body);
		border-color: var(--border-hover);
	}
	.signal-card.wait {
		opacity: 0.9;
	}

	.signal-row1 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.ticker {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--text-primary);
	}
	.name {
		font-size: 0.875rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-grow: 1;
	}
	.group-tag {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--bg-surface-hover);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		color: var(--text-muted);
	}

	.signal-row2 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.score {
		font-weight: 700;
		font-size: 0.875rem;
	}
	.detail {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.signal-row3 {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		font-family: var(--font-mono);
	}
	.rc {
		color: var(--text-secondary);
	}

	.signal-row4 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.875rem;
		margin-top: 0.25rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 0.75rem;
	}
	.mono {
		font-family: var(--font-mono);
		color: var(--text-primary);
	}
	.arrow {
		color: var(--text-muted);
	}
	.cagr {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.spacer {
		flex-grow: 1;
	}
	.iv-badge {
		font-size: 0.75rem;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		background: var(--bg-surface-hover);
	}

	.expanded {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px dashed var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		cursor: default;
	}
	
	.summary-line {
		font-size: 0.875rem;
		line-height: 1.4;
	}
	.summary-line.success { color: var(--color-success); }
	.summary-line.warn { color: var(--color-warning); }

	.scenarios-panel {
		background: var(--bg-surface);
		border-radius: 0.375rem;
		padding: 0.75rem;
	}
	.scenarios-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
	}
	.scenarios-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.scenario {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-body);
		padding: 0.5rem;
		border-radius: 0.25rem;
		border: 1px solid var(--border-subtle);
	}
	.scenario.base { border-color: var(--border-hover); }
	.scenario-label {
		font-size: 0.625rem;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.scenario-value {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text-primary);
		font-weight: 600;
	}
	.scenario-params {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.basis {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.case {
		padding-left: 0.5rem;
		border-left: 2px solid;
	}
	.case.bull { border-color: var(--color-success); }
	.case.bear { border-color: var(--color-danger); }
	
	.case-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
		margin-bottom: 0.125rem;
	}
	.case.bull .case-label { color: var(--color-success); }
	.case.bear .case-label { color: var(--color-danger); }
	
	.case p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}
</style>
