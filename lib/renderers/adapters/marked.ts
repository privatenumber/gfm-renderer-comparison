import { marked } from 'marked';

import { defineRenderer } from '../define-renderer.ts';

// GFM is enabled by default; soft line breaks (no <br>), no smartypants.
export default await defineRenderer({
	name: 'marked',
	render: markdown => marked.parse(markdown, {
		gfm: true,
		breaks: false,
		pedantic: false,
		async: false,
	}) as string,
});
