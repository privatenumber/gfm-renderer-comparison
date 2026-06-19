// Minimal types for `@khanacademy/simple-markdown` (ships none). The CJS build
// exposes its API under `.default`.
declare module '@khanacademy/simple-markdown' {
	interface SimpleMarkdown {
		defaultBlockParse: (markdown: string) => unknown;
		defaultHtmlOutput: (tree: unknown) => string;
	}

	const simpleMarkdown: { default: SimpleMarkdown };
	export default simpleMarkdown;
}
