/**
 * createCommand - the HEADLESS core behind <SvCommand> (the ⌘K palette): the
 * fuzzy-filtered result list, roving active index, run/close, the global toggle
 * hotkey, and the WAI-ARIA combobox wiring (activedescendant) - as prop-getters
 * you spread onto your own input/list/option markup. The overlay lifecycle
 * (focus-trap + scroll-lock + dismissal) is a separate concern; pair this with
 * `createOverlay`. Runes-based, like `createListbox`.
 */
import type { CommandItem } from './ui-app.types'
import { fuzzyScore } from './fuzzy'
import { nextEditorId } from './editor-contract'

export type CommandConfig = {
  commands: () => ReadonlyArray<CommandItem>
  /** Whether the palette is open (used to reset query/active on open). */
  open: () => boolean
  onRun?: (cmd: CommandItem) => void
  /** Close the palette (a command ran, or requested by the input). */
  onClose?: () => void
  /** Toggle open/closed - fired by the global hotkey. */
  onToggleOpen?: () => void
  /** Global toggle hotkey (Cmd/Ctrl + key). `false` disables it. Default 'mod+k'. */
  hotkey?: () => 'mod+k' | 'mod+p' | false
  /** DOM hook to scroll the newly-active option into view. */
  scrollActiveIntoView?: (index: number) => void
}

export function createCommand(config: CommandConfig) {
  const id = nextEditorId('sv-cmd')
  const listId = `${id}-list`
  const optionId = (i: number) => `${id}-opt-${i}`

  let query = $state('')
  let active = $state(0)

  const results = $derived.by(() => {
    const q = query.trim()
    const list = config.commands().filter((c) => !c.disabled)
    if (!q) return list
    return list
      .map((c) => ({ c, s: fuzzyScore(`${c.label} ${c.keywords ?? ''} ${c.group ?? ''}`, q) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (b.s as number) - (a.s as number))
      .map((x) => x.c)
  })

  function run(cmd: CommandItem | undefined) {
    if (!cmd || cmd.disabled) return
    config.onClose?.()
    config.onRun?.(cmd)
    cmd.onRun?.()
  }
  function move(delta: number) {
    const n = results.length
    if (!n) return
    active = (active + delta + n) % n
    config.scrollActiveIntoView?.(active)
  }
  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
    // Escape + outside-click are owned by the overlay/dismissable layer.
  }

  // Reset the active row as the query changes.
  $effect(() => { void query; active = 0 })
  // Reset query + active each time the palette opens.
  $effect(() => { if (config.open()) { query = ''; active = 0 } })
  // Global toggle hotkey.
  $effect(() => {
    const hk = config.hotkey?.() ?? 'mod+k'
    if (!hk) return
    const key = hk === 'mod+p' ? 'p' : 'k'
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault()
        config.onToggleOpen?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return {
    get query() { return query },
    set query(v: string) { query = v },
    get active() { return active },
    get results() { return results },
    isActive: (i: number) => i === active,
    move,
    run,
    /** Arrow/Enter handler - attach to the panel (catches events bubbled from the
     *  input) so keys work whether dispatched on the input or the dialog. */
    onKeydown: onInputKeydown,
    /** Id of the list element (for aria-controls). */
    listId,
    /** Id of the option at `i` (for aria-activedescendant + item id). */
    optionId,
    /** Spread onto the search `<input>`. */
    inputProps: () => ({
      role: 'combobox' as const,
      'aria-expanded': true as const,
      'aria-controls': listId,
      'aria-activedescendant': results[active] ? optionId(active) : undefined,
      value: query,
      oninput: (e: Event) => { query = (e.currentTarget as HTMLInputElement).value },
      // Arrow/Enter is handled on the panel (see `onKeydown`) via bubbling, so it
      // works for both input-dispatched and panel-dispatched key events.
    }),
    /** Spread onto the `<ul>` list. */
    listProps: () => ({ id: listId, role: 'listbox' as const }),
    /** Spread onto the option element at `i`. */
    optionProps: (i: number) => ({
      id: optionId(i),
      'data-idx': i,
      role: 'option' as const,
      'aria-selected': i === active,
      onpointermove: () => { active = i },
      onclick: () => run(results[i]),
    }),
  }
}

export type Command = ReturnType<typeof createCommand>
