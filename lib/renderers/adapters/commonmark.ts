import { Parser, HtmlRenderer } from 'commonmark';

import { defineRenderer } from '../define-renderer.ts';

// Baseline: plain CommonMark with no GFM extensions, to quantify what GFM adds.
const parser = new Parser();
const writer = new HtmlRenderer({ safe: false });

export default await defineRenderer({
	name: 'commonmark',
	render: markdown => writer.render(parser.parse(markdown)),
});
