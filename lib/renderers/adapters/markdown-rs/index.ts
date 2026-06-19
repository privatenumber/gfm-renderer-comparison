import { loadCrateAddon } from '../../crate-addon.ts';

// markdown-rs — wooorm's Rust port of micromark/remark (the `markdown` crate),
// bound directly via a small N-API addon (built by `pnpm build:markdown-rs`).
// Replaces the stale `markdown-wasm` md4c wrapper with a maintained,
// reference-grade engine. Optional: skipped when not built.
export default await loadCrateAddon({
	adapterUrl: import.meta.url,
	name: 'markdown-rs',
	crate: 'markdown',
	buildScript: 'build:markdown-rs',
});
