<script lang="ts">
  /**
   * The box Excel shows when an entry breaks a validation rule. Stop: the
   * message, Retry (the cell reopens with the entry) and Cancel. Warning:
   * the message, "Continue?", Yes (the entry lands anyway), No (retry) and
   * Cancel. Enter takes the first button, Escape cancels.
   */
  import { SvModal } from '@svgrid/grid'

  type Props = {
    open?: boolean
    alert: { style: 'stop' | 'warning'; title: string; message: string } | null
    onRetry: () => void
    /** Warning only: keep the entry. */
    onAccept: () => void
    onCancel: () => void
  }

  let { open = $bindable(false), alert, onRetry, onAccept, onCancel }: Props = $props()
  let first = $state<HTMLButtonElement | null>(null)

  $effect(() => {
    if (!open) return
    queueMicrotask(() => first?.focus())
  })

  function done(fn: () => void) {
    open = false
    fn()
  }
</script>

<SvModal bind:open onClose={onCancel} title={alert?.title ?? 'Data validation'} size="sm">
  <div class="sv-sheet-dialog alert" role="alertdialog" aria-describedby="sv-sheet-validation-message">
    <span class="mark" class:warning={alert?.style === 'warning'} aria-hidden="true">{alert?.style === 'warning' ? '!' : '×'}</span>
    <div>
      <p id="sv-sheet-validation-message" class="message">{alert?.message}</p>
      {#if alert?.style === 'warning'}<p class="message">Continue?</p>{/if}
    </div>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      {#if alert?.style === 'warning'}
        <button bind:this={first} type="button" class="btn primary" onclick={() => done(onAccept)}>Yes</button>
        <button type="button" class="btn" onclick={() => done(onRetry)}>No</button>
      {:else}
        <button bind:this={first} type="button" class="btn primary" onclick={() => done(onRetry)}>Retry</button>
      {/if}
      <button type="button" class="btn" onclick={() => done(onCancel)}>Cancel</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .alert {
    flex-direction: row;
    align-items: flex-start;
    gap: 14px;
    min-width: 300px;
    max-width: 420px;
  }
  .mark {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-danger, #c42b1c);
    border-radius: 50%;
  }
  .mark.warning {
    color: #242424;
    background: var(--sg-warning, #f2c811);
  }
  .message {
    margin: 0 0 6px;
    white-space: pre-wrap;
  }
</style>
