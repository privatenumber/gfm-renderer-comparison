import { buildCrateAddon } from '../../crate-addon.ts';

await buildCrateAddon(import.meta.url, 'comrak_node');
