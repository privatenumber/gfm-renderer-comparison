import { buildCrateAddon } from '../../crate-addon.ts';

await buildCrateAddon(import.meta.url, 'markdown_rs_node');
