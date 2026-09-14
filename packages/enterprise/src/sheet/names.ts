/**
 * Defined names: `Tax` resolving to `Sheet1!$B$1`, so a formula can say
 * `=Subtotal*Tax` instead of `=D5*$B$1`.
 *
 * Names are stored as the TEXT they refer to rather than a parsed reference,
 * because that is what the user typed and what round-trips to xlsx. Resolution
 * parses on demand and caches nothing: names change rarely and resolving is
 * cheap next to evaluating the formula that asked.
 */
import { parseFormula } from './parse'
import type { Node } from './ast'

export type DefinedName = {
  name: string
  /** What it refers to, e.g. `=Sheet1!$B$1` or `=$A$1:$C$9`. */
  refersTo: string
}

export type SheetNames = {
  define(name: string, refersTo: string): void
  remove(name: string): void
  has(name: string): boolean
  /** The parsed reference behind a name, or null when undefined or unparseable. */
  resolve(name: string): Node | null
  list(): DefinedName[]
  serialize(): Record<string, string>
  hydrate(entries: Record<string, string>): void
  clear(): void
}

/**
 * Excel's rules, and the ones worth enforcing because a name that looks like a
 * reference makes every formula containing it ambiguous:
 *   - starts with a letter or underscore
 *   - letters, digits, underscores and dots after that
 *   - not something that reads as a CELL reference (`A1`, `$A$1`)
 *   - not `R` or `C`, which Excel reserves for R1C1 notation
 *
 * A bare word like `Tax` is fine even though `TAX` is a valid column label:
 * the tokenizer only reads a word as a column when it is qualified by a sheet
 * or followed by a colon, so `=Tax` is never ambiguous.
 */
export function isValidName(name: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return false
  if (name.length > 255) return false
  // Letters followed by digits is a cell reference, whatever else it spells.
  if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(name)) return false
  if (/^[RC]$/i.test(name)) return false
  if (/^(TRUE|FALSE)$/i.test(name)) return false
  return true
}

export function createNames(initial?: Record<string, string>): SheetNames {
  // Names are case-insensitive in Excel but keep the case they were defined
  // with, so the map keys on the uppercase form and the entry holds the
  // original.
  const byUpper = new Map<string, DefinedName>()

  const api: SheetNames = {
    define(name, refersTo) {
      if (!isValidName(name)) {
        throw new Error(
          `"${name}" is not a valid defined name: it must start with a letter ` +
          'or underscore and must not look like a cell reference.',
        )
      }
      byUpper.set(name.toUpperCase(), { name, refersTo })
    },

    remove(name) {
      byUpper.delete(name.toUpperCase())
    },

    has(name) {
      return byUpper.has(name.toUpperCase())
    },

    resolve(name) {
      const entry = byUpper.get(name.toUpperCase())
      if (!entry) return null
      try {
        return parseFormula(entry.refersTo)
      } catch {
        return null
      }
    },

    list() {
      return [...byUpper.values()].sort((a, b) => a.name.localeCompare(b.name))
    },

    serialize() {
      return Object.fromEntries([...byUpper.values()].map((e) => [e.name, e.refersTo]))
    },

    hydrate(entries) {
      byUpper.clear()
      for (const [name, refersTo] of Object.entries(entries)) {
        if (isValidName(name)) byUpper.set(name.toUpperCase(), { name, refersTo })
      }
    },

    clear() {
      byUpper.clear()
    },
  }

  if (initial) api.hydrate(initial)
  return api
}
