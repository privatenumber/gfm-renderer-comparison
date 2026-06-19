import fs from 'node:fs/promises';

/**
 * Downloads the official GitHub Flavored Markdown spec test suite (the
 * cmark-gfm reference spec.txt) and parses its embedded examples into JSON.
 *
 * This is a second, rate-limit-free ground truth. Note: the spec's expected
 * HTML is the cmark-gfm reference output (unsanitized), which differs from the
 * live github.com API output (sanitized + extra extensions).
 */

const SPEC_URL = 'https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt';

const outputPath = new URL('../corpus/spec.json', import.meta.url);

export type SpecExample = {
	example: number;
	section: string;
	markdown: string;
	html: string;
};

// Spec encodes tabs as → (U+2192) in both markdown and HTML blocks.
const decodeTabs = (text: string) => text.replaceAll('\u2192', '\t');

const parseSpec = (source: string): SpecExample[] => {
	const lines = source.split('\n');
	const examples: SpecExample[] = [];

	let section = '';
	let exampleNumber = 0;
	let state: 'idle' | 'markdown' | 'html' = 'idle';
	let markdownLines: string[] = [];
	let htmlLines: string[] = [];

	const fenceOpen = /^`{10,}\s*example\b/;
	const fenceClose = /^`{10,}\s*$/;

	for (const line of lines) {
		if (state === 'idle') {
			if (fenceOpen.test(line)) {
				state = 'markdown';
				markdownLines = [];
				htmlLines = [];
			} else if (/^#{1,6}\s+/.test(line)) {
				section = line.replace(/^#{1,6}\s+/, '').trim();
			}
			continue;
		}

		if (state === 'markdown') {
			if (line === '.') {
				state = 'html';
			} else {
				markdownLines.push(line);
			}
			continue;
		}

		// state === 'html'
		if (fenceClose.test(line)) {
			exampleNumber += 1;
			examples.push({
				example: exampleNumber,
				section,
				markdown: decodeTabs(markdownLines.join('\n')),
				html: decodeTabs(htmlLines.join('\n')),
			});
			state = 'idle';
		} else {
			htmlLines.push(line);
		}
	}

	return examples;
};

console.log(`Downloading GFM spec from ${SPEC_URL}`);
const response = await fetch(SPEC_URL);
if (!response.ok) {
	throw new Error(`Failed to download spec: ${response.status} ${response.statusText}`);
}
const source = await response.text();
const examples = parseSpec(source);

if (examples.length === 0) {
	throw new Error('Parsed 0 examples from spec — the format may have changed.');
}

await fs.writeFile(outputPath, `${JSON.stringify(examples, null, '\t')}\n`);

const sections = new Map<string, number>();
for (const example of examples) {
	sections.set(example.section, (sections.get(example.section) ?? 0) + 1);
}
console.log(`Parsed ${examples.length} examples across ${sections.size} sections.`);
console.log('Extension sections:');
for (const [section, count] of sections) {
	if (/extension/i.test(section)) {
		console.log(`  ${section}: ${count}`);
	}
}
console.log('Output: corpus/spec.json');
