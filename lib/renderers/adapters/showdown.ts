import showdown from 'showdown';

import { defineRenderer } from '../define-renderer.ts';

// showdown's own "github" flavor is its closest preset.
const converter = new showdown.Converter();
converter.setFlavor('github');

export default await defineRenderer({
	name: 'showdown',
	render: markdown => converter.makeHtml(markdown),
});
