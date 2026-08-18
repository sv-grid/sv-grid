<script lang="ts">
  /**
   * SvRating - a star rating control (WAI-ARIA slider). Parity: Smart
   * `smart-rating`. Hover preview, keyboard, optional half steps, readOnly.
   * Uses the grid's `--sg-rating-*` tokens so it matches the in-grid editor.
   */
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createRating } from './createRating.svelte'

  /** User-facing strings (localizable via `messages`). */
  type RatingMessages = { label: string; star: string; stars: string }
  const DEFAULT_MESSAGES: RatingMessages = { label: 'Rating', star: 'star', stars: 'stars' }

  type Props = SvEditorProps & {
    value?: number
    onChange?: (value: number) => void
    max?: number
    /** Allow half-star precision. */
    allowHalf?: boolean
    /** @deprecated use `readonly` - kept for back-compat. */
    readOnly?: boolean
    /** Override the built-in strings (group + per-star aria-labels). */
    messages?: Partial<RatingMessages>
  }

  let {
    value = 0,
    onChange,
    max = 5,
    allowHalf = false,
    readonly = false,
    readOnly = false,
    disabled = false,
    size = 'md',
    name,
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    messages,
  }: Props = $props()

  const ro = $derived(readonly || readOnly)
  const autoId = nextEditorId('sv-rating')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  // The styled rating is just a renderer over the headless core.
  const r = createRating({
    value: () => value,
    onChange: (v) => onChange?.(v),
    max: () => max,
    allowHalf: () => allowHalf,
    readonly: () => ro,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel ?? label ?? M.label,
    starLabel: (n) => `${n} ${n === 1 ? M.star : M.stars}`,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div
    class="sv-rating sv-rating--{size}"
    class:is-readonly={ro}
    class:is-disabled={disabled}
    {...r.rootProps()}
  >
    {#each Array(max) as _, i (i)}
      <button
        class="sv-rating__star is-{r.fillOf(i)}"
        {...r.starProps(i)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="half-{uid}-{i}"><stop offset="50%" stop-color="var(--_on)" /><stop offset="50%" stop-color="var(--_off)" /></linearGradient>
          </defs>
          <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.7l1.2-6.6L2.5 9.5l6.6-.9z"
            fill={r.fillOf(i) === 'full' ? 'var(--_on)' : r.fillOf(i) === 'half' ? `url(#half-${uid}-${i})` : 'var(--_off)'} />
        </svg>
      </button>
    {/each}
    {#if name}<input type="hidden" {name} value={value} />{/if}
  </div>
</SvField>

<style>
  .sv-rating {
    --_on: var(--sg-rating-on, #f59e0b);
    --_off: var(--sg-rating-empty, #cbd5e1);
    --_sz: 22px;
    display: inline-flex; gap: 2px; align-items: center;
  }
  .sv-rating--sm { --_sz: 16px; }
  .sv-rating--lg { --_sz: 30px; }
  .sv-rating.is-disabled { opacity: 0.5; }
  .sv-rating__star {
    width: var(--_sz); height: var(--_sz); padding: 0; border: 0; background: none; cursor: pointer; line-height: 0;
  }
  .sv-rating.is-readonly .sv-rating__star, .sv-rating.is-disabled .sv-rating__star { cursor: default; }
  .sv-rating__star svg { width: 100%; height: 100%; }
  .sv-rating:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 4px; }
</style>
