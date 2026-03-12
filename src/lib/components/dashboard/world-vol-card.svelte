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
