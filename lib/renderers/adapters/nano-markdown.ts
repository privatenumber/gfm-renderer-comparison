import nanomd from 'nano-markdown';

import { defineRenderer } from '../define-renderer.ts';

// Minimal converter; strikethrough only.
export default await defineRenderer({
	name: 'nano-markdown',
	render: nanomd,
});
