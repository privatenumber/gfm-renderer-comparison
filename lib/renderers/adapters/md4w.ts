import { init, mdToHtml, ParseFlags } from 'md4w';

import { defineRenderer } from '../define-renderer.ts';

// md4c reimplemented in Zig/C, compiled to WebAssembly. `init()` loads the wasm.
await init();

const flags = ParseFlags.TABLES
	| ParseFlags.STRIKETHROUGH
	| ParseFlags.TASKLISTS
	| ParseFlags.PERMISSIVE_URL_AUTO_LINKS
	| ParseFlags.PERMISSIVE_WWW_AUTO_LINKS;

export default await defineRenderer({
	name: 'md4w',
	render: markdown => mdToHtml(markdown, { parseFlags: flags }),
});
