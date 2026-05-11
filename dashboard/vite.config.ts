import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import path from 'node:path';

const dashboardDir = path.resolve(import.meta.dirname, 'node_modules');
const requireFromDashboard = createRequire(path.join(dashboardDir, '__placeholder__.js'));

// Catalog files live outside the dashboard directory so vite can't resolve their
// bare-specifier imports (e.g. "@lucide/svelte") via the normal node_modules walk.
// This plugin intercepts those imports and resolves them through the dashboard's
// own node_modules, which is where all the UI deps are installed.
const catalogResolvePlugin = {
	name: 'catalog-resolve',
	resolveId(source: string, importer: string | undefined) {
		if (
			importer &&
			importer.includes('/weft/catalog/') &&
			!source.startsWith('.') &&
			!source.startsWith('/')
		) {
			try {
				return requireFromDashboard.resolve(source);
			} catch {
				return null;
			}
		}
	},
};

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), catalogResolvePlugin],
	test: {
		include: ['src/**/*.test.ts'],
	},
	resolve: {},
	optimizeDeps: {
		include: ['svelte-sonner']
	},
	ssr: {
		noExternal: ['svelte-sonner']
	}
});
