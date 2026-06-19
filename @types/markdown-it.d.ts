// Minimal types for `markdown-it` (v14 ships none) — only what the adapter uses.
declare module 'markdown-it' {
	interface MarkdownIt {
		use(plugin: unknown, ...params: unknown[]): MarkdownIt;
		render(markdown: string): string;
	}

	interface Options {
		html?: boolean;
		linkify?: boolean;
		typographer?: boolean;
		breaks?: boolean;
	}

	const MarkdownIt: (options?: Options) => MarkdownIt;
	export default MarkdownIt;
}
