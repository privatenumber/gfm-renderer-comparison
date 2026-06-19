import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import markedAlert from 'marked-alert';
import markedFootnote from 'marked-footnote';
import { markedEmoji } from 'marked-emoji';
import hljs from 'highlight.js';
import { nameToEmoji } from 'gemoji';

import { defineRenderer } from '../define-renderer.ts';

// Composed GitHub-emulation pipeline: marked + its official extensions (syntax
// highlighting via highlight.js, GitHub alerts, footnotes, emoji) + rel="nofollow".
// There's no maintained drop-in "GitHub renderer" package, so this composes one
// to measure how far the gap to GitHub can be closed.
const pipeline = new Marked()
	.use(markedHighlight({
		langPrefix: 'hljs language-',
		highlight: (code, lang) => {
			const language = hljs.getLanguage(lang) ? lang : 'plaintext';
			return hljs.highlight(code, { language }).value;
		},
	}))
	.use(markedAlert())
	.use(markedFootnote())
	.use(markedEmoji({ emojis: nameToEmoji, renderer: token => token.emoji }))
	.use({
		gfm: true,
		hooks: {
			postprocess: html => html.replaceAll(/<a href="(https?:[^"]*)"/g, '<a href="$1" rel="nofollow"'),
		},
	});

export default await defineRenderer({
	name: 'marked-github',
	packageName: 'marked',
	render: markdown => pipeline.parse(markdown, { async: false }) as string,
});
