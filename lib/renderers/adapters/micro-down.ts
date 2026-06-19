import microdown from 'micro-down';

import { defineRenderer } from '../define-renderer.ts';

// ~1.4kB; handles tables, autolinks, and strikethrough.
export default await defineRenderer({
	name: 'micro-down',
	render: markdown => microdown.parse(markdown),
});
