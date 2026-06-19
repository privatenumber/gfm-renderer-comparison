// Minimal types for `micro-down` (ships none).
declare module 'micro-down' {
	const microdown: {
		parse(markdown: string): string;
	};
	export default microdown;
}
