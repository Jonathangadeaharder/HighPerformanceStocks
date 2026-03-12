import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			output: {
				// Keep the Svelte client runtime in one chunk to avoid Rollup's
				// circular execution-order warning for re-exported internals like `tick`.
				manualChunks(id) {
					if (id.includes('/node_modules/svelte/') || id.includes('/node_modules/.pnpm/svelte@')) {
						return 'svelte-runtime';
					}

					return undefined;
				}
			}
		}
	},
	server: {
		watch: {
			ignored: ['!**/data/stock-records/**']
		}
	}
});
