<script lang="ts">
	import { sensitivityColor } from './helpers';

	let { sensitivityCagr }: { sensitivityCagr?: number | null } = $props();
</script>

{#if sensitivityCagr != null}
	<div class="sensitivity-line" style="color:{sensitivityColor(sensitivityCagr)}">
		Analyst target spread: {sensitivityCagr}pp (bull − bear)
	</div>
{/if}

<style>
	.sensitivity-line {
		font-size: 0.75rem;
		font-style: italic;
		opacity: 0.9;
		line-height: 1.4;
	}
</style>
