<script lang="ts">
	import { sensitivityColor } from './helpers';

	let { sensitivityCagr, epsGrowth }: { sensitivityCagr?: number | null; epsGrowth?: string } =
		$props();
</script>

{#if sensitivityCagr != null && epsGrowth}
	<div class="sensitivity-line" style="color:{sensitivityColor(sensitivityCagr)}">
		If growth −3pp ({epsGrowth} → {(Number.parseFloat(epsGrowth) - 3).toFixed(0)}%): base CAGR ~{sensitivityCagr}%
	</div>
{/if}
