<script lang="ts">
	import type { WorldVolSignal } from '$lib/types/dashboard';
	import { componentWeight, volToneClass } from './helpers';

	let { worldVolSignal }: { worldVolSignal: WorldVolSignal } = $props();
</script>

<section class="section">
	<div class="section-label">Global Developed Volatility</div>
	<div class="mini-guide">
		Why this is here: a broad-market stress proxy helps decide whether 2x developed-markets exposure
		is attractive, neutral, or too risky.
	</div>
	<div class="vol-card {volToneClass(worldVolSignal)}">
		{#if worldVolSignal.available}
			<div class="vol-main">
				<div class="vol-value">{worldVolSignal.impliedVol}%</div>
				<div class="vol-meta">
					<div class="vol-action">{worldVolSignal.action}</div>
					<div class="vol-detail">
						Band {worldVolSignal.band}
						{#if worldVolSignal.expiry}
							· Expiry {worldVolSignal.expiry} ({worldVolSignal.daysToExpiry}d)
						{/if}
						· Source {worldVolSignal.source}
					</div>
				</div>
			</div>
			{#if worldVolSignal.components?.length}
				<div class="vol-components">
					{#each worldVolSignal.components as component (component.symbol)}
						<span class="vol-chip">
							{component.label}
							{#if componentWeight(component.weight)}
								{componentWeight(component.weight)}
							{/if}
							{#if component.value != null}
								· {component.value}
							{/if}
							{#if component.fresh === false}
								· stale
							{/if}
						</span>
					{/each}
				</div>
			{/if}
			<div class="vol-note">{worldVolSignal.note}</div>
		{:else}
			<div class="vol-main">
				<div class="vol-value">N/A</div>
				<div class="vol-meta">
					<div class="vol-action">Signal unavailable</div>
					<div class="vol-detail">Source {worldVolSignal.source} · {worldVolSignal.reason}</div>
				</div>
			</div>
			<div class="vol-note">
				This card prefers a VIX/VSTOXX blend and falls back gracefully when one of the feeds is
				unavailable.
			</div>
		{/if}
	</div>
</section>

<style>
	.section {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}
	.section-label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}
	.mini-guide {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 1.5rem;
	}
	.vol-card {
		background: var(--bg-body);
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 1rem;
	}
	.vol-card.high { border-left: 4px solid var(--color-danger); }
	.vol-card.elevated { border-left: 4px solid var(--color-warning); }
	.vol-card.normal { border-left: 4px solid var(--color-success); }
	
	.vol-main {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.vol-value {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.vol-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.vol-action {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}
	.vol-detail {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.vol-components {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.vol-chip {
		font-size: 0.75rem;
		background: var(--bg-surface-hover);
		color: var(--text-secondary);
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
	}
	.vol-note {
		font-size: 0.75rem;
		color: var(--text-muted);
		border-top: 1px solid var(--border-subtle);
		padding-top: 0.75rem;
	}
</style>
