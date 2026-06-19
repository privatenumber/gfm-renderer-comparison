// Minimal types for `commonmark` (ships none) — only the surface the adapter uses.
declare module 'commonmark' {
	/** Opaque CommonMark AST node: produced by `Parser.parse`, consumed by `HtmlRenderer.render`. */
	export interface Node {
		readonly type: string;
	}

	export class Parser {
		parse(markdown: string): Node;
	}

	export class HtmlRenderer {
		constructor(options?: { safe?: boolean });
		render(node: Node): string;
	}
}
