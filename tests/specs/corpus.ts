import fs from 'node:fs/promises';

import { describe, test, expect } from 'manten';

import { loadCases } from '../../lib/corpus.ts';

const cases = await loadCases();

describe('corpus', () => {
	test('loads cases', () => {
		expect(cases.length).toBeGreaterThan(0);
	});

	test('case ids are unique', () => {
		const ids = cases.map(caseItem => caseItem.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('every case has non-empty markdown and a category', () => {
		for (const caseItem of cases) {
			expect(caseItem.markdown.length).toBeGreaterThan(0);
			expect(caseItem.category.length).toBeGreaterThan(0);
		}
	});

	test('every case has a co-located GitHub expected output (run `pnpm fetch` first)', async () => {
		const missing = (await Promise.all(cases.map(async (caseItem) => {
			const outputUrl = new URL(`../../corpus/${caseItem.category}/${caseItem.id}.html`, import.meta.url);
			const exists = await fs.access(outputUrl).then(() => true, () => false);
			return exists ? null : caseItem.id;
		}))).filter(id => id !== null);
		expect(missing).toEqual([]);
	});
});
