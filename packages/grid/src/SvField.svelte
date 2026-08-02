<script lang="ts">
  /**
   * SvField - the shared field chrome for every value-bearing editor in the kit.
   * It renders an optional `label` (wired to the control via `for`/`id`), the
   * control itself (passed as children), and an optional `hint` / `error` line
   * whose ids match `editorHintId` / `editorErrorId` for `aria-describedby`.
   *
   * Editors wrap their control box in it so label/hint/error/RTL behave
   * IDENTICALLY across the kit:
   *
   * ```svelte
   * <SvField {id} {label} {hint} {error} {required} {dir}>
   *   <div class="sv-num">...control...</div>
   * </SvField>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { editorErrorId, editorHintId, type EditorDir } from './editor-contract'

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
    children: Snippet
  } = $props()

  // 'auto'/undefined -> inherit from the document (no dir attribute).
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
</script>

<div class="sv-field" class:sv-field--block={block} dir={resolvedDir}>
  {#if label || loading}
    <span class="sv-field__labelrow">
      {#if label}
        <label class="sv-field__label" for={id}>
          {label}{#if required}<span class="sv-field__req" aria-hidden="true">*</span>{/if}
        </label>
      {/if}
      {#if loading}<span class="sv-field__spinner" role="status" aria-label="Loading"></span>{/if}
    </span>
  {/if}
  {@render children()}
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
</style>
