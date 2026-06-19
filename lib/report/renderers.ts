import fs from 'node:fs/promises';

import { table, link, code } from 'md-pen';

import { renderers } from '../renderers/index.ts';

type RendererMeta = {
	repo: string | null;
	releaseDate: string | null;
	lastCommitDate: string | null;
	lastCommitUrl: string | null;
};

const loadMetadata = async (): Promise<Record<string, RendererMeta>> => {
	try {
		return JSON.parse(await fs.readFile(new URL('../../results/renderer-metadata.json', import.meta.url), 'utf8'));
	} catch {
		return {}; // not fetched yet — date/repo columns degrade to "—"
	}
};

// Read once at module load (top-level await) so the table/link builders stay
// synchronous — keeping the README's inline mdeval `linkRenderer(...)` markers simple.
const metadata = await loadMetadata();

/**
 * Builds the renderers table: name (linked to its GitHub repo), the pinned
 * version (linked to that exact version on npm), the version's release date, and
 * the engine's last commit (linked to the commit). Repo/date columns come from
 * the cached metadata (`pnpm fetch:meta`) and fall back to "—" when missing.
 * Renderers sharing an engine resolve to the same metadata via packageName.
 */
export const buildRendererTable = (): string => {
	const headers = ['Renderer', 'Version', 'Published', 'Last commit'];

	// Metadata is keyed by `registry:packageName` (so the `markdown` npm package
	// and the `markdown` Rust crate stay distinct).
	const metaOf = (renderer: typeof renderers[number]) => metadata[`${renderer.registry}:${renderer.packageName}`];

	// Order by maintenance recency: most recently committed first, so stale or
	// abandoned engines sink to the bottom. Missing dates (no known repo) sort
	// last; ties break on release date, then name for a stable order. Copy first
	// so the canonical `renderers` order (used by accuracy/speed) is untouched.
	const ordered = [...renderers].sort((a, b) => (
		(metaOf(b)?.lastCommitDate ?? '').localeCompare(metaOf(a)?.lastCommitDate ?? '')
		|| (metaOf(b)?.releaseDate ?? '').localeCompare(metaOf(a)?.releaseDate ?? '')
		|| a.name.localeCompare(b.name)
	));

	const rows = ordered.map((renderer) => {
		const meta = metaOf(renderer);

		// Name → GitHub repo (plain code when the package has no known repo).
		const name = meta?.repo ? link(meta.repo, code(renderer.name)) : code(renderer.name);

		// Version → the exact version on its registry (npm or crates.io). Show
		// `pkg@version` for composed renderers (label ≠ package) so the underlying
		// engine stays visible.
		const base = renderer.registry === 'crates'
			? `https://crates.io/crates/${renderer.packageName}`
			: `https://www.npmjs.com/package/${renderer.packageName}`;
		const versionPath = renderer.registry === 'crates' ? '/' : '/v/';
		const versionUrl = renderer.version === 'unknown' ? base : `${base}${versionPath}${renderer.version}`;
		const spec = renderer.version === 'unknown'
			? renderer.packageName
			: (renderer.name === renderer.packageName ? renderer.version : `${renderer.packageName}@${renderer.version}`);
		const version = link(versionUrl, code(spec));

		const released = meta?.releaseDate ?? '—';
		const lastCommit = meta?.lastCommitUrl && meta.lastCommitDate
			? link(meta.lastCommitUrl, meta.lastCommitDate)
			: (meta?.lastCommitDate ?? '—');

		return [name, version, released, lastCommit];
	});

	return table([headers, ...rows]);
};

/**
 * Wraps a renderer's name in a Markdown link to its source repo (plain code when
 * the repo is unknown), so prose references like the README's TL;DR are
 * clickable and resolve to the same repos as the renderers table.
 */
export const linkRenderer = (name: string): string => {
	const renderer = renderers.find(candidate => candidate.name === name);
	if (!renderer) {
		return code(name);
	}
	const repo = metadata[`${renderer.registry}:${renderer.packageName}`]?.repo;
	return repo ? link(repo, code(name)) : code(name);
};
