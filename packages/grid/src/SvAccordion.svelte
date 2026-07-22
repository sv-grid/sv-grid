<script lang="ts" module>
  export type { AccordionItem, AccordionExpandMode } from './createAccordion.svelte'
</script>

<script lang="ts">
  /**
   * SvAccordion - a WAI-ARIA accordion (collapsible sections) with single- or
   * multiple-expand and roving header focus (Up/Down/Home/End). Parity: Smart
   * `smart-accordion`. Controlled via `expanded` + `onChange`; each panel's body
   * is rendered through the `panel` snippet (receives the item).
   *
   * Behavior (expand state, keyboard, ARIA) lives in the headless `createAccordion`
   * core; this component is one styled renderer over it.
   */
  import type { Snippet } from 'svelte'
  import { type EditorDir } from './editor-contract'
  import { createAccordion, type AccordionItem, type AccordionExpandMode } from './createAccordion.svelte'

  type Props = {
    items: ReadonlyArray<AccordionItem>
    /** Expanded item ids (controlled). */
    expanded?: string[]
    onChange?: (expandedIds: string[]) => void
    /** 'single' (at most one open) or 'multiple'. Default single. */
    expandMode?: AccordionExpandMode
    disabled?: boolean
    dir?: EditorDir
    /** Panel body for an item. */
    panel?: Snippet<[AccordionItem]>
  }

  let {
    items,
    expanded = $bindable([]),
    onChange,
    expandMode = 'single',
    disabled = false,
    dir,
    panel,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  const acc = createAccordion({
    items: () => items,
    expanded: () => expanded,
    onChange: (ids) => { expanded = ids; onChange?.(ids) },
    expandMode: () => expandMode,
    disabled: () => disabled,
    dir: () => dir,
  })

  // DOM focus movement is a render concern: follow the core's roving focus header.
  let rootEl: HTMLDivElement | null = null
  let lastFocusTick = 0
  $effect(() => {
    if (acc.focusTick !== lastFocusTick) {
      lastFocusTick = acc.focusTick
      const i = acc.focusIndex
      queueMicrotask(() => rootEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.focus())
    }
  })
</script>

<div bind:this={rootEl} class="sv-acc" class:is-disabled={disabled} dir={resolvedDir} {...acc.rootProps()}>
  {#each items as item, i (item.id)}
    {@const open = acc.isExpanded(item.id)}
    <div class="sv-acc__item" class:is-open={open}>
      <h3 class="sv-acc__heading">
        <button class="sv-acc__header" {...acc.headerProps(i)}>
          <svg class="sv-acc__chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          <span class="sv-acc__label">{item.label}</span>
        </button>
      </h3>
      {#if open}
        <div class="sv-acc__panel" {...acc.panelProps(i)}>
          <div class="sv-acc__body">{#if panel}{@render panel(item)}{/if}</div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .sv-acc {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-border, #e2e8f0);
    --_radius: var(--sg-radius, 8px);
    display: flex; flex-direction: column; width: 100%;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--_border); border-radius: var(--_radius); overflow: hidden;
  }
  .sv-acc.is-disabled { opacity: 0.6; }
  .sv-acc__item + .sv-acc__item { border-top: 1px solid var(--_border); }
  .sv-acc__heading { margin: 0; font: inherit; }
  .sv-acc__header {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 12px 14px; background: none; border: 0; font: inherit; font-size: 14px; font-weight: 600;
    color: inherit; cursor: pointer; text-align: start;
  }
  .sv-acc__header:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-acc__header:disabled { opacity: 0.5; cursor: not-allowed; }
  .sv-acc__header:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; }
  .sv-acc__chevron { flex: none; color: var(--sg-muted, #64748b); transition: transform 0.16s; }
  .sv-acc__item.is-open .sv-acc__chevron { transform: rotate(90deg); }
  .sv-acc[dir='rtl'] .sv-acc__item:not(.is-open) .sv-acc__chevron { transform: scaleX(-1); }
  .sv-acc__label { flex: 1; }
  .sv-acc__body { padding: 4px 14px 16px; font-size: 13.5px; line-height: 1.6; color: var(--sg-fg, #0f172a); }
</style>
