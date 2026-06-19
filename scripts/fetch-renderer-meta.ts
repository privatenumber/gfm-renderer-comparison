import fs from 'node:fs/promises';

import { renderers } from '../lib/renderers/index.ts';

// Token from the environment (package.json injects it via `gh auth token`).
const token = process.env.GITHUB_TOKEN?.trim();

/**
 * Caches per-renderer metadata for the README table: the source repo, the
 * pinned version's release date, and the repo's last commit (date + URL). Keyed
 * by package name so renderers sharing an engine (e.g. marked + marked-github)
 * resolve to one entry and the package is fetched once.
 *
 * Version + repo come from the package's registry (npm or crates.io); the last
 * commit from the GitHub API via `gh` (using your existing auth). Monorepo npm
 * packages resolve to their subdirectory for both the link and the commit
 * lookup. Run via `pnpm fetch:meta` (also part of `pnpm fetch`).
 */

type RendererMeta = {
	/** Source repo URL (subdirectory for monorepo packages), for the name link. */
	repo: string | null;
	/** ISO date (YYYY-MM-DD) the pinned version was published. */
	releaseDate: string | null;
	/** ISO date (YYYY-MM-DD) of the latest commit touching the package. */
	lastCommitDate: string | null;
	/** GitHub URL of that commit. */
	lastCommitUrl: string | null;
};

const isoDate = (value: string | undefined | null) => (value ? value.slice(0, 10) : null);

// Extract owner/repo from a `repository` URL (git+https://, git://, ssh,
// trailing .git, #branch suffix all tolerated). Returns null for non-GitHub.
const parseGitHub = (url: string | undefined | null) => {
	const match = url?.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:#.*)?$/);
	return match ? { owner: match[1], repo: match[2] } : null;
};

const ghApi = async (endpoint: string): Promise<unknown> => {
	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'gfm-renderer-comparison',
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	try {
		const response = await fetch(`https://api.github.com/${endpoint}`, { headers });
		if (!response.ok) {
			return null; // rate-limited, repo moved, etc. — degrade gracefully
		}
		return await response.json();
	} catch {
		return null; // network error — degrade gracefully
	}
};

// Resolve a canonical repo link + its last commit. `directory` filters commits
// to a monorepo package's subtree (and links to it); a stale directory absent on
// the default branch falls back to the repo as a whole.
const resolveRepo = async (url: string | undefined | null, directory?: string) => {
	const github = parseGitHub(url);
	if (!github) {
		return { repo: null, lastCommitDate: null, lastCommitUrl: null };
	}

	const { owner, repo } = github;
	const repoRoot = `https://github.com/${owner}/${repo}`;

	const latestCommit = async (path?: string) => {
		const result = await ghApi(`repos/${owner}/${repo}/commits?per_page=1${path ? `&path=${path}` : ''}`);
		return Array.isArray(result) ? result[0] : undefined;
	};

	let commit = await latestCommit(directory);
	const directoryValid = Boolean(directory) && Boolean(commit);
	if (!commit && directory) {
		commit = await latestCommit();
	}

	return {
		repo: directoryValid ? `${repoRoot}/tree/HEAD/${directory}` : repoRoot,
		lastCommitDate: commit ? isoDate(commit.commit?.committer?.date) : null,
		lastCommitUrl: commit?.html_url ?? null,
	};
};

const fromNpm = async (packageName: string, version: string): Promise<RendererMeta> => {
	const data = await (await fetch(`https://registry.npmjs.org/${packageName}`)).json() as {
		time?: Record<string, string>;
		repository?: string | { url?: string; directory?: string };
	};
	const repository = data.repository;
	const url = typeof repository === 'string' ? repository : repository?.url;
	const directory = typeof repository === 'object' ? repository?.directory : undefined;
	return { releaseDate: isoDate(data.time?.[version]), ...(await resolveRepo(url, directory)) };
};

const fromCrates = async (packageName: string, version: string): Promise<RendererMeta> => {
	// crates.io rejects requests without a descriptive User-Agent.
	const data = await (await fetch(`https://crates.io/api/v1/crates/${packageName}`, {
		headers: { 'User-Agent': 'gfm-renderer-comparison (renderer metadata)' },
	})).json() as {
		crate?: { repository?: string };
		versions?: { num: string; created_at: string }[];
	};
	const releaseDate = isoDate(data.versions?.find(entry => entry.num === version)?.created_at);
	return { releaseDate, ...(await resolveRepo(data.crate?.repository)) };
};

// One entry per unique package, keyed by `registry:packageName` so a name
// shared across registries (e.g. the `markdown` npm package and the `markdown`
// Rust crate) stays distinct, while renderers sharing one package (marked +
// marked-github) still dedupe to a single fetch.
const packages = new Map<string, { packageName: string; version: string; registry: 'npm' | 'crates' }>();
for (const renderer of renderers) {
	const key = `${renderer.registry}:${renderer.packageName}`;
	if (!packages.has(key)) {
		packages.set(key, { packageName: renderer.packageName, version: renderer.version, registry: renderer.registry });
	}
}

// Fetch every package concurrently. Promise.all preserves Map order, so the
// written JSON stays deterministic regardless of which request settles first.
const entries = await Promise.all([...packages].map(async ([key, { packageName, version, registry }]) => {
	let entry: RendererMeta = { repo: null, releaseDate: null, lastCommitDate: null, lastCommitUrl: null };
	try {
		entry = registry === 'crates'
			? await fromCrates(packageName, version)
			: await fromNpm(packageName, version);
	} catch (error) {
		console.warn(`  ${key}: ${(error as Error).message}`);
	}
	console.log(`  ${key}: ${entry.repo ? 'repo' : 'no-repo'}, released ${entry.releaseDate ?? '?'}, last commit ${entry.lastCommitDate ?? '—'}`);
	return [key, entry] as const;
}));

const metadata: Record<string, RendererMeta> = Object.fromEntries(entries);

const outputPath = new URL('../results/renderer-metadata.json', import.meta.url);
await fs.writeFile(outputPath, `${JSON.stringify(metadata, null, '\t')}\n`);
console.log(`\nWrote ${Object.keys(metadata).length} entries to results/renderer-metadata.json`);
