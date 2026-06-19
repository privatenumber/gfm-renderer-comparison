import { defineRenderer, type Renderer } from '../define-renderer.ts';

// GitHub's actual core engine (native). Optional: a dynamic import keeps the
// file loadable even when the native addon isn't installed/compiled.
let renderer: Renderer | null = null;

try {
	const cmark = (await import('cmark-gfm')).default;
	const options = {
		footnotes: true,
		unsafe: true,
		extensions: {
			table: true,
			strikethrough: true,
			autolink: true,
			tagfilter: true,
			tasklist: true,
		},
	};
	renderer = await defineRenderer({
		name: 'cmark-gfm',
		render: markdown => cmark.renderHtmlSync(markdown, options),
	});
} catch (error) {
	console.warn(`[renderers] cmark-gfm unavailable, skipping: ${(error as Error).message}`);
}

export default renderer;
