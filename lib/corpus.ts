import fs from 'node:fs/promises';

export type Case = {
	/** Unique, filesystem-safe identifier (the `.md` filename without extension) */
	id: string;
	/** Category, taken from the containing directory (e.g. "commonmark") */
	category: string;
	/** The markdown snippet for this case */
	markdown: string;
};

const corpusDirectory = new URL('../corpus/', import.meta.url);

/**
 * Loads every case in the corpus. Each case is a single `<category>/<id>.md`
 * file, paired with its expected GitHub rendering at `<category>/<id>.html`.
 * Category is the containing directory; the markdown is trimmed so the input
 * matches exactly what was sent to the GitHub API.
 */
export const loadCases = async (): Promise<Case[]> => {
	const categories = (await fs.readdir(corpusDirectory, { withFileTypes: true }))
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name)
		.sort();

	// Read each category directory concurrently; keep category order stable.
	const perCategory = await Promise.all(
		categories.map(async (category) => {
			const categoryDirectory = new URL(`${category}/`, corpusDirectory);
			const files = (await fs.readdir(categoryDirectory))
				.filter(file => file.endsWith('.md'))
				.sort();
			return files.map(file => ({
				id: file.replace(/\.md$/, ''),
				category,
				fileUrl: new URL(file, categoryDirectory),
			}));
		}),
	);

	const entries = perCategory.flat();

	// ids must be globally unique (they're snapshot keys and file paths). Check
	// over the deterministically ordered list so the error is reproducible.
	const seen = new Set<string>();
	for (const { id } of entries) {
		if (seen.has(id)) {
			throw new Error(`Duplicate case id: "${id}"`);
		}
		seen.add(id);
	}

	// Read every markdown file concurrently; Promise.all preserves input order.
	return Promise.all(
		entries.map(async ({ id, category, fileUrl }): Promise<Case> => ({
			id,
			category,
			markdown: (await fs.readFile(fileUrl, 'utf8')).trim(),
		})),
	);
};
