import { fileURLToPath } from 'node:url';

import { configure, describe, setProcessTimeout } from 'manten';

// Keep the snapshot file beside the tests rather than at the repo root.
// Must run before any expectSnapshot() (the spec imports below).
configure({ snapshotPath: fileURLToPath(new URL('./.manten.snap', import.meta.url)) });

// Safety net for CI so a hung renderer can't wedge the process.
setProcessTimeout(5 * 60 * 1000);

// Each spec invokes describe() at its top level; these dynamic imports nest
// those groups under the parent. Not awaited, so they run concurrently.
describe('gfm-renderer-comparison', () => {
	import('./specs/compare.ts');
	import('./specs/corpus.ts');
	import('./specs/packaging.ts');
	import('./specs/renderers.ts');
});
