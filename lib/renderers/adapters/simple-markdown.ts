import simpleMarkdownModule from '@khanacademy/simple-markdown';

import { defineRenderer } from '../define-renderer.ts';

// Khan Academy / Discord lineage; tables + autolinks. Ships CJS with the API
// under `.default`.
const simpleMarkdown = simpleMarkdownModule.default;

export default await defineRenderer({
	name: 'simple-markdown',
	packageName: '@khanacademy/simple-markdown',
	render: markdown => simpleMarkdown.defaultHtmlOutput(simpleMarkdown.defaultBlockParse(markdown)),
});
