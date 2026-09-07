/**
 * Which version of SvGrid the person asking actually has installed.
 *
 * This is the thing a proxy-shaped MCP server cannot do. Telerik and Syncfusion
 * answer every question from a backend that serves one global "latest" - their
 * server has no idea what is in your `node_modules`, so a model can be told
 * about an API you do not have, confidently and with a citation.
 *
 * We ship the corpus, so we can do better: read the consumer's installed grid
 * and say plainly when it disagrees with what this corpus describes. A warning
 * that the answer may not apply is worth far more than a confident wrong one.
 *
 * Absent is the normal case, not an error - the server is often run from a
 * directory that has no SvGrid in it at all (a fresh project, a chat with no
 * workspace). Say nothing then rather than inventing a mismatch.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

export type InstalledGrid = {
  version: string
  /** Where it was found, so a surprising answer can be traced. */
  path: string
}

let cached: InstalledGrid | null | undefined

/**
 * Walk up from `from` looking for `node_modules/@svgrid/grid/package.json`.
 *
 * Nearest-first, and it stops at the first hit: a monorepo can legitimately
 * hold several copies, and guessing which one the user means would produce
 * confident nonsense. The nearest one to the working directory is the one a
 * build would resolve.
 */
export function findInstalledGrid(from: string = process.cwd()): InstalledGrid | null {
  let dir = from
  const { root } = parse(dir)
  for (;;) {
    const manifest = join(dir, 'node_modules', '@svgrid', 'grid', 'package.json')
    if (existsSync(manifest)) {
      try {
        const version = (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version
        if (typeof version === 'string' && version) return { version, path: manifest }
      } catch {
        // An unreadable manifest is the same as not finding one: this is a
        // courtesy check, and it must never be the reason a tool call fails.
      }
      return null
    }
    if (dir === root) return null
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Cached lookup. The filesystem does not change under a running server. */
export function installedGrid(): InstalledGrid | null {
  if (cached === undefined) cached = findInstalledGrid()
  return cached
}

/** Test seam: forget what was found, so a test can point at another tree. */
export function resetInstalledGrid(next?: InstalledGrid | null): void {
  cached = next
}

export type VersionNote = {
  /** The version this server's corpus and API surface describe. */
  corpus: string
  /** What is actually installed where the server is running, if anything. */
  installed?: string
  /** Present only when they disagree - the part a model must not ignore. */
  warning?: string
}

/**
 * How to describe the corpus/installed pairing in a tool result.
 *
 * Silent when they match or when nothing is installed. A note that fires
 * constantly is a note that gets skipped.
 */
export function versionNote(corpusVersion: string): VersionNote | undefined {
  const found = installedGrid()
  // Nothing installed means nothing to add: the check result already carries
  // `checkedAgainst` and says the version in its summary, so a bare
  // `{ corpus }` would be the same fact a third time. A field that is usually
  // redundant is a field that gets skipped when it finally matters.
  if (!found) return undefined
  if (found.version === corpusVersion) {
    return { corpus: corpusVersion, installed: found.version }
  }
  return {
    corpus: corpusVersion,
    installed: found.version,
    warning:
      `This server describes @svgrid/grid@${corpusVersion}, but ${found.version} is installed ` +
      `here. Treat anything version-specific as unverified for your version, and say so rather ` +
      `than asserting it.`,
  }
}
