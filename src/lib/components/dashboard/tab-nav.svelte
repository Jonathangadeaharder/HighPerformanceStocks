<script lang="ts">
	type TabId = 'signals' | 'wait' | 'watchlist' | 'portfolio';

	let {
		activeTab,
		onSwitch
	}: {
		activeTab: TabId;
		onSwitch: (tab: TabId) => void;
	} = $props();
</script>

<nav class="tab-nav">
	<button class="tab-btn" class:active={activeTab === 'signals'} onclick={() => { onSwitch('signals'); }}>
		Signals
	</button>
	<button class="tab-btn" class:active={activeTab === 'wait'} onclick={() => { onSwitch('wait'); }}>
		Wait
	</button>
	<button class="tab-btn" class:active={activeTab === 'watchlist'} onclick={() => { onSwitch('watchlist'); }}>
		Watchlist
	</button>
	<button
		class="tab-btn"
		class:active={activeTab === 'portfolio'}
		onclick={() => { onSwitch('portfolio'); }}
	>
		Portfolio
	</button>
</nav>

<style>
	.tab-nav {
		display: inline-flex;
		background: var(--bg-surface);
		padding: 0.375rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border-subtle);
		gap: 0.25rem;
	}
	
	.tab-btn {
		padding: 0.5rem 1.5rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		transition: all 0.2s ease;
	}
	
	.tab-btn:hover {
		color: var(--text-primary);
	}
	
	.tab-btn.active {
		background: var(--bg-body);
		color: var(--text-primary);
		border: 1px solid var(--border-hover);
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}
</style>
