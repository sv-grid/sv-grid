<script lang="ts">
  /**
   * The comment editor: Excel's note box, opened by New Comment, Edit
   * Comment, Shift+F2 and the cell menu. A textarea over the text, Save,
   * and Delete when there is something to delete. As in Excel the text is
   * kept whatever closes the box: Escape and a click elsewhere save what
   * was typed, which is why every keystroke is reported through `onDraft`
   * and the shell saves the draft on dismissal. Ctrl+Enter saves too.
   * The shell mounts it inside the popover anchored to the cell.
   */
  type Props = {
    /** The comment as it is, empty for a new one. */
    text: string
    /** A1 of the cell, for the heading. */
    address: string
    /** Every change of the text, so the shell can keep it on dismissal. */
    onDraft: (text: string) => void
    onSave: (text: string) => void
    onDelete: () => void
  }

  let { text, address, onDraft, onSave, onDelete }: Props = $props()

  let draft = $state('')
  let box = $state<HTMLTextAreaElement | null>(null)

  $effect(() => {
    draft = text
    queueMicrotask(() => {
      if (!box) return
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
    })
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onSave(draft) }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sv-sheet-comment" role="dialog" aria-label="Comment on {address}" onkeydown={onKeyDown}>
  <div class="head">{address}</div>
  <textarea
    bind:this={box}
    bind:value={draft}
    oninput={() => onDraft(draft)}
    rows="4"
    aria-label="Comment"
    placeholder="Type a comment"
    spellcheck="false"
  ></textarea>
  <div class="sv-sheet-dialog-buttons">
    <span class="keys">Ctrl+Enter saves</span>
    <button type="button" class="btn primary" onclick={() => onSave(draft)}>Save</button>
    {#if text}
      <button type="button" class="btn" onclick={onDelete}>Delete</button>
    {/if}
  </div>
</div>

<style>
  .sv-sheet-comment {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 260px;
    padding: 8px;
    font-size: 12px;
    color: var(--sg-fg, #242424);
  }
  .head {
    font-weight: 600;
    color: var(--sg-muted, #616161);
  }
  .keys {
    margin-right: auto;
    font-size: 11px;
    color: var(--sg-muted, #616161);
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 64px;
    padding: 6px 8px;
    font: inherit;
    line-height: 1.4;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  textarea:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -1px;
  }
</style>
