import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

import { loadCases } from '../lib/corpus.ts';

/**
 * Fetches GitHub's rendering of every fixture case via the REST Markdown API
 * (POST /markdown, mode: gfm, no repo context) and caches each as HTML.
 *
 * This is the primary ground truth: it includes GitHub's post-processing and
 * sanitization, i.e. exactly how a README/comment renders on github.com.
 *
 * Re-run with FORCE=1 to refetch already-cached cases.
 */

const renderViaGitHub = async (
	text: string,
	token: string | undefined,
	attempt = 1,
): Promise<string> => {
	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json',
		'Content-Type': 'application/json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'gfm-renderer-comparison',
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch('https://api.github.com/markdown', {
		method: 'POST',
		headers,
		body: JSON.stringify({ text, mode: 'gfm' }),
	});

	if (response.status === 403 || response.status === 429) {
		const reset = Number(response.headers.get('x-ratelimit-reset'));
		const remaining = response.headers.get('x-ratelimit-remaining');
		if (remaining === '0' && reset && attempt <= 1) {
			const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
			console.warn(`Rate limited. Waiting ${Math.round(waitMs / 1000)}s until reset...`);
			await setTimeout(waitMs);
			return renderViaGitHub(text, token, attempt + 1);
		}
	}

	if (!response.ok) {
		throw new Error(`GitHub API ${response.status} ${response.statusText}: ${await response.text()}`);
	}

	return response.text();
};

// Token from the environment (package.json injects it via `gh auth token`).
const token = process.env.GITHUB_TOKEN?.trim();
if (!token) {
	console.warn('No GITHUB_TOKEN found. Using unauthenticated requests (60/hr limit).');
} else {
	console.log('Using authenticated GitHub API requests.');
}

const cases = await loadCases();

let fetched = 0;
let skipped = 0;

// Sequential on purpose: the GitHub API is rate-limited (renderViaGitHub backs
// off on 429), so these fetches must not be parallelized.
for (const caseItem of cases) {
	const categoryDirectory = new URL(`../corpus/${caseItem.category}/`, import.meta.url);
	const outputPath = new URL(`${caseItem.id}.html`, categoryDirectory);
	const cached = await fs.access(outputPath).then(() => true, () => false);
	if (cached && !process.env.FORCE) {
		skipped += 1;
		continue;
	}

	await fs.mkdir(categoryDirectory, { recursive: true });
	const html = await renderViaGitHub(caseItem.markdown, token);
	await fs.writeFile(outputPath, html);
	fetched += 1;
	process.stdout.write(`\rFetched ${fetched} / ${cases.length} (${caseItem.id})${' '.repeat(20)}`);
	await setTimeout(80);
}

process.stdout.write('\n');
console.log(`Done. Fetched ${fetched}, skipped ${skipped} cached. Output: corpus/<category>/`);
