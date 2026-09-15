<script lang="ts">
  /**
   * Excel's Paste Special: what to paste (everything, values, formulas or
   * formats), an operation to combine the pasted numbers with what is there,
   * and whether to skip blanks or transpose. The shell keeps what Ctrl+C
   * took and applies the choice through `planPaste` / `resolvePasteCell`;
   * this component only asks the question.
   */
  import { SvModal } from '@svgrid/grid'
  import type { PasteSpecialOptions, PasteWhat, PasteOperation } from './sheet/paste-special'

  type Props = {
    open?: boolean
    /** Whether the sheet has anything to paste; Excel greys the whole
     *  dialog out without a copy, this one says so. */
    hasClipboard: boolean
    onPaste: (options: PasteSpecialOptions) => void
    onClose?: () => void
  }

  let { open = $bindable(false), hasClipboard, onPaste, onClose }: Props = $props()

  let what = $state<PasteWhat>('all')
  let operation = $state<PasteOperation>('none')
  let skipBlanks = $state(false)
  let transpose = $state(false)

  const WHAT: ReadonlyArray<{ value: PasteWhat; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'formulas', label: 'Formulas' },
    { value: 'values', label: 'Values' },
    { value: 'formats', label: 'Formats' },
  ]
  const OPERATIONS: ReadonlyArray<{ value: PasteOperation; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'add', label: 'Add' },
    { value: 'subtract', label: 'Subtract' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'divide', label: 'Divide' },
  ]

  function ok() {
    onPaste({ what, operation, skipBlanks, transpose })
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title="Paste Special" size="sm">
  <div class="sv-sheet-dialog" role="group" aria-label="Paste Special">
    {#if !hasClipboard}
      <p class="status">Nothing has been copied from the sheet yet. Copy a range first, then Paste Special.</p>
    {/if}
    <div class="columns">
      <fieldset class="group">
        <legend>Paste</legend>
        {#each WHAT as choice (choice.value)}
          <label class="check"><input type="radio" name="sheet-paste-what" value={choice.value} bind:group={what} /> {choice.label}</label>
        {/each}
      </fieldset>
      <fieldset class="group">
        <legend>Operation</legend>
        {#each OPERATIONS as choice (choice.value)}
          <label class="check"><input type="radio" name="sheet-paste-op" value={choice.value} bind:group={operation} /> {choice.label}</label>
        {/each}
      </fieldset>
    </div>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={skipBlanks} /> Skip blanks</label>
      <label class="check"><input type="checkbox" bind:checked={transpose} /> Transpose</label>
    </div>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!hasClipboard}>OK</button>
      <button type="button" class="btn" onclick={close}>Cancel</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 6px 10px 8px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  .group legend {
    padding: 0 4px;
    font-weight: 600;
  }
</style>
