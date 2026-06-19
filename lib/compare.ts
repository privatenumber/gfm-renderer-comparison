import { fromHtml } from 'hast-util-from-html';

/**
 * Comparison strategy
 * ===================
 * We deliberately avoid lossy "normalize then string-compare" because that
 * forces us to enumerate, up front, every difference we're willing to forgive
 * (and silently hides the ones we didn't anticipate).
 *
 * Instead we measure transparently at two tiers:
 *
 *   Tier 0 — raw byte-identical match (`exactMatch`): zero assumptions.
 *
 *   Tier 1 — structural token diff: parse both outputs to a HAST tree and
 *   flatten to an ordered token stream (open tags, individual attributes, text
 *   words, comments). An LCS diff aligns the streams and reports EVERY
 *   non-matching token, each tagged with a category (tag / attribute / text /
 *   comment). Nothing is filtered before measuring — differences are
 *   categorized AFTER, so surprises surface instead of disappearing.
 *
 * Parsing to HAST inherently ignores only things that are genuinely
 * insignificant in HTML: attribute order and insignificant whitespace, plus
 * boolean-attribute spelling (`disabled` === `disabled=""`). Those are reported
 * as a "whitespace" category when they do matter to text.
 */

export type DiffCategory = 'tag' | 'attribute' | 'text' | 'comment';

export type TokenDiff = {
	op: 'added' | 'removed';
	category: DiffCategory;
	/** For attribute diffs, the attribute key (e.g. "a.rel") */
	key?: string;
	token: string;
};

export type Comparison = {
	exactMatch: boolean;
	similarity: number;
	diffs: TokenDiff[];
	actualTokenCount: number;
	expectedTokenCount: number;
};

type HastNode = {
	type: string;
	tagName?: string;
	value?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
};

const collapseWhitespace = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

const serializeAttributeValue = (value: unknown): string => {
	if (value === true) {
		return 'true';
	}
	if (value === false) {
		return 'false';
	}
	if (Array.isArray(value)) {
		return value.join(' ');
	}
	return String(value);
};

// Block-level elements. Whitespace at their boundaries collapses away when
// rendered. Everything NOT listed here — including inline/phrasing elements and
// unknown/custom elements (e.g. GitHub's `<math-renderer>`) — is treated as
// inline, matching HTML's default `display: inline` for unknown tags, so spaces
// around it stay significant.
const blockTags = new Set([
	'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'center',
	'col', 'colgroup', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset',
	'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'head', 'header', 'hgroup', 'hr', 'html', 'legend', 'li', 'main', 'menu',
	'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td',
	'tfoot', 'th', 'thead', 'tr', 'ul',
	// GitHub wraps tables in this custom block element.
	'markdown-accessiblity-table',
]);

// A whitespace marker, categorized as text (starts with '#').
const spaceToken = '#␣';

/**
 * Flattens a HAST tree into an ordered stream of comparison tokens.
 * - Element:   `<tag` ... then sorted `@tag.attr=value` ... then `tag>`
 * - Text:      one `#word` token per whitespace-separated word
 * - Space:     `#␣` for rendered whitespace (significant); see model below
 * - Comment:   `!comment`
 *
 * Whitespace model: a single pending space is carried through the document-order
 * walk and committed before the next piece of content. It is committed across
 * inline-element boundaries (so `<em>a </em><em>b</em>` → "a b") but discarded at
 * block boundaries (so newlines/indentation between block tags collapse away, and
 * leading/trailing space inside a block is dropped). Runs collapse to one space;
 * intra-text spacing is captured implicitly by word-token separation.
 */
