import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cli } from 'cleye';
import spawn from 'nano-spawn';

import { renderers } from '../lib/renderers/index.ts';

// Preview markdown as HTML using any of the comparison's renderers. See --help.

const DEFAULT_RENDERER = 'marked-github';

const argv = cli({
	name: 'render',
	parameters: ['[file]'],
	flags: {
		renderer: {
			type: String,
			alias: 'r',
			default: DEFAULT_RENDERER,
			placeholder: '<name>',
			description: 'Renderer to use (see --list)',
		},
		open: {
			type: Boolean,
			alias: 'o',
			description: 'Open a styled preview in the browser',
		},
		list: {
			type: Boolean,
			alias: 'l',
			description: 'List available renderers and exit',
		},
	},
	help: {
		description: `Preview a markdown file (or stdin) as HTML using any of the comparison's renderers. Default: ${DEFAULT_RENDERER} (closest to github.com).`,
		examples: [
			'render README.md',
			'render README.md -r micromark',
			'cat foo.md | render',
			'render README.md --open',
			'render --list',
		],
	},
});

if (argv.flags.list) {
	console.log('Available renderers (name → npm package):');
	const width = Math.max(...renderers.map(renderer => renderer.name.length));
	for (const renderer of renderers) {
		const spec = renderer.version === 'unknown' ? renderer.packageName : `${renderer.packageName}@${renderer.version}`;
		console.log(`  ${renderer.name.padEnd(width)}  ${spec}`);
	}
	process.exit(0);
}

const renderer = renderers.find(candidate => candidate.name === argv.flags.renderer);
if (!renderer) {
	console.error(`Unknown renderer "${argv.flags.renderer}". Available: ${renderers.map(candidate => candidate.name).join(', ')}`);
	process.exit(1);
}

// File argument, else stdin (consumed as a stream — fs.readFile can't take fd 0).
const readStdin = async () => {
	process.stdin.setEncoding('utf8');
	let data = '';
	for await (const chunk of process.stdin) {
		data += chunk;
	}
	return data;
};

const markdown = argv._.file ? await fs.readFile(argv._.file, 'utf8') : await readStdin();
const html = renderer.render(markdown);

if (argv.flags.open) {
	const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${argv._.file ?? 'markdown'} — ${renderer.name}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css">
<style>body { box-sizing: border-box; max-width: 880px; margin: 0 auto; padding: 2.5rem; }</style>
</head>
<body class="markdown-body">
${html}
</body>
</html>
`;
	const outputPath = join(tmpdir(), `gfm-preview-${renderer.name}-${Date.now()}.html`);
	await fs.writeFile(outputPath, document);
	await spawn('open', [outputPath]);
	console.error(`Opened ${renderer.name} preview: ${outputPath}`);
} else {
	process.stdout.write(html.endsWith('\n') ? html : `${html}\n`);
}
