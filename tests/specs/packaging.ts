import fs from 'node:fs/promises';

import { describe, test, expect } from 'manten';

type PackageJson = {
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
};

describe('packaging', async () => {
	const packageJson = JSON.parse(
		await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
	) as PackageJson;

	// cmark-gfm is a native addon with an install/build step. It must be optional
	// so `pnpm install` doesn't hard-fail on platforms without a prebuild or
	// compiler; the cmark-gfm adapter already skips it at runtime when unavailable.
	test('native cmark-gfm is an optional dependency, not a hard dependency', () => {
		expect(packageJson.dependencies?.['cmark-gfm']).toBeUndefined();
		expect(packageJson.optionalDependencies?.['cmark-gfm']).toBeDefined();
	});
});
