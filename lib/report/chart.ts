import QuickChart from 'quickchart-js';

// Deterministic per-label color: hash the name, spread hues by the golden angle
// so adjacent bars stay distinct, with mild saturation/lightness jitter. Ported
// from privatenumber/minification-benchmarks so the charts share a visual style.
const hash32 = (value: string) => {
	let h = 2_166_136_261 >>> 0;
	for (let i = 0; i < value.length;) {
		const codePoint = value.codePointAt(i)!;
		h ^= codePoint;
		h = Math.imul(h, 16_777_619);
		i += codePoint > 0xFF_FF ? 2 : 1;
	}
	return h >>> 0;
};

const colorFromName = (name: string, opacity = 1) => {
	const goldenAngle = 137.507_764_050_037_85;
	const hashed = hash32(name);
	const hue = (hashed * goldenAngle) % 360;
	const saturation = 75 + ((((hashed >>> 8) & 0xFF) / 255) - 0.5) * 15; // ~67–82%
	const lightness = 50 + ((((hashed >>> 16) & 0xFF) / 255) - 0.5) * 15; // ~42–57%
	return `hsla(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%, ${opacity})`;
};

const theme = {
	dark: { text: '#f0f6fc', grid: '#f0f6fc1a' },
	light: { text: '#24292f', grid: '#24292f1a' },
} as const;

// Serialized into the QuickChart URL and executed on their server, so it must
// stay closure-free (no captured variables) — type stripping blanks the `number`
// annotation to whitespace before `javascript-stringify` reads `.toString()`.
const valueLabel = (value: number) => value.toFixed(3);

export type BarChartInput = {
	/** Title drawn above the chart. */
	title: string;
	/** Y-axis caption. */
	yAxisLabel: string;
	/** Upper bound of the y-axis; the lower bound is always 0. */
	yMax: number;
	/** Bars in display order (the caller sorts them). */
	bars: { label: string; value: number }[];
};

const chartUrl = (
	{ title, yAxisLabel, yMax, bars }: BarChartInput,
	mode: 'dark' | 'light',
) => {
	const colors = theme[mode];
	const labels = bars.map(bar => bar.label);

	return new QuickChart()
		.setFormat('svg')
		.setWidth(900)
		.setHeight(400)
		.setBackgroundColor('transparent')
		.setVersion('4')
		.setConfig({
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: yAxisLabel,
						data: bars.map(bar => Number(bar.value.toFixed(3))),
						backgroundColor: labels.map(label => colorFromName(label, 0.7)),
						borderColor: labels.map(label => colorFromName(label)),
						borderWidth: 1,
					},
				],
			},
			options: {
				scales: {
					x: {
						ticks: { color: colors.text, maxRotation: 45, minRotation: 45 },
						grid: { display: false },
					},
					y: {
						min: 0,
						max: yMax,
						ticks: { color: colors.text, font: { size: 10 } },
						title: {
							display: true, text: yAxisLabel, color: colors.text, font: { size: 14 },
						},
						grid: { color: colors.grid },
					},
				},
				plugins: {
					title: {
						display: true, text: title, color: colors.text, font: { size: 20 },
					},
					legend: { display: false },
					datalabels: {
						anchor: 'end',
						align: 'top',
						formatter: valueLabel,
						color: colors.text,
						font: { size: 10 },
					},
				},
			},
		})
		.getUrl();
};

/**
 * Builds a GitHub-friendly bar chart as a `<picture>` element with separate
 * light/dark QuickChart SVGs (transparent background, Chart.js v4). Returned as
 * a Markdown-embeddable HTML string for the README's mdeval markers.
 */
export const buildBarChart = (input: BarChartInput) => [
	'<picture>',
	`\t<source media="(prefers-color-scheme: dark)" srcset="${chartUrl(input, 'dark')}">`,
	`\t<img alt="${input.title}" src="${chartUrl(input, 'light')}">`,
	'</picture>',
].join('\n');
