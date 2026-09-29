/**
 * Runnable doc snippets, for the course lessons.
 *
 * `tools/build-doc-snippets.mjs` extracts every ```svelte {runnable}``` block
 * in docs/**.md into `examples/src/doc-snippets/<id>.svelte` and Vite compiles
 * each one into a lazy chunk. The website mounts them on doc pages; the stage
 * mounts the same files so a lesson can show a file's source in the editor and
 * that file's compiled output beside it. Code and result cannot drift, because
 * they are the same file.
 *
 * The directory is generated and gitignored, so the glob can legitimately be
 * empty on a fresh checkout; run `node tools/build-doc-snippets.mjs` first.
 */
import type { Component } from 'svelte'

const FILES = import.meta.glob('../doc-snippets/*.svelte') as Record<
  string,
  () => Promise<{ default: Component<Record<string, never>> }>
>

const byId = new Map<string, () => Promise<{ default: Component<Record<string, never>> }>>()
for (const [path, load] of Object.entries(FILES)) {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.svelte$/, '')
  byId.set(id, load)
}

export function hasSnippet(id: string): boolean {
  return byId.has(id)
}

/** The ids on disk, for the error message when a lesson names a stale one. */
export function snippetIds(): string[] {
  return [...byId.keys()].sort()
}

export async function loadSnippet(id: string): Promise<Component<Record<string, never>>> {
  const load = byId.get(id)
  if (!load) {
    throw new Error(
      `no doc snippet "${id}". Run: node tools/build-doc-snippets.mjs. Available ids start with: ${snippetIds().slice(0, 3).join(', ')}`,
    )
  }
  return (await load()).default
}

/** The snippet's own source, so the editor scene can type the real file. */
const SOURCES = import.meta.glob('../doc-snippets/*.svelte', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

export async function snippetSource(id: string): Promise<string> {
  for (const [path, load] of Object.entries(SOURCES)) {
    if (path.endsWith(`/${id}.svelte`)) return load()
  }
  throw new Error(`no source for doc snippet "${id}"`)
}
