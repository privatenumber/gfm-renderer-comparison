import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

import { defineRenderer } from '../define-renderer.ts';

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeStringify, { allowDangerousHtml: true });

export default await defineRenderer({
	name: 'remark-rehype',
	packageName: 'remark-gfm',
	render: markdown => processor.processSync(markdown).toString(),
});
