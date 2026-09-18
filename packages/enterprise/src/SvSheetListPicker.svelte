<script lang="ts">
  /**
   * The list a validated cell drops down: Excel's in-cell dropdown. The
   * choices as the rule lists them, the current value marked, arrow keys
   * and Enter to pick, Escape to leave the cell as it is. The shell mounts
   * it inside the popover anchored to the cell.
   */
  import { useSheetText } from './sheet-text'
  type Props = {
    choices: ReadonlyArray<string>
    /** The cell's current text, marked in the list. */
    value: string
    onPick: (choice: string) => void
    onCancel: () => void
  }

  let { choices, value, onPick, onCancel }: Props = $props()
  const t = useSheetText()

  let list = $state<HTMLDivElement | null>(null)
  let index = $state(0)

  $effect(() => {
    const at = choices.findIndex((c) => c.toLowerCase() === value.trim().toLowerCase())
    index = at >= 0 ? at : 0
    queueMicrotask(() => list?.focus())
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); index = Math.min(index + 1, choices.length - 1); scrollTo() }
    else if (event.key === 'ArrowUp') { event.preventDefault(); index = Math.max(index - 1, 0); scrollTo() }
    else if (event.key === 'Home') { event.preventDefault(); index = 0; scrollTo() }
    else if (event.key === 'End') { event.preventDefault(); index = choices.length - 1; scrollTo() }
    else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); const c = choices[index]; if (c !== undefined) onPick(c) }
    else if (event.key === 'Escape') { event.preventDefault(); onCancel() }
  }

  function scrollTo() {
    list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }
</script>

<div
  bind:this={list}
  class="sv-sheet-list-picker"
  role="listbox"
  aria-label={t('choices')}
  tabindex="0"
  aria-activedescendant={choices.length ? `sv-sheet-choice-${index}` : undefined}
  onkeydown={onKeyDown}
>
  {#if choices.length === 0}
    <div class="empty">{t('listEmpty')}</div>
  {:else}
    {#each choices as choice, i (i)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
      <div
        id={`sv-sheet-choice-${i}`}
        class="choice"
        class:on={i === index}
        role="option"
        aria-selected={i === index}
        data-index={i}
        onpointermove={() => (index = i)}
        onclick={() => onPick(choice)}
      >{choice}</div>
    {/each}
  {/if}
</div>

<style>
  .sv-sheet-list-picker {
    min-width: 120px;
    max-width: 320px;
    max-height: 200px;
    overflow-y: auto;
    padding: 4px 0;
    font-size: 12px;
    color: var(--sg-fg, #242424);
    outline: none;
  }
  .choice {
    padding: 4px 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  .choice.on { background: var(--sg-selection-bg, rgba(16, 124, 65, 0.12)); }
  .empty { padding: 4px 10px; color: var(--sg-muted, #616161); }
</style>
