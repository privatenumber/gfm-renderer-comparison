# Contributing

## Prerequisites

- **Node.js 24+** — the source is TypeScript run directly via Node's native type stripping, so there's no build step for the project itself.
- **pnpm**

Optional, and only needed to build the compiled-engine renderers (see below):

- **A C compiler** (clang / Xcode Command Line Tools on macOS) — for `hoedown` and `cmark-gfm`.
- **Rust** (`cargo`) — for `pulldown-cmark`, `comrak`, and `markdown-rs`.

## Setup

```sh
pnpm install
```

`cmark-gfm` is an optional dependency; it compiles from vendored C on install (via node-gyp) when a C compiler is available, and is skipped otherwise.

## Optional native engines

Five renderers bind to compiled engines and are **opt-in**. Each is skipped at runtime if its addon isn't built, so the comparison still runs without them — but for the full set, build the ones you want:

| Renderer | Engine | Toolchain | Build |
| - | - | - | - |
| `pulldown-cmark` | Rust crate | Rust | `pnpm build:pulldown` |
| `comrak` | Rust crate | Rust | `pnpm build:comrak` |
| `markdown-rs` | Rust crate (`markdown`) | Rust | `pnpm build:markdown-rs` |
| `hoedown` | C (bundled) | C compiler | `pnpm build:hoedown` |
| `cmark-gfm` | C (vendored) | C compiler | built during `pnpm install` |

Each `build:*` compiles a small N-API addon to a gitignored `binding.node` beside its adapter.

## Workflow

- `pnpm fetch` — rebuild both ground-truth sets (the GitHub `/markdown` API outputs and the official GFM spec) plus per-renderer metadata. Needs a GitHub token via `gh auth token` or `GITHUB_TOKEN`. Sub-commands: `fetch:github`, `fetch:gfm-spec`, `fetch:meta`.
- `pnpm report` — regenerate the README's tables and stats (via [mdeval](https://github.com/privatenumber/mdeval); the prose is hand-written).
- `pnpm test` — run the [manten](https://github.com/privatenumber/manten) suites. Update snapshots with `MANTEN_UPDATE_SNAPSHOTS=1 pnpm test`.
- `pnpm type-check` — type-check the sources with `tsc` (no emit; Node runs the `.ts` directly).
- `pnpm diffs` — regenerate the per-renderer divergence diffs in `results/diffs/`.
- `pnpm render <file.md> [-r <renderer>]` — preview any renderer's HTML (`--open` for a styled browser preview, `--list` to list renderers).

## Adding a renderer

Drop an adapter into `lib/renderers/adapters/` — the loader discovers it automatically. Configure the engine as close to GitHub as its options allow: all GFM extensions on, raw HTML passed through, soft line breaks (no `<br>`), no smart punctuation.

- **Pure-JS / npm package:** a single file `<name>.ts` that default-exports `defineRenderer({ name, render })`.
- **Compiled engine (Rust crate or C):** a directory `<name>/` whose `index.ts` guards on `existsSync('binding.node')` and exports `null` when unbuilt (see `comrak/` or `hoedown/`), plus a `build.ts`. For Rust crates, pass `registry: 'crates'` and an explicit `version` to `defineRenderer`.

After adding one, run `MANTEN_UPDATE_SNAPSHOTS=1 pnpm test` (record snapshots), then `pnpm report` and `pnpm diffs` to refresh the generated artifacts.
