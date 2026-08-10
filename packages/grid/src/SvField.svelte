<script lang="ts">
  /**
   * SvField - the shared field chrome for every value-bearing editor in the kit.
   * It renders an optional `label` (wired to the control via `for`/`id`), the
   * control itself (passed as children), and an optional `hint` / `error` line
   * whose ids match `editorHintId` / `editorErrorId` for `aria-describedby`.
   *
   * Two modes:
   *
   * 1. Default (`frame` unset) - SvField renders only the label / children / hint
   *    / error rows; the editor draws its own bordered control box. This is the
   *    original behavior and is byte-identical for every existing call site.
   *
   *    ```svelte
   *    <SvField {id} {label} {hint} {error} {required} {dir}>
   *      <div class="sv-num">...control...</div>
   *    </SvField>
   *    ```
   *
   * 2. Framed (`frame`) - SvField OWNS the bordered control box, so it applies
   *    `invalid` + `size` styling, the shared leading/trailing adornments and
   *    prefix/suffix affixes, and the shared clear button ONCE, and the editor
   *    passes only its bare control (an `<input>` / `<button>` / etc.):
   *
   *    ```svelte
   *    <SvField frame {id} {label} {size} {invalid} clearable showClear={!!value}
   *             onclear={() => set('')}>
   *      {#snippet leading()}<SearchIcon />{/snippet}
   *      <input class="sv-field__native" ... />
   *    </SvField>
   *    ```
   *
   *    In framed mode the editor's bare `<input>` / `<textarea>` / `<select>`
   *    inherits borderless chrome automatically (see the scoped `:global` rule),
   *    so editors no longer re-implement the box / focus ring / invalid / size.
   */
  import type { Snippet } from 'svelte'
  import { editorErrorId, editorHintId, type EditorAction, type EditorDir, type EditorSize } from './editor-contract'

  let {
    id,
    label,
    hint,
    error,
    required = false,
    dir,
    /** Stretch the field (and its control) to the container width. */
    block = false,
    /** Busy state - shows a small spinner beside the label. */
    loading = false,
    /**
     * Own the bordered control box (invalid/size/adornments/clear). Opt-in so
     * existing editors that draw their own box are unaffected.
     */
    frame = false,
    /** Framed mode: invalid styling on the box + border. */
    invalid = false,
    /** Framed mode: control size / density. */
    size = 'md',
    /** Framed mode: dim + block interaction styling. */
    disabled = false,
    /** Framed mode: read-only styling. */
    readonly = false,
    /** Framed mode: leading adornment (icon/button) at the start of the box. */
    leading,
    /** Framed mode: trailing adornment (icon/button) at the end of the box. */
    trailing,
    /** Framed mode: plain-text affix at the start (units like `$`). */
    prefix,
    /** Framed mode: plain-text affix at the end (units like `kg`). */
    suffix,
    /** Framed mode: render the shared clear button when {@link showClear}. */
    clearable = false,
    /** Framed mode: whether there is a value to clear right now. */
    showClear = false,
    /** Framed mode: invoked when the shared clear button is pressed. */
    onclear,
    /** Framed mode: accessible label for the clear button. */
    clearLabel = 'Clear',
    /** Framed mode: control width (number = px). Default 220; `block` overrides to 100%. */
    width,
    /** `floating` overlays the label in the box and animates it up on focus/value
     *  (framed mode only). Default `static` (label above the control). */
    labelMode = 'static',
    /** Floating mode: whether the control currently holds a value (keeps the
     *  label up). Focus is detected via `:focus-within`. */
    filled = false,
    /** Framed mode: compact in-field action buttons (lookup/generate/copy...). */
    actions,
    children,
  }: {
    id?: string
    label?: string
    hint?: string
    error?: string
    required?: boolean
    dir?: EditorDir
    block?: boolean
    loading?: boolean
    frame?: boolean
    invalid?: boolean
    size?: EditorSize
    disabled?: boolean
    readonly?: boolean
    leading?: Snippet
    trailing?: Snippet
    prefix?: string
    suffix?: string
    clearable?: boolean
    showClear?: boolean
    onclear?: () => void
    clearLabel?: string
    width?: number | string
    labelMode?: 'static' | 'floating'
    filled?: boolean
    actions?: EditorAction[]
    children: Snippet
  } = $props()

  const controlWidth = $derived(width == null ? undefined : typeof width === 'number' ? `${width}px` : width)
  // Floating labels need the framed box to anchor to and an actual label.
  const floating = $derived(labelMode === 'floating' && frame && !!label)

  // 'auto'/undefined -> inherit from the document (no dir attribute).
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
</script>

