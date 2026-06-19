import { buildCrateAddon } from '../../crate-addon.ts';

await buildCrateAddon(import.meta.url, 'pulldown_cmark_node');
