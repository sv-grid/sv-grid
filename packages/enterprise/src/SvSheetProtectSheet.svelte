<script lang="ts">
  /**
   * Excel's Protect Sheet dialog, without the password: the "allow all
   * users of this worksheet to" list, each entry a kind of change that
   * stays open once the sheet is protected. OK protects with what is
   * ticked; the shell keeps the list per sheet, so Unprotect and Protect
   * again offer the same ticks.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { PROTECTION_PERMISSIONS, type ProtectionAllow, type ProtectionPermission } from './sheet/protection'

  type Props = {
    open?: boolean
    /** The sheet's list as it stands, what the ticks open on. */
    allow: ProtectionAllow
    onApply: (allow: ProtectionAllow) => void
    onClose?: () => void
  }

  let { open = $bindable(false), allow, onApply, onClose }: Props = $props()
  const t = useSheetText()

  let ticks = $state<Record<ProtectionPermission, boolean>>({} as Record<ProtectionPermission, boolean>)
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    const next = {} as Record<ProtectionPermission, boolean>
    for (const key of PROTECTION_PERMISSIONS) next[key] = Boolean(allow[key])
    ticks = next
    queueMicrotask(() => first?.focus())
  })

  function ok() {
    const next: ProtectionAllow = {}
    for (const key of PROTECTION_PERMISSIONS) if (ticks[key]) next[key] = true
    open = false
    onApply(next)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('protectSheet.title')} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="lead">{t('protectSheet.lead')}</div>
    <div class="checks column" role="group" aria-label={t('protectSheet.lead')}>
      {#each PROTECTION_PERMISSIONS as key, i (key)}
        <label class="check">
          {#if i === 0}
            <input bind:this={first} type="checkbox" bind:checked={ticks[key]} />
          {:else}
            <input type="checkbox" bind:checked={ticks[key]} />
          {/if}
          {t(`protectSheet.${key}`)}
        </label>
      {/each}
    </div>
    <p class="hint">{t('protectSheet.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .checks.column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }
</style>