export const tokenize = (html: string): string[] => {
	const tree = fromHtml(html, { fragment: true }) as HastNode;
	const tokens: string[] = [];

	let pendingSpace = false; // whitespace seen but not yet committed
	let atBlockEdge = true; // suppress whitespace at the start/end of a block

	const commitSpace = () => {
		if (pendingSpace && !atBlockEdge) {
			tokens.push(spaceToken);
		}
		pendingSpace = false;
	};

	const walk = (node: HastNode) => {
		switch (node.type) {
			case 'root': {
				node.children?.forEach(walk);
				break;
			}
			case 'element': {
				const tag = node.tagName ?? 'unknown';

				const pushOpenTag = () => {
					tokens.push(`<${tag}`);
					const properties = node.properties ?? {};
					for (const key of Object.keys(properties).sort()) {
						tokens.push(`@${tag}.${key}=${serializeAttributeValue(properties[key])}`);
					}
				};

				// A line break is a line edge: whitespace on either side of it is
				// insignificant formatting (cmark serializes "<br>\nLine"; others "<br>Line").
				if (tag === 'br') {
					pendingSpace = false;
					pushOpenTag();
					node.children?.forEach(walk);
					tokens.push(`${tag}>`);
					pendingSpace = false;
					atBlockEdge = true;
					break;
				}

				const isBlock = blockTags.has(tag);
				if (isBlock) {
					pendingSpace = false;
					atBlockEdge = true;
				} else {
					commitSpace(); // an inline element is content; flush whitespace before it
				}
				pushOpenTag();
				if (!isBlock) {
					atBlockEdge = false;
				}
				node.children?.forEach(walk);
				tokens.push(`${tag}>`);
				if (isBlock) {
					pendingSpace = false;
					atBlockEdge = true;
				} else {
					atBlockEdge = false; // more inline content may follow this element
				}
				break;
			}
			case 'text': {
				const raw = node.value ?? '';
				const collapsed = collapseWhitespace(raw);
				if (!collapsed) {
					if (/\s/.test(raw)) {
						pendingSpace = true;
					}
					break;
				}
				if (/^\s/.test(raw)) {
					pendingSpace = true;
				}
				const words = collapsed.split(' ');
				for (let index = 0; index < words.length; index += 1) {
					if (index === 0) {
						commitSpace();
					}
					tokens.push(`#${words[index]}`);
					atBlockEdge = false;
				}
				if (/\s$/.test(raw)) {
					pendingSpace = true;
				}
				break;
			}
			case 'comment': {
				tokens.push(`!${collapseWhitespace(node.value ?? '')}`);
				break;
			}
			default: // doctype, etc. — ignore
				break;
		}
	};

	walk(tree);
	return tokens;
};

const categorize = (token: string): { category: DiffCategory; key?: string } => {
	if (token.startsWith('@')) {
		const key = token.slice(1, token.indexOf('='));
		return { category: 'attribute', key };
	}
	if (token.startsWith('#')) {
		return { category: 'text' };
	}
	if (token.startsWith('!')) {
		return { category: 'comment' };
	}
	return { category: 'tag' };
};

/**
 * Standard LCS dynamic-programming table, then backtrace to produce the
 * added/removed token list (a minimal edit script ordering).
 */
const diffTokens = (expected: string[], actual: string[]): { lcs: number; diffs: TokenDiff[] } => {
	const rows = expected.length;
	const cols = actual.length;
	const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));

	for (let i = rows - 1; i >= 0; i -= 1) {
		for (let j = cols - 1; j >= 0; j -= 1) {
			table[i][j] = (
				expected[i] === actual[j]
					? table[i + 1][j + 1] + 1
					: Math.max(table[i + 1][j], table[i][j + 1])
			);
		}
	}

	const diffs: TokenDiff[] = [];
	let i = 0;
	let j = 0;
	while (i < rows && j < cols) {
		if (expected[i] === actual[j]) {
			i += 1;
			j += 1;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			diffs.push({ op: 'removed', token: expected[i], ...categorize(expected[i]) });
			i += 1;
		} else {
			diffs.push({ op: 'added', token: actual[j], ...categorize(actual[j]) });
			j += 1;
		}
	}
	while (i < rows) {
		diffs.push({ op: 'removed', token: expected[i], ...categorize(expected[i]) });
		i += 1;
	}
	while (j < cols) {
		diffs.push({ op: 'added', token: actual[j], ...categorize(actual[j]) });
		j += 1;
	}

	return { lcs: table[0][0], diffs };
};

/**
 * Compares a renderer's output (`actual`) against ground-truth HTML (`expected`).
 * `similarity` is the Sørensen–Dice coefficient over the LCS of token streams
 * (1 = structurally identical, 0 = nothing in common).
 */
export const compare = (actual: string, expected: string): Comparison => {
	const exactMatch = actual === expected;
	const expectedTokens = tokenize(expected);
	const actualTokens = tokenize(actual);

	const total = expectedTokens.length + actualTokens.length;
	if (total === 0) {
		return {
			exactMatch, similarity: 1, diffs: [], actualTokenCount: 0, expectedTokenCount: 0,
		};
	}

	const { lcs, diffs } = diffTokens(expectedTokens, actualTokens);
	const similarity = (2 * lcs) / total;

	return {
		exactMatch,
		similarity,
		diffs,
		actualTokenCount: actualTokens.length,
		expectedTokenCount: expectedTokens.length,
	};
};
