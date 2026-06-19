import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

import { defineRenderer } from '../define-renderer.ts';

// micromark follows the cmark-gfm reference parser closely.
export default await defineRenderer({
	name: 'micromark',
	render: markdown => micromark(markdown, {
		allowDangerousHtml: true,
		extensions: [gfm()],
		htmlExtensions: [gfmHtml()],
	}),
});
