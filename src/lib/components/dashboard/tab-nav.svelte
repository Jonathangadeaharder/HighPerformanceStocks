<script lang="ts">
	type TabId = 'signals' | 'portfolio';

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
	<button
		class="tab-btn"
		class:active={activeTab === 'portfolio'}
		onclick={() => { onSwitch('portfolio'); }}
	>
		Portfolio
	</button>
</nav>
