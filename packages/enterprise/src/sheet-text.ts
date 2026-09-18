/**
 * How the shell's strings reach every part of it. `SvSheet` provides the
 * resolved map through Svelte context once; the ribbon, the tab strip, the
 * formula bar and each dialog ask for `t` and read their strings through
 * it. A part mounted on its own, outside a shell, gets the English
 * defaults, so nothing needs a prop it did not have before.
 */
import { getContext, setContext } from 'svelte'
import { defaultSheetMessages, formatMessage, type SheetMessages } from './sheet/messages'

const KEY = Symbol.for('sv-sheet-text')

/** A string by key, with its `{placeholders}` filled. */
export type SheetText = (key: string, vars?: Record<string, string | number>) => string

/** Called by the shell: `get` reads its resolved map, so a change to the
 *  `localization` prop reaches every reader. */
export function provideSheetText(get: () => SheetMessages): void {
  setContext(KEY, get)
}

export function useSheetText(): SheetText {
  let get: (() => SheetMessages) | undefined
  try {
    get = getContext<() => SheetMessages>(KEY)
  } catch {
    get = undefined
  }
  return (key, vars) => {
    const map = get ? get() : defaultSheetMessages
    const text = map[key] ?? defaultSheetMessages[key] ?? key
    return formatMessage(text, vars)
  }
}
