// Minimal types for the `markdown-it-task-lists` plugin (ships none).
declare module 'markdown-it-task-lists' {
	/** A markdown-it plugin, applied via `md.use(taskLists)`. */
	const taskLists: (md: unknown, options?: object) => void;
	export default taskLists;
}
