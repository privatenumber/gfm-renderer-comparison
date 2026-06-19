import MarkdownIt from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';

import { defineRenderer } from '../define-renderer.ts';

// Tables + strikethrough are on by default; linkify covers GFM autolinks; task
// lists come from a plugin.
const md = MarkdownIt({
	html: true,
	linkify: true,
	typographer: false,
}).use(markdownItTaskLists);

export default await defineRenderer({
	name: 'markdown-it',
	render: markdown => md.render(markdown),
});
