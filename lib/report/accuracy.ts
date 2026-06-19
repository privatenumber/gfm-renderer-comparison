import fs from 'node:fs/promises';

import { table, link } from 'md-pen';

import { renderers } from '../renderers/index.ts';
import { loadCases } from '../corpus.ts';
import { compare } from '../compare.ts';
import { buildBarChart } from './chart.ts';

type SpecExample = {
	example: number;
	section: string;
	markdown: string;
	html: string;
};

export type AccuracySummary = {
	apiWinner: string;
	apiWinnerSimilarity: string;
	apiWinnerStructural: string;
	specWinner: string;
	specWinnerSimilarity: string;
};

export type AccuracyReport = {
	/** Number of GitHub-API ground-truth cases compared. */
	total: number;
	/** Number of official GFM-spec examples compared (0 when spec.json is absent). */
	specTotal: number;
	/** QuickChart `<picture>` bar chart of API mean similarity, ranked best→worst. */
	apiChart: string;
	/** Markdown table: headline similarity vs the GitHub API (5 core columns). */
	apiTable: string;
	/** Markdown table: API mean similarity broken down per corpus category. */
	apiByCategory: string;
	/** Markdown table: headline similarity vs the GFM spec (or a notice when not fetched). */
	specTable: string;
	/** Markdown table: spec mean similarity broken down per GFM extension section. */
	specByExtension: string;
	/** Winner names + headline figures, interpolated into the verdict prose. */
	summary: AccuracySummary;
};

const pct = (value: number, total: number) => (total === 0 ? '—' : `${((value / total) * 100).toFixed(1)}%`);
const sim = (value: number) => value.toFixed(3);

/**
 * Compares every renderer against both ground-truth sets (the live GitHub
 * /markdown API and the official GFM spec) and returns the data the README's
 * mdeval markers inject: three Markdown tables, the case/example counts, and the
 * winner summary used in the verdict. Pure — it neither logs nor writes files.
 */
