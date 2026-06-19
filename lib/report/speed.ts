import { table } from 'md-pen';
import { bench, run, do_not_optimize } from 'mitata';

import { renderers } from '../renderers/index.ts';
import { loadCases } from '../corpus.ts';

export type SpeedSummary = {
	fastest: string;
	fastestMs: string;
	slowest: string;
};

export type SpeedReport = {
	/** Markdown table: avg render time, throughput, and relative speed per renderer. */
	table: string;
	/** Corpus size rendered per op, in KB (e.g. "6.3"). */
	corpusKb: string;
	/** Benchmark environment (e.g. "node 24.14.0, Apple M5 Pro"). */
	context: string;
	/** Fastest/slowest names + headline figure, interpolated into the verdict prose. */
	summary: SpeedSummary;
};

/**
 * Benchmarks each renderer on a single realistic, mixed workload: the entire
 * fixture corpus concatenated into one document (headings, lists, tables, code,
 * task lists, blockquotes, raw HTML, etc.) and returns the data the README's
 * mdeval markers inject: the results table, corpus size, environment, and the
 * fastest/slowest summary. Pure — it neither logs nor writes files.
 */
export const computeSpeed = async (): Promise<SpeedReport> => {
	const corpus = (await loadCases())
		.map(caseItem => caseItem.markdown)
		.join('\n\n');
	const corpusBytes = Buffer.byteLength(corpus, 'utf8');

	for (const renderer of renderers) {
		bench(renderer.name, () => {
			do_not_optimize(renderer.render(corpus));
		});
	}

	const result = await run({ format: 'quiet' });

	type Row = { name: string; avgNs: number };
	const rows: Row[] = result.benchmarks
		.map(benchmark => ({
			name: String(benchmark.alias),
			avgNs: benchmark.runs[0]?.stats?.avg ?? Number.POSITIVE_INFINITY,
		}))
		.sort((a, b) => a.avgNs - b.avgNs);

	const fastest = rows[0]?.avgNs ?? 1;

	const formatMs = (ns: number) => `${(ns / 1e6).toFixed(3)} ms`;
	const formatOps = (ns: number) => `${Math.round(1e9 / ns).toLocaleString('en-US')} ops/s`;
	const formatRelative = (ns: number) => (ns === fastest ? '1.00× (fastest)' : `${(ns / fastest).toFixed(2)}× slower`);

	const headers = ['Rank', 'Renderer', 'Avg / render', 'Throughput', 'Relative'];
	const tableRows = rows.map((row, index) => [
		index + 1,
		row.name,
		formatMs(row.avgNs),
		formatOps(row.avgNs),
		formatRelative(row.avgNs),
	]);

	// mitata's `ctx` type omits `version` (present at runtime, e.g. "24.14.0").
	const benchContext = result.context as typeof result.context & { version: string };

	return {
		table: table([headers, ...tableRows]),
		corpusKb: (corpusBytes / 1024).toFixed(1),
		context: `${benchContext.runtime} ${benchContext.version}, ${benchContext.cpu.name}`,
		summary: {
			fastest: rows[0]?.name ?? 'n/a',
			fastestMs: formatMs(fastest),
			slowest: rows.at(-1)?.name ?? 'n/a',
		},
	};
};
