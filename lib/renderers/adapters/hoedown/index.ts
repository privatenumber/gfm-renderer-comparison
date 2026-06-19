import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defineRenderer, type Renderer } from '../../define-renderer.ts';

// The C hoedown engine. Its bundled V8 binding no longer compiles on modern
// Node, so `build.ts` (co-located) compiles a minimal N-API binding (`napi.c`)
// against hoedown's C sources into `binding.node` here. Optional: skipped if the
// addon hasn't been built (`pnpm build:hoedown`).
const require = createRequire(import.meta.url);
const binary = fileURLToPath(new URL('./binding.node', import.meta.url));

let renderer: Renderer | null = null;

const built = await fs.access(binary).then(() => true, () => false);
if (built) {
	const hoedown = require(binary) as { render: (markdown: string) => string };
	renderer = await defineRenderer({
		name: 'hoedown',
		render: markdown => hoedown.render(markdown),
	});
} else {
	console.warn('[renderers] hoedown addon not built (run `pnpm build:hoedown`), skipping.');
}

export default renderer;
