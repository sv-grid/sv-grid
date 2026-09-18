<script lang="ts">
  /**
   * Excel's Insert Hyperlink dialog, as the three fields that matter: where
   * it goes, what the cell says, and what hovering says. Opened by
   * Insert > Link or Ctrl+K, and again on a cell that already has one,
   * which is how a link is edited.
   */
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { parseLinkTarget, type SheetLink } from './sheet/links'

  type Props = {
    open?: boolean
    /** The link as it stands, or a blank one for a cell that has none. */
    link: SheetLink
    /** What the cell shows right now, offered as the text. */
    text: string
    /** The cell's address, for the title. */
    where: string
    existing?: boolean
    onApply: (link: SheetLink, text: string) => void
    onRemove?: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), link, text, where, existing = false, onApply, onRemove, onClose }: Props = $props()
  const t = useSheetText()

  let address = $state('')
  let label = $state('')
  let tip = $state('')
  let error = $state('')
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    address = link.target
    label = text
    tip = link.tip ?? ''
    error = ''
    queueMicrotask(() => first?.focus())
  })

  function ok() {
    const target = parseLinkTarget(address)
    if (!target) { error = t('link.badAddress'); return }
    const next: SheetLink = { target: address.trim() }
    if (tip.trim()) next.tip = tip.trim()
    open = false
    onApply(next, label)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={`${t('link.title')} – ${where}`} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field">
      <span>{t('link.address')}</span>
      <input type="text" bind:this={first} bind:value={address} spellcheck="false" placeholder={t('link.addressPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('link.text')}</span>
      <input type="text" bind:value={label} placeholder={t('link.textPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('link.tip')}</span>
      <input type="text" bind:value={tip} placeholder={t('link.tipPlaceholder')} />
    </label>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="hint">{t('link.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      {#if existing && onRemove}
        <button type="button" class="btn" onclick={() => { open = false; onRemove?.() }}>{t('link.remove')}</button>
      {/if}
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
  .error { margin: 4px 0 0; color: var(--sg-danger, #c42b1c); font-size: 12px; }
</style>