export const computeAccuracy = async (): Promise<AccuracyReport> => {
	// -----------------------------------------------------------------------
	// API ground truth (GitHub /markdown) — the "render like GitHub" target.
	// -----------------------------------------------------------------------
	const cases = await loadCases();
	const categories = [...new Set(cases.map(caseItem => caseItem.category))];

	// Pre-read every expected HTML file once, concurrently, keyed by case — far
	// cheaper than re-reading per renderer (each file is compared against all 18).
	const expectedHtml = new Map(
		await Promise.all(cases.map(async caseItem => [
			caseItem,
			await fs.readFile(
				new URL(`../../corpus/${caseItem.category}/${caseItem.id}.html`, import.meta.url),
				'utf8',
			),
		] as const)),
	);

	type ApiResult = {
		name: string;
		exact: number;
		structural: number; // zero tree diffs (ignores only attr order + insignificant whitespace)
		similaritySum: number;
		perCategory: Map<string, { count: number; simSum: number }>;
	};

	const apiResults: ApiResult[] = renderers.map((renderer) => {
		const perCategory = new Map<string, { count: number; simSum: number }>(
			categories.map(category => [category, { count: 0, simSum: 0 }]),
		);
		let exact = 0;
		let structural = 0;
		let similaritySum = 0;

		for (const caseItem of cases) {
			const output = renderer.render(caseItem.markdown);
			const result = compare(output, expectedHtml.get(caseItem)!);

			similaritySum += result.similarity;
			if (result.exactMatch) {
				exact += 1;
			}
			if (result.diffs.length === 0) {
				structural += 1;
			}

			const bucket = perCategory.get(caseItem.category)!;
			bucket.count += 1;
			bucket.simSum += result.similarity;
		}

		return {
			name: renderer.name,
			exact,
			structural,
			similaritySum,
			perCategory,
		};
	});

	apiResults.sort((a, b) => b.similaritySum - a.similaritySum);

	const total = cases.length;

	const apiChart = buildBarChart({
		title: 'Mean similarity to the GitHub API',
		yAxisLabel: 'Mean similarity',
		yMax: 1,
		bars: apiResults.map(result => ({
			label: result.name,
			value: result.similaritySum / total,
		})),
	});

	// Headline table: the three numbers people actually compare. The renderer name
	// links to its full per-case diff against GitHub (committed under results/diffs/ by
	// `pnpm diffs`) — far more useful than a cramped summary of divergence types.
	const coreHeaders = ['Rank', 'Renderer', 'Mean similarity', 'Structural', 'Exact'];
	const apiRows = apiResults.map((result, index) => [
		index + 1,
		link(`results/diffs/${result.name}.diff`, result.name),
		sim(result.similaritySum / total),
		pct(result.structural, total),
		pct(result.exact, total),
	]);

	const apiCategoryHeaders = ['Rank', 'Renderer', ...categories];
	const apiCategoryRows = apiResults.map((result, index) => [
		index + 1,
		result.name,
		...categories.map((category) => {
			const bucket = result.perCategory.get(category)!;
			return sim(bucket.simSum / bucket.count);
		}),
	]);

	// -----------------------------------------------------------------------
	// GFM spec suite — rate-limit-free, cmark-gfm reference HTML.
	// -----------------------------------------------------------------------
	let specExamples: SpecExample[] = [];
	try {
		specExamples = JSON.parse(await fs.readFile(new URL('../../corpus/spec.json', import.meta.url), 'utf8'));
	} catch {
		// spec.json is optional; the spec table degrades to a notice below.
	}

	const extensionSections = [...new Set(
		specExamples.filter(example => /extension/i.test(example.section)).map(example => example.section),
	)];

	type SpecResult = {
		name: string;
		exact: number;
		structural: number;
		similaritySum: number;
		perSection: Map<string, { count: number; simSum: number }>;
	};

	const specResults: SpecResult[] = renderers.map((renderer) => {
		const perSection = new Map<string, { count: number; simSum: number }>();
		let exact = 0;
		let structural = 0;
		let similaritySum = 0;

		for (const example of specExamples) {
			let output: string;
			try {
				output = renderer.render(example.markdown);
			} catch {
				output = '';
			}
			const result = compare(output, example.html);
			similaritySum += result.similarity;
			if (result.exactMatch) {
				exact += 1;
			}
			if (result.diffs.length === 0) {
				structural += 1;
			}
			const bucket = perSection.get(example.section) ?? { count: 0, simSum: 0 };
			bucket.count += 1;
			bucket.simSum += result.similarity;
			perSection.set(example.section, bucket);
		}

		return {
			name: renderer.name, exact, structural, similaritySum, perSection,
		};
	});

	specResults.sort((a, b) => b.similaritySum - a.similaritySum);

	const specTotal = specExamples.length;
	const specRows = specResults.map((result, index) => [
		index + 1,
		result.name,
		sim(result.similaritySum / specTotal),
		pct(result.structural, specTotal),
		pct(result.exact, specTotal),
	]);

	const specExtensionHeaders = ['Rank', 'Renderer', ...extensionSections.map(s => s.replace(/\s*\(extension\)/, ''))];
	const specExtensionRows = specResults.map((result, index) => [
		index + 1,
		result.name,
		...extensionSections.map((section) => {
			const bucket = result.perSection.get(section);
			return bucket ? sim(bucket.simSum / bucket.count) : '—';
		}),
	]);

	const apiWinner = apiResults[0];
	const specWinner = specResults[0];

	return {
		total,
		specTotal,
		apiChart,
		apiTable: table([coreHeaders, ...apiRows]),
		apiByCategory: table([apiCategoryHeaders, ...apiCategoryRows]),
		specTable: specTotal > 0
			? table([coreHeaders, ...specRows])
			: '_GFM spec not fetched — run `pnpm fetch:gfm-spec`._',
		specByExtension: specTotal > 0
			? table([specExtensionHeaders, ...specExtensionRows])
			: '_GFM spec not fetched — run `pnpm fetch:gfm-spec`._',
		summary: {
			apiWinner: apiWinner.name,
			apiWinnerSimilarity: sim(apiWinner.similaritySum / total),
			apiWinnerStructural: pct(apiWinner.structural, total),
			specWinner: specTotal > 0 ? specWinner.name : '—',
			specWinnerSimilarity: specTotal > 0 ? sim(specWinner.similaritySum / specTotal) : '—',
		},
	};
};
