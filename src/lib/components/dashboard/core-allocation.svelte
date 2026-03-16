<section class="section">
	<div class="section-label">Core Allocation</div>
	<div class="mini-guide">
		Why this is here: ETFs are the default portfolio. Stocks only earn capital when the evidence is
		unusually strong.
	</div>
	<div class="alloc-grid">
		<div class="alloc-box scv">
			<div class="alloc-pct">45%</div>
			<div class="alloc-name">Small Cap Value</div>
			<div class="alloc-sub">Global developed markets</div>
		</div>
		<div class="alloc-box mom">
			<div class="alloc-pct">45%</div>
			<div class="alloc-name">Momentum</div>
			<div class="alloc-sub">MSCI developed markets</div>
		</div>
		<div class="alloc-box em">
			<div class="alloc-pct">10%</div>
			<div class="alloc-name">Emerging Markets</div>
			<div class="alloc-sub">Cap-weighted</div>
		</div>
	</div>
	<p class="alloc-note">
		Default position is to stay in ETFs. Move capital into individual stocks only when valuation,
		forward return, and stabilization all agree.
	</p>
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
	.alloc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.alloc-box {
		background: var(--bg-body);
		border: 1px solid var(--border-subtle);
		padding: 1rem;
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.alloc-box.scv { border-top: 3px solid #3b82f6; }
	.alloc-box.mom { border-top: 3px solid #8b5cf6; }
	.alloc-box.em { border-top: 3px solid #ec4899; }
	
	.alloc-pct {
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.alloc-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	.alloc-sub {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.alloc-note {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}
</style>
