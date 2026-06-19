import { markdown as markdownLib } from 'markdown';

import { defineRenderer } from '../define-renderer.ts';

// evilstreak's "markdown" — one of the oldest JS parsers; no GFM (baseline).
export default await defineRenderer({
	name: 'markdown',
	render: source => markdownLib.toHTML(source),
});
