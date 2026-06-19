import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import spawn from 'nano-spawn';

/**
 * Builds a tiny N-API addon for hoedown by compiling hoedown's bundled C engine
 * together with the co-located `napi.c`, sidestepping the package's broken
 * V8-era binding. Output: `binding.node` next to this script (gitignored).
 *
 * The addon is optional: the adapter (index.ts) skips hoedown if it isn't built.
 */

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const hoedownDir = path.dirname(require.resolve('hoedown/package.json'));
const sourceDir = path.join(hoedownDir, 'src'); // so `#include "hoedown/..."` resolves
const engineDir = path.join(sourceDir, 'hoedown'); // the .c files
const nodeInclude = path.join(process.execPath, '..', '..', 'include', 'node');

const cFiles = (await fs.readdir(engineDir))
	.filter(file => file.endsWith('.c'))
	.map(file => path.join(engineDir, file));

const output = path.join(here, 'binding.node');

const args: string[] = [
	'-O2', '-fPIC',
	'-bundle', '-undefined', 'dynamic_lookup', // macOS loadable Node addon
	`-I${sourceDir}`,
	`-I${nodeInclude}`,
	...cFiles,
	path.join(here, 'napi.c'),
	'-o', output,
];

console.log('Compiling hoedown N-API addon...');
await spawn('clang', args, { stdio: 'inherit' });
console.log(`Built ${path.relative(process.cwd(), output)}`);
