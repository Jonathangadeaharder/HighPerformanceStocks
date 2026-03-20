<script lang="ts">
	type TabId = 'signals' | 'wait' | 'watchlist' | 'portfolio';

	let {
		activeTab,
		onSwitch
	}: {
		activeTab: TabId;
		onSwitch: (tab: TabId) => void;
	} = $props();

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'signals', label: 'Signals' },
		{ id: 'wait', label: 'Wait' },
		{ id: 'watchlist', label: 'Watchlist' },
		{ id: 'portfolio', label: 'Portfolio' }
	];
</script>

<nav class="tab-nav" aria-label="Dashboard sections">
	<div role="tablist">
		{#each tabs as tab (tab.id)}
			<button
				class="tab-btn"
				class:active={activeTab === tab.id}
				role="tab"
				aria-selected={activeTab === tab.id}
				aria-controls="panel-{tab.id}"
				onclick={() => { onSwitch(tab.id); }}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</nav>

<style>
	.tab-nav {
		display: inline-block;
		background: var(--bg-surface);
		padding: 0.375rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border-subtle);
	}
	
	.tab-nav [role="tablist"] {
		display: inline-flex;
		gap: 0.25rem;
	}
	
	.tab-btn {
		padding: 0.5rem 1.5rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		transition: all 0.2s ease;
		cursor: pointer;
	}
	
	.tab-btn:hover {
		color: var(--text-primary);
	}
	
	.tab-btn:focus-visible {
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: 2px;
	}
	
	.tab-btn.active {
		background: var(--bg-body);
		color: var(--text-primary);
		border: 1px solid var(--border-hover);
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}
</style>
