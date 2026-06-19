import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineRenderer, type Renderer } from './define-renderer.ts';

/**
 * Shared plumbing for renderers that bind an official Rust crate via a small
 * N-API addon. Each adapter is a directory holding a Cargo crate (`src/lib.rs`
 * exposing `render`), a one-line `build.ts` calling `buildCrateAddon`, and an
 * `index.ts` calling `loadCrateAddon`. The macOS link flags live once in the
 * repo's `.cargo/config.toml` (cargo finds it by walking up from the crate).
 */

const cdylibName = (libName: string) => (
	process.platform === 'win32'
		? { file: `${libName}.dll` }
		: process.platform === 'darwin'
			? { file: `lib${libName}.dylib` }
			: { file: `lib${libName}.so` }
);

/**
 * Compiles the crate co-located with `adapterUrl` (its `import.meta.url`) and
 * copies the resulting cdylib to a Node-loadable `binding.node`. Requires cargo.
 */
export const buildCrateAddon = async (adapterUrl: string, libName: string): Promise<void> => {
	// Imported lazily so nano-spawn stays out of the runtime graph — this build
	// helper shares a module with the runtime `loadCrateAddon` below.
	const { default: spawn } = await import('nano-spawn');
	const directory = path.dirname(fileURLToPath(adapterUrl));

	console.log(`Compiling ${libName} N-API addon (cargo build --release)...`);
	await spawn('cargo', ['build', '--release'], { cwd: directory, stdio: 'inherit' });

	const compiled = path.join(directory, 'target', 'release', cdylibName(libName).file);
	const output = path.join(directory, 'binding.node');
	await fs.copyFile(compiled, output);
	console.log(`Built ${path.relative(process.cwd(), output)}`);
};

type CrateAddon = {
	/** The adapter's `import.meta.url`, used to resolve `binding.node` + `Cargo.lock`. */
	adapterUrl: string;
	/** Renderer label (e.g. "markdown-rs"). */
	name: string;
	/** crates.io package the version + link resolve to (e.g. "markdown"). */
	crate: string;
	/** pnpm script that builds the addon, named in the skip warning. */
	buildScript: string;
};

/**
 * Loads a built crate addon as a `Renderer`, or returns `null` (with a warning)
 * when the addon hasn't been built — keeping the comparison runnable without a
 * Rust toolchain. The version is read from the lockfile cargo writes on build.
 */
export const loadCrateAddon = async ({ adapterUrl, name, crate, buildScript }: CrateAddon): Promise<Renderer | null> => {
	const binary = fileURLToPath(new URL('./binding.node', adapterUrl));
	const built = await fs.access(binary).then(() => true, () => false);
	if (!built) {
		console.warn(`[renderers] ${name} addon not built (run \`pnpm ${buildScript}\`), skipping.`);
		return null;
	}

	let version = 'unknown';
	try {
		const lock = await fs.readFile(new URL('./Cargo.lock', adapterUrl), 'utf8');
		version = lock.match(new RegExp(`name = "${crate}"\\nversion = "([^"]+)"`))?.[1] ?? 'unknown';
	} catch {
		// no lockfile — leave version unknown
	}

	const addon = createRequire(adapterUrl)(binary) as { render: (markdown: string) => string };
	return defineRenderer({
		name,
		packageName: crate,
		version,
		registry: 'crates',
		render: markdown => addon.render(markdown),
	});
};