<div class="sv-field" class:sv-field--block={block} class:sv-field--floating={floating} dir={resolvedDir}>
  {#if (label && !floating) || loading}
    <span class="sv-field__labelrow">
      {#if label && !floating}
        <label class="sv-field__label" for={id}>
          {label}{#if required}<span class="sv-field__req" aria-hidden="true">*</span>{/if}
        </label>
      {/if}
      {#if loading}<span class="sv-field__spinner" role="status" aria-label="Loading"></span>{/if}
    </span>
  {/if}
  {#if frame}
    <div
      class="sv-field__control sv-field--{size}"
      class:is-invalid={invalid}
      class:is-disabled={disabled}
      class:is-readonly={readonly}
      class:is-filled={filled}
      style:width={block ? undefined : controlWidth}
    >
      {#if floating}
        <label class="sv-field__float-label" for={id}>{label}{#if required}<span class="sv-field__req" aria-hidden="true">*</span>{/if}</label>
      {/if}
      {#if leading}<span class="sv-field__adorn sv-field__adorn--lead">{@render leading()}</span>{/if}
      {#if prefix}<span class="sv-field__affix sv-field__affix--pre">{prefix}</span>{/if}
      <span class="sv-field__slot">{@render children()}</span>
      {#if suffix}<span class="sv-field__affix sv-field__affix--suf">{suffix}</span>{/if}
      {#if trailing}<span class="sv-field__adorn sv-field__adorn--trail">{@render trailing()}</span>{/if}
      {#if actions?.length}
        {#each actions as a (a.label)}
          <button class="sv-field__action" type="button" tabindex="-1" aria-label={a.label} title={a.label} disabled={disabled || a.disabled} onclick={() => a.onClick()}>
            {#if a.icon}{@render a.icon()}{:else}<span class="sv-field__action-txt">{a.label}</span>{/if}
          </button>
        {/each}
      {/if}
      {#if clearable && showClear && !disabled && !readonly}
        <button class="sv-field__clear" type="button" tabindex="-1" aria-label={clearLabel} onclick={() => onclear?.()}>&times;</button>
      {/if}
    </div>
  {:else}
    {@render children()}
  {/if}
  {#if error}
    <span class="sv-field__error" id={editorErrorId(id)} role="alert">{error}</span>
  {:else if hint}
    <span class="sv-field__hint" id={editorHintId(id)}>{hint}</span>
  {/if}
</div>

<style>
  .sv-field {
    display: inline-flex;
    flex-direction: column;
    gap: 3px;
    text-align: start;
  }
  .sv-field--block { display: flex; width: 100%; }
  .sv-field__labelrow { display: inline-flex; align-items: center; gap: 6px; }
  .sv-field__label {
    font-size: 12.5px;
    font-weight: 550;
    color: var(--sg-fg, #0f172a);
    line-height: 1.3;
  }
  .sv-field__spinner {
    width: 12px; height: 12px; flex: none; border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent);
    border-top-color: var(--sg-accent, #2563eb);
    animation: sv-field-spin 0.6s linear infinite;
  }
  @keyframes sv-field-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .sv-field__spinner { animation: none; } }
  .sv-field__req { color: var(--sg-danger, #dc2626); margin-inline-start: 2px; }
  .sv-field__hint {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    line-height: 1.35;
  }
  .sv-field__error {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--sg-danger, #dc2626);
    line-height: 1.35;
  }

  /* ---- Framed mode: the shared control box (opt-in via `frame`) ---- */
  .sv-field__control {
    --_accent: var(--sg-accent, #2563eb);
    display: flex; align-items: center; width: 220px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1));
    border-radius: var(--sg-radius, 8px);
  }
  .sv-field--block .sv-field__control { width: 100%; }
  .sv-field__control:focus-within {
    border-color: var(--_accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent);
  }
  .sv-field__control.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-field__control.is-invalid:focus-within {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent);
  }
  .sv-field__control.is-disabled { opacity: 0.6; }
  .sv-field__control.is-readonly { background: var(--sg-muted-bg, color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-input-bg, #fff))); }

  /* ---- Floating label ---- */
  .sv-field--floating .sv-field__control { position: relative; }
  .sv-field__float-label {
    position: absolute; inset-inline-start: 11px; top: 50%; transform: translateY(-50%);
    font-size: 13px; color: var(--sg-muted, #64748b); pointer-events: none;
    background: var(--sg-input-bg, #fff); padding: 0 4px; max-width: calc(100% - 24px);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 1;
    transition: top 0.14s ease, font-size 0.14s ease, color 0.14s ease;
  }
  .sv-field__control:focus-within .sv-field__float-label,
  .sv-field__control.is-filled .sv-field__float-label {
    top: 0; font-size: 10.5px; color: var(--_accent, var(--sg-accent, #2563eb));
  }
  .sv-field__control.is-invalid .sv-field__float-label { color: var(--sg-danger, #dc2626); }
  @media (prefers-reduced-motion: reduce) { .sv-field__float-label { transition: none; } }

  .sv-field__slot { display: flex; flex: 1; min-width: 0; }
  /* Bare form controls passed as children inherit borderless chrome so editors
     no longer re-implement the box. Scoped to the framed control only. */
  .sv-field__slot :global(input),
  .sv-field__slot :global(textarea),
  .sv-field__slot :global(select) {
    flex: 1; min-width: 0; width: 100%;
    border: 0; background: none; outline: none;
    color: inherit; font: inherit; padding: 0 10px;
  }

  .sv-field__adorn { display: inline-flex; align-items: center; color: var(--sg-muted, #64748b); }
  .sv-field__adorn--lead { padding-inline-start: 10px; }
  .sv-field__adorn--trail { padding-inline-end: 10px; }
  .sv-field__affix { display: inline-flex; align-items: center; color: var(--sg-muted, #64748b); white-space: nowrap; }
  .sv-field__affix--pre { padding-inline-start: 10px; }
  .sv-field__affix--suf { padding-inline-end: 10px; }
  /* When an affix/adornment sits next to the control, drop the control's own
     edge padding so text hugs the affix. */
  .sv-field__adorn--lead + .sv-field__slot :global(input),
  .sv-field__affix--pre + .sv-field__slot :global(input) { padding-inline-start: 6px; }

  .sv-field__clear {
    display: grid; place-items: center; width: 28px; align-self: stretch;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer;
    font-size: 17px; line-height: 1;
  }
  .sv-field__clear:hover { color: var(--sg-fg, #0f172a); }
  .sv-field__action {
    display: inline-grid; place-items: center; align-self: center; flex: none;
    min-width: 24px; height: 24px; margin-inline-end: 3px; padding: 0 5px;
    background: none; border: 0; border-radius: 5px; color: var(--sg-muted, #64748b);
    cursor: pointer; font: inherit; font-size: 12px;
  }
  .sv-field__action:hover:not([disabled]) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-accent, #2563eb); }
  .sv-field__action[disabled] { opacity: 0.5; cursor: default; }
  .sv-field__action-txt { font-weight: 600; white-space: nowrap; }

  .sv-field--sm .sv-field__control,
  .sv-field__control.sv-field--sm { height: 28px; font-size: 12px; }
  .sv-field--md .sv-field__control,
  .sv-field__control.sv-field--md { height: 34px; font-size: 13px; }
  .sv-field--lg .sv-field__control,
  .sv-field__control.sv-field--lg { height: 40px; font-size: 15px; }
</style>
