import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromHtml } from 'hast-util-from-html';
import spawn from 'nano-spawn';

import { renderers } from '../lib/renderers/index.ts';
import { loadCases } from '../lib/corpus.ts';

/**
 * Writes one `results/diffs/<renderer>.diff` per renderer: a unified diff of the
 * renderer's HTML against GitHub's `/markdown` output, for every fixture case
 * that differs. Both sides are pretty-printed to a canonical one-node-per-line
 * form (sorted attributes, collapsed insignificant whitespace, normalized
 * boolean attrs and self-closing) so the diff surfaces real structural/content
 * divergences rather than formatting noise.
 *
 * `.diff` files render with red/green highlighting on GitHub. Run `pnpm diffs`.
 */

type HastNode = {
	type: string;
	tagName?: string;
	value?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
};

// hast parses to DOM property names (className, ariaHidden, dataFootnoteRef,
// viewBox); map them back to real HTML attribute names so the diffs read as HTML.
const propertyToAttribute = (key: string): string => {
	if (key === 'className') {
		return 'class';
	}
	if (key === 'htmlFor') {
		return 'for';
	}
	if (/^(?:aria|data)[A-Z]/.test(key)) {
		return key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
	}
	return key; // href, src, id, role, viewBox (SVG, case-preserved), etc.
};

const formatAttribute = (key: string, value: unknown): string => {
	const attribute = propertyToAttribute(key);
	if (value === true) {
		return ` ${attribute}`; // boolean attribute
	}
	const serialized = Array.isArray(value) ? value.join(' ') : String(value);
	return ` ${attribute}="${serialized}"`;
};

/** Canonical, line-per-node HTML serialization for readable diffs. */
const prettyHtml = (html: string): string => {
	const tree = fromHtml(html, { fragment: true }) as HastNode;
	const lines: string[] = [];

	const walk = (node: HastNode, depth: number) => {
		const indent = '  '.repeat(depth);
		switch (node.type) {
			case 'root': {
				node.children?.forEach(child => walk(child, depth));
				break;
			}
			case 'text': {
				const text = (node.value ?? '').replace(/\s+/g, ' ').trim();
				if (text) {
					lines.push(indent + text);
				}
				break;
			}
			case 'comment': {
				lines.push(`${indent}<!--${(node.value ?? '').trim()}-->`);
				break;
			}
			case 'element': {
				const properties = node.properties ?? {};
				const attributes = Object.keys(properties)
					.sort()
					.map(key => formatAttribute(key, properties[key]))
					.join('');
				const children = node.children ?? [];
				if (children.length === 0) {
					lines.push(`${indent}<${node.tagName}${attributes} />`);
				} else {
					lines.push(`${indent}<${node.tagName}${attributes}>`);
					children.forEach(child => walk(child, depth + 1));
					lines.push(`${indent}</${node.tagName}>`);
				}
				break;
			}
			default:
				break;
		}
	};

	walk(tree, 0);
	return `${lines.join('\n')}\n`;
};

const diffsDirectory = fileURLToPath(new URL('../results/diffs/', import.meta.url));
await fs.mkdir(diffsDirectory, { recursive: true });

const cases = await loadCases();
// Pre-read + pre-format every expected file once (each is compared against all
// 18 renderers), concurrently and keyed by case.
const expectedPretty = new Map(
	await Promise.all(cases.map(async fixtureCase => [
		fixtureCase,
		prettyHtml(await fs.readFile(
			new URL(`../corpus/${fixtureCase.category}/${fixtureCase.id}.html`, import.meta.url),
			'utf8',
		)),
	] as const)),
);

// Diff every renderer concurrently. Each task uses its own temp-file pair (keyed
// by renderer name) so parallel `diff` invocations never collide; the written
// `.diff` files are deterministic regardless of completion order.
const summary = await Promise.all(renderers.map(async (renderer) => {
	const tmpExpected = join(tmpdir(), `gfm-diff-${renderer.name}-expected.txt`);
	const tmpActual = join(tmpdir(), `gfm-diff-${renderer.name}-actual.txt`);
	const sections: string[] = [];

	for (const fixtureCase of cases) {
		const expected = expectedPretty.get(fixtureCase)!;
		const actual = prettyHtml(renderer.render(fixtureCase.markdown));
		if (expected === actual) {
			continue; // structurally identical — nothing to show
		}

		await fs.writeFile(tmpExpected, expected);
		await fs.writeFile(tmpActual, actual);

		// Label the sides descriptively: GitHub's output vs this renderer's.
		const expectedLabel = `expected/${fixtureCase.id}.html`;
		const rendererLabel = `${renderer.name}/${fixtureCase.id}.html`;

		let unified: string;
		try {
			const result = await spawn('diff', [
				'-u',
				'-L', expectedLabel,
				'-L', rendererLabel,
				tmpExpected, tmpActual,
			]);
			unified = result.stdout;
		} catch (error) {
			// `diff` exits 1 when files differ; the patch is on stdout.
			unified = (error as { stdout?: string }).stdout ?? '';
		}

		// nano-spawn strips one trailing newline; diff output is always
		// newline-terminated here, so restore it to keep sections separated.
		sections.push(`diff --git ${expectedLabel} ${rendererLabel}\n${unified}\n`);
	}

	await fs.writeFile(join(diffsDirectory, `${renderer.name}.diff`), sections.join(''));
	await Promise.all([
		fs.rm(tmpExpected, { force: true }),
		fs.rm(tmpActual, { force: true }),
	]);
	return { name: renderer.name, diverged: sections.length };
}));

summary.sort((a, b) => a.diverged - b.diverged);

console.log(`Wrote ${summary.length} diffs to results/diffs/`);
for (const { name, diverged } of summary) {
	console.log(`  ${name.padEnd(16)} ${diverged} diverging cases`);
}
