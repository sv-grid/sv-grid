<script lang="ts">
  /**
   * Excel's Column Width and Row Height boxes: one number, OK, Cancel. The
   * shell opens it from the column letter's and the row number's menus and
   * applies the size to every column or row the selection spans.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'

  type Props = {
    open?: boolean
    title: string
    label: string
    value: number
    onApply: (px: number) => void
    onClose?: () => void
  }

  let { open = $bindable(false), title, label, value, onApply, onClose }: Props = $props()
  const t = useSheetText()

  let draft = $state('')
  let input = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    draft = String(Math.round(value))
    queueMicrotask(() => { input?.focus(); input?.select() })
  })

  const px = $derived(Number(draft))
  const valid = $derived(Number.isFinite(px) && px >= 4 && px <= 2000)

  function ok() {
    if (!valid) return
    onApply(Math.round(px))
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} {title} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field auto">
      <span>{label}</span>
      <input bind:this={input} type="number" min="4" max="2000" bind:value={draft} />
    </label>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!valid}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>
