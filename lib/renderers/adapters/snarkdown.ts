import snarkdown from 'snarkdown';

import { defineRenderer } from '../define-renderer.ts';

// ~1kB; emphasis/strikethrough but no tables or task lists.
export default await defineRenderer({
	name: 'snarkdown',
	render: snarkdown,
});
