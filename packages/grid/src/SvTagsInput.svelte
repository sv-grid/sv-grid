<script lang="ts">
  /**
   * SvTagsInput - editable token/chips input. Type + Enter/comma to add,
   * Backspace to remove the last, click × to remove a chip. Parity: Smart
   * `smart-tags` / `smart-input` token mode. Emits string[].
   *
   * One styled renderer over the headless `createTagsInput` core (draft +
   * add/remove + keyboard).
   */
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createTagsInput } from './createTagsInput.svelte'

  /** User-facing strings (localizable via `messages`). */
  type TagsMessages = { add: string; remove: string }
  const DEFAULT_MESSAGES: TagsMessages = { add: 'Add tag', remove: 'Remove' }

  type Props = SvEditorProps & {
    value?: string[]
    onChange?: (tags: string[]) => void
    placeholder?: string
    /** Reject duplicate tags. Default true. */
    unique?: boolean
    max?: number
    /** Override the built-in strings (draft + remove aria-labels). */
    messages?: Partial<TagsMessages>
  }

  let {
    value = $bindable<string[]>([]),
    onChange,
    placeholder = 'Add tag…',
    disabled = false,
    unique = true,
    max = Infinity,
    size = 'md',
    name,
    ariaLabel,
    block = false,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-tags')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const ti = createTagsInput({
    value: () => value,
    // Write `value` (so `bind:value` works) AND fire `onChange` (callback users).
    onChange: (t) => { value = t; onChange?.(t) },
    disabled: () => disabled,
    unique: () => unique,
    max: () => max,
    ariaLabel: () => ariaLabel,
    addLabel: () => M.add,
    removeLabel: () => M.remove,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-tags sv-tags--{size}" class:is-block={block} class:is-disabled={disabled} class:is-invalid={invalid} {...ti.rootProps()}>
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
</SvField>

<style>
  .sv-tags {
    --_accent: var(--sg-accent, #2563eb);
    --_minh: 34px; --_chip-h: 22px; --_fs: 13px;
    display: flex; flex-wrap: wrap; gap: 5px; align-items: center; width: 280px; min-height: var(--_minh); padding: 4px 6px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-tags--sm { --_minh: 28px; --_chip-h: 19px; --_fs: 12px; }
  .sv-tags--lg { --_minh: 40px; --_chip-h: 26px; --_fs: 15px; }
  .sv-tags:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-tags.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-tags.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-tags.is-disabled { opacity: 0.6; }
  .sv-tags__chip {
    display: inline-flex; align-items: center; gap: 4px; height: var(--_chip-h); padding-block: 0; padding-inline: 8px 4px;
    background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent);
    border-radius: 5px; font-size: calc(var(--_fs) - 1px); font-weight: 600;
  }
  .sv-tags__x { background: none; border: 0; color: inherit; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; opacity: 0.7; }
  .sv-tags__x:hover { opacity: 1; }
  .sv-tags__input { flex: 1; min-width: 80px; border: 0; background: none; outline: none; color: inherit; font: inherit; font-size: var(--_fs); height: 24px; }
  /* Fill the container - see `block` in SvEditorProps. */
  .sv-tags.is-block { width: 100%; max-width: 100%; }
</style>
