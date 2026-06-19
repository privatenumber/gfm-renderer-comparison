import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

/** Where the package's version + links resolve: npm registry or crates.io. */
export type Registry = 'npm' | 'crates';

export type Renderer = {
	name: string;
	/** Package the version + link resolve to (may differ from name). */
	packageName: string;
	version: string;
	/** Registry the package lives on, for version links + metadata lookup. */
	registry: Registry;
	render: (markdown: string) => string;
};

type RendererDefinition = {
	/** Display name (also the snapshot key prefix and report label). */
	name: string;
	/** Package whose version is shown in reports. Defaults to `name`. */
	packageName?: string;
	/** Explicit version (e.g. a Rust crate's, from Cargo.lock). Defaults to the
	 *  installed npm package's version resolved from node_modules. */
	version?: string;
	/** Defaults to 'npm'. Use 'crates' for engines bound directly to a Rust crate. */
	registry?: Registry;
	render: (markdown: string) => string;
};

const require = createRequire(import.meta.url);

const versionOf = async (packageName: string): Promise<string> => {
	// Read the manifest straight from the top-level node_modules (pnpm symlinks
	// direct deps there). Works even when a package's `exports` map hides
	// ./package.json from module resolution (e.g. md4w).
	try {
		const manifest = new URL(`../../node_modules/${packageName}/package.json`, import.meta.url);
		return JSON.parse(await fs.readFile(manifest, 'utf8')).version as string;
	} catch {
		// Fallback: resolve via the module system.
		try {
			const packageJsonPath = require.resolve(`${packageName}/package.json`);
			return JSON.parse(await fs.readFile(packageJsonPath, 'utf8')).version as string;
		} catch {
			return 'unknown';
		}
	}
};

/**
 * Defines a renderer adapter. Each file in `adapters/` default-exports one of
 * these (or `null` when an optional engine is unavailable). The version is
 * resolved from `packageName` (defaulting to `name`).
 */
export const defineRenderer = async (definition: RendererDefinition): Promise<Renderer> => {
	const packageName = definition.packageName ?? definition.name;
	return {
		name: definition.name,
		packageName,
		version: definition.version ?? await versionOf(packageName),
		registry: definition.registry ?? 'npm',
		render: definition.render,
	};
};
