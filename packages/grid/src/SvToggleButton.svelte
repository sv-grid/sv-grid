<script lang="ts">
  /**
   * SvToggleButton - a button with a pressed on/off state (aria-pressed).
   * Parity: Smart `smart-toggle-button`. Controlled via `pressed` + `onChange`.
   */
  import type { Snippet } from 'svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createToggle } from './createToggle.svelte'

  type Props = SvEditorProps & {
    pressed?: boolean
    onChange?: (pressed: boolean) => void
    children?: Snippet
  }

  let {
    pressed = false,
    onChange,
    disabled = false,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    children,
  }: Props = $props()

  const autoId = nextEditorId('sv-toggle')
  const uid = $derived(id ?? autoId)

  // The styled toggle is just a renderer over the headless core.
  const t = createToggle({
    pressed: () => pressed,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <button
    class="sv-toggle sv-toggle--{size}"
    class:is-pressed={pressed}
    class:is-invalid={invalid}
    {...t.buttonProps()}
  >
    {#if children}{@render children()}{/if}
  </button>
</SvField>

<style>
  .sv-toggle {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-border, #cbd5e1);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font: inherit; font-weight: 600; line-height: 1;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--_border); border-radius: var(--_radius); cursor: pointer; user-select: none;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .sv-toggle--sm { padding: 5px 10px; font-size: 12px; }
  .sv-toggle--md { padding: 8px 13px; font-size: 13px; }
  .sv-toggle--lg { padding: 11px 17px; font-size: 15px; }
  .sv-toggle:hover:not([disabled]):not(.is-pressed) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-toggle.is-pressed {
    background: var(--_accent); color: var(--sg-on-accent, #fff); border-color: var(--_accent);
  }
  .sv-toggle[disabled] { opacity: 0.55; cursor: not-allowed; }
  .sv-toggle.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-toggle:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
