import { loadCrateAddon } from '../../crate-addon.ts';

// comrak — the official Rust crate, bound directly via a small N-API addon
// (built by `pnpm build:comrak`). We bind the crate rather than the unofficial
// WASM wrapper (which trailed stable and was pinned to a pre-release) so a
// stable version + GFM options are used. Optional: skipped when not built.
export default await loadCrateAddon({
	adapterUrl: import.meta.url,
	name: 'comrak',
	crate: 'comrak',
	buildScript: 'build:comrak',
});
