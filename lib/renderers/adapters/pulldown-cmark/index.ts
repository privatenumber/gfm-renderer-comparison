import { loadCrateAddon } from '../../crate-addon.ts';

// pulldown-cmark — the official Rust crate, bound directly via a small N-API
// addon (built by `pnpm build:pulldown`). We bind the crate rather than the
// unmaintained npm wrapper so its GFM extensions can be enabled (tables,
// strikethrough, task lists, footnotes). Optional: skipped when not built.
export default await loadCrateAddon({
	adapterUrl: import.meta.url,
	name: 'pulldown-cmark',
	crate: 'pulldown-cmark',
	buildScript: 'build:pulldown',
});
