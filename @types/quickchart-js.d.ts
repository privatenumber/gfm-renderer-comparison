// quickchart-js resolves to its ESM build at runtime (real `export default`),
// but its single `index.d.ts` is read as CommonJS under `nodenext`, so the
// shipped `export default` is seen as `exports.default` and `new QuickChart()`
// isn't constructable. Re-declare the chained surface the chart builder uses.
declare module 'quickchart-js' {
	export default class QuickChart {
		setConfig(config: string | Record<string, unknown>): this;
		setWidth(width: number): this;
		setHeight(height: number): this;
		setBackgroundColor(color: string): this;
		setFormat(format: string): this;
		setVersion(version: string): this;
		getUrl(): string;
	}
}
