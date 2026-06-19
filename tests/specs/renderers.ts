import { describe, test, expect, expectSnapshot } from 'manten';

import { renderers } from '../../lib/renderers/index.ts';
import { loadCases } from '../../lib/corpus.ts';

const cases = await loadCases();

describe('renderers', () => {
	for (const renderer of renderers) {
		describe(renderer.name, () => {
			for (const caseItem of cases) {
				test(caseItem.id, () => {
					const output = renderer.render(caseItem.markdown);

					// Every renderer must return a string for every fixture without throwing.
					expect(typeof output).toBe('string');

					// Some renderers are non-deterministic for some inputs — e.g. showdown
					// obfuscates email addresses with randomized entity encoding on every
					// render. Only regression-snapshot when output is stable across renders.
					const isDeterministic = renderer.render(caseItem.markdown) === output;
					if (isDeterministic) {
						// Update with MANTEN_UPDATE_SNAPSHOTS=1 when a renderer version
						// legitimately changes its output.
						expectSnapshot(output, `${renderer.name}:${caseItem.id}`);
					}
				});
			}
		});
	}
});
