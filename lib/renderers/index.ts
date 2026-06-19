import fs from 'node:fs/promises';

import type { Renderer } from './define-renderer.ts';

/**
 * Discovers every renderer adapter in `adapters/` and collects the ones that are
 * available. Each adapter default-exports a `Renderer` (via `defineRenderer`) or
 * `null` when an optional engine (e.g. cmark-gfm, hoedown) isn't installed/built.
 *
 * An adapter is either a single file (`adapters/marked.ts`) or a directory with
 * an `index.ts` (`adapters/hoedown/` — which also holds its native interop).
 * Adding a renderer is just dropping a new file or folder into `adapters/`.
 *
 * Each adapter is configured to be as close to GitHub's rendering as its options
 * allow (all GFM extensions on, raw HTML passed through, no smartypants, soft
 * line breaks). Adapters own their own async setup via top-level await (e.g. wasm
 * init), which this loader awaits per import.
 */

const adaptersDirectory = new URL('./adapters/', import.meta.url);

const entries = (await fs.readdir(adaptersDirectory, { withFileTypes: true }))
	.sort((a, b) => a.name.localeCompare(b.name));

const specifiers = entries
	.map((entry) => {
		if (entry.isDirectory()) {
			return new URL(`${entry.name}/index.ts`, adaptersDirectory);
		}
		if (entry.name.endsWith('.ts')) {
			return new URL(entry.name, adaptersDirectory);
		}
		return undefined;
	})
	.filter((specifier): specifier is URL => specifier !== undefined);

// Adapters are independent and several run async setup at import time (wasm
// init, dynamic native require), so load them concurrently rather than serially
// awaiting each. Promise.all preserves order, keeping the list alphabetical.
const modules = await Promise.all(
	specifiers.map(async (specifier) => {
		const module = await import(specifier.href) as { default: Renderer | null };
		return module.default;
	}),
);

export const renderers = modules.filter(
	(renderer): renderer is Renderer => renderer !== null,
);

export type { Renderer } from './define-renderer.ts';
