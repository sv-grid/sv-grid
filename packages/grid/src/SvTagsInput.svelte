<script lang="ts">
  /**
   * SvTagsInput - editable token/chips input. Type + Enter/comma to add,
   * Backspace to remove the last, click × to remove a chip. Parity: Smart
   * `smart-tags` / `smart-input` token mode. Emits string[].
   *
   * One styled renderer over the headless `createTagsInput` core (draft +
   * add/remove + keyboard).
   */
  import { createTagsInput } from './createTagsInput.svelte'

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

  const ti = createTagsInput({
    value: () => value,
    onChange: (t) => onChange?.(t),
    disabled: () => disabled,
    unique: () => unique,
    max: () => max,
    ariaLabel: () => ariaLabel,
  })
</script>

<div class="sv-tags" class:is-disabled={disabled} {...ti.rootProps()}>
  {#each value as tag, i (tag + i)}
    <span class="sv-tags__chip" {...ti.tagProps(i)}>
      <span class="sv-tags__label">{tag}</span>
      {#if !disabled}
        <button class="sv-tags__x" {...ti.removeProps(i)}>&times;</button>
      {/if}
    </span>
  {/each}
  <input
    class="sv-tags__input"
    placeholder={value.length ? '' : placeholder}
    {...ti.inputProps()}
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
