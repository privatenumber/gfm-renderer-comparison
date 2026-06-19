import { describe, test, expect } from 'manten';

import { compare } from '../../lib/compare.ts';

describe('compare', () => {
	test('identical HTML is an exact match with similarity 1', () => {
		const html = '<p>Hello <strong>world</strong></p>';
		const result = compare(html, html);
		expect(result.exactMatch).toBe(true);
		expect(result.similarity).toBe(1);
		expect(result.diffs).toEqual([]);
	});

	test('attribute order and boolean-attribute spelling are treated as equal', () => {
		const actual = '<input disabled="" type="checkbox">';
		const expected = '<input type="checkbox" disabled>';
		const result = compare(actual, expected);
		expect(result.similarity).toBe(1);
		expect(result.diffs).toEqual([]);
		// ...but they are NOT byte-identical, and we still report that honestly.
		expect(result.exactMatch).toBe(false);
	});

	test('insignificant whitespace between block tags is ignored', () => {
		const result = compare('<ul>\n<li>a</li>\n</ul>', '<ul><li>a</li></ul>');
		expect(result.similarity).toBe(1);
		expect(result.diffs).toEqual([]);
	});

	test('significant whitespace adjacent to an inline element is NOT ignored', () => {
		// Rendered text differs ("ab" vs "a b"); these must not compare as identical.
		const result = compare('<p>a<em>b</em></p>', '<p>a <em>b</em></p>');
		expect(result.similarity).toBeLessThan(1);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test('significant whitespace between two inline elements is NOT ignored', () => {
		// "ab" vs "a b" again, via a whitespace-only text node between inline tags.
		const result = compare('<p><em>a</em><em>b</em></p>', '<p><em>a</em> <em>b</em></p>');
		expect(result.similarity).toBeLessThan(1);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test('whitespace at an inline element boundary (inside the tag) is NOT ignored', () => {
		// "<em>a </em><em>b</em>" renders "a b"; "<em>a</em><em>b</em>" renders "ab".
		// The space is the trailing text of the first <em>, so it must flow across
		// the element boundary.
		const result = compare('<p><em>a</em><em>b</em></p>', '<p><em>a </em><em>b</em></p>');
		expect(result.similarity).toBeLessThan(1);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test('whitespace after an inline void control (input) is NOT ignored', () => {
		// Task-list shape: "<input> item" renders "[ ] item"; "<input>item" renders "[ ]item".
		const result = compare('<p><input>item</p>', '<p><input> item</p>');
		expect(result.similarity).toBeLessThan(1);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test('formatter whitespace around <br> is ignored (same hard break)', () => {
		// cmark/GitHub serialize a hard break as "<br>\nLine"; marked emits "<br>Line".
		// Both render the same line break, so the source newline must not be a diff.
		const result = compare('<p>a<br>b</p>', '<p>a<br>\nb</p>');
		expect(result.similarity).toBe(1);
		expect(result.diffs).toEqual([]);
	});

	test('whitespace around an unknown/custom inline element is NOT ignored', () => {
		// Unknown/custom elements (e.g. GitHub's <math-renderer>) render inline per
		// HTML, so spaces around them are significant: "a x b" vs "axb".
		const result = compare(
			'<p>a<custom-el>x</custom-el>b</p>',
			'<p>a <custom-el>x</custom-el> b</p>',
		);
		expect(result.similarity).toBeLessThan(1);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test('a missing attribute is detected and categorized', () => {
		const expected = '<a href="x" rel="nofollow">y</a>';
		const actual = '<a href="x">y</a>';
		const result = compare(actual, expected);
		expect(result.exactMatch).toBe(false);
		expect(result.diffs).toHaveLength(1);
		expect(result.diffs[0]).toMatchObject({
			op: 'removed', // present in expected (GitHub), absent in actual (renderer)
			category: 'attribute',
			key: 'a.rel',
		});
		expect(result.similarity).toBeLessThan(1);
	});

	test('differing tag names (e.g. <s> vs <del>) are detected as tag diffs', () => {
		const result = compare('<s>x</s>', '<del>x</del>');
		const tagDiffs = result.diffs.filter(diff => diff.category === 'tag');
		expect(tagDiffs).toHaveLength(4); // removed <del, del> ; added <s, s>
		expect(result.similarity).toBeLessThan(1);
	});

	test('differing text content is detected at the word level', () => {
		const result = compare('<p>hello there</p>', '<p>hello world</p>');
		const textDiffs = result.diffs.filter(diff => diff.category === 'text');
		expect(textDiffs).toHaveLength(2); // removed "world", added "there"
		expect(textDiffs.every(diff => diff.category === 'text')).toBe(true);
	});

	test('completely different output yields low similarity', () => {
		const result = compare('<p>text</p>', '<table><tr><td>a</td></tr></table>');
		expect(result.similarity).toBeLessThan(0.3);
	});
});
