<script lang="ts">
  /**
   * SvTagsInput - editable token/chips input. Type + Enter/comma to add,
   * Backspace to remove the last, click × to remove a chip. Parity: Smart
   * `smart-tags` / `smart-input` token mode. Emits string[].
   */
  type Props = {
    value?: string[]
    onChange?: (tags: string[]) => void
    placeholder?: string
    disabled?: boolean
    /** Reject duplicate tags. Default true. */
    unique?: boolean
    max?: number
    name?: string
    ariaLabel?: string
  }

  let { value = [], onChange, placeholder = 'Add tag…', disabled = false, unique = true, max = Infinity, name, ariaLabel }: Props = $props()

  let draft = $state('')

  function add(raw: string) {
    const tag = raw.trim()
    if (!tag || disabled) return
    if (value.length >= max) return
    if (unique && value.includes(tag)) { draft = ''; return }
    onChange?.([...value, tag])
    draft = ''
  }
  function removeAt(i: number) {
    if (disabled) return
    onChange?.(value.filter((_, idx) => idx !== i))
  }
  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
    else if (e.key === 'Backspace' && draft === '' && value.length) { removeAt(value.length - 1) }
  }
</script>

<div class="sv-tags" class:is-disabled={disabled} role="group" aria-label={ariaLabel}>
  {#each value as tag, i (tag + i)}
    <span class="sv-tags__chip">
      <span class="sv-tags__label">{tag}</span>
      {#if !disabled}
        <button type="button" class="sv-tags__x" aria-label={`Remove ${tag}`} onclick={() => removeAt(i)}>&times;</button>
      {/if}
    </span>
  {/each}
  <input
    class="sv-tags__input"
    type="text"
    bind:value={draft}
    placeholder={value.length ? '' : placeholder}
    {disabled}
    aria-label={ariaLabel ?? 'Add tag'}
    onkeydown={onKeydown}
    onblur={() => add(draft)}
  />
  {#if name}<input type="hidden" {name} value={value.join(',')} />{/if}
</div>

<style>
  .sv-tags {
    --_accent: var(--sg-accent, #2563eb);
    display: flex; flex-wrap: wrap; gap: 5px; align-items: center; width: 280px; min-height: 34px; padding: 4px 6px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-tags:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-tags.is-disabled { opacity: 0.6; }
  .sv-tags__chip {
    display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 4px 0 8px;
    background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent);
    border-radius: 5px; font-size: 12px; font-weight: 600;
  }
  .sv-tags__x { background: none; border: 0; color: inherit; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; opacity: 0.7; }
  .sv-tags__x:hover { opacity: 1; }
  .sv-tags__input { flex: 1; min-width: 80px; border: 0; background: none; outline: none; color: inherit; font: inherit; font-size: 13px; height: 24px; }
</style>
