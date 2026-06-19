// Minimal types for `showdown` (ships none) — only the surface the adapter uses.
declare module 'showdown' {
	export class Converter {
		setFlavor(flavor: string): void;
		makeHtml(markdown: string): string;
	}

	const showdown: { Converter: typeof Converter };
	export default showdown;
}
