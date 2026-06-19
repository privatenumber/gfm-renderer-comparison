// Minimal types for `markdown` (evilstreak's markdown-js; ships none).
declare module 'markdown' {
	export const markdown: {
		toHTML(source: string): string;
	};
}
