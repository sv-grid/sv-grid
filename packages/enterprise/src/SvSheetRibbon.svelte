<script lang="ts">
  /**
   * The ribbon.
   *
   * Renders `RIBBON_TABS` and nothing else: the tab strip, then a band of
   * groups, each a cluster of controls above a small centred group label.
   * That label is the thing that makes a ribbon read as a ribbon rather than
   * as a toolbar, so it is not optional.
   *
   * Painted with the grid's own --sg-* tokens rather than Excel's palette, so
   * it matches whatever theme the app runs. Pick the `excel` theme preset and
   * it reads as Excel; pick a dark one and it stays legible. Hard-coding
   * Excel's greens would have made it the one component in the library that
   * ignores the theme.
   *
   * The ribbon owns no sheet state. Every button calls an action from
   * `sheet/ribbon.ts`, which calls the same function the matching keystroke
   * does, so a button and its shortcut cannot drift apart.
   */
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import {
    RIBBON_TABS,
    type RibbonTab, type RibbonItem, type RibbonActionId,
  } from './sheet/ribbon'

  type Props = {
    /**
     * How to reach the grid. A getter rather than the context itself because
     * the context is rebuilt per call and the ribbon needs a live one at the
     * moment a button is pressed, not the one that existed at mount.
     */
    cmd: () => GridCommandContext | null
    /** Called after any action that changed something, so the host re-renders. */
    onChange?: () => void
    /** Actions the ribbon does not run itself, because they need chrome. */
    onAction?: (action: RibbonActionId, cmd: GridCommandContext) => void
    /** Which of `onAction`'s toggles are currently on. The host owns that
     *  state (there is no store here to read it from), so it reports it. */
    activeActions?: ReadonlyArray<RibbonActionId>
    tabs?: ReadonlyArray<RibbonTab>
    /** Start on a tab other than the first. */
    tab?: string
  }

  let {
    cmd,
    onChange,
    onAction,
    activeActions = [],
    tabs = RIBBON_TABS,
    tab = $bindable(tabs[0]?.id ?? 'home'),
  }: Props = $props()

  /**
   * Bumped after every action so the `isOn` / `isEnabled` reads below re-run.
   *
   * They read through the command context into the grid and the format store,
   * neither of which is `$state`, so nothing would otherwise tell Svelte that
   * pressing Bold should light the Bold button up.
   */
  let version = $state(0)

  const current = $derived(tabs.find((t) => t.id === tab) ?? tabs[0])

  function stateOf(item: RibbonItem): { on: boolean; enabled: boolean } {
    void version
    const context = cmd()
    if (!context) return { on: false, enabled: false }
    if (item.emits) {
      return { on: activeActions.includes(item.emits), enabled: true }
    }
    return {
      on: item.isOn?.(context) ?? false,
      enabled: item.isEnabled?.(context) ?? true,
    }
  }

  function run(item: RibbonItem, value?: string) {
    const context = cmd()
    if (!context) return
    if (item.emits) {
      onAction?.(item.emits, context)
      version += 1
      return
    }
    // Only report a change when the action says it did something. A declined
    // action (nothing selected, no store attached) should not make the host
    // re-render and should not look like it worked.
    if (item.run?.(context, value)) onChange?.()
    version += 1
  }

  /** Excel puts the shortcut after the name in the tooltip. */
  function tip(item: RibbonItem): string {
    return item.keys ? `${item.title} (${item.keys})` : item.title
  }

  /**
   * Re-read the toggles when the selection moves, so Bold lights up when you
   * click a bold cell rather than only after you press a ribbon button.
   * Cheap: it only bumps a counter, and the reads are lazy.
   */
  function refresh() {
    version += 1
  }
</script>

<svelte:window onpointerup={refresh} onkeyup={refresh} />

<div class="sv-ribbon" role="toolbar" aria-label="Spreadsheet ribbon" aria-orientation="horizontal">
  <div class="tabs" role="tablist" aria-label="Ribbon tabs">
    {#each tabs as entry (entry.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={entry.id === current?.id}
        aria-selected={entry.id === current?.id}
        tabindex={entry.id === current?.id ? 0 : -1}
        onclick={() => (tab = entry.id)}
      >{entry.label}</button>
    {/each}
  </div>

  <div class="band">
    {#each current?.groups ?? [] as group (group.id)}
      <section class="group" aria-label={group.label}>
        <div class="controls" style:max-width={`${group.width ?? 200}px`}>
          {#each group.items as entry (entry.id)}
            {@const state = stateOf(entry)}
            {#if entry.kind === 'select'}
              <label class="field">
                <span class="sr-only">{entry.title}</span>
                <select
                  title={tip(entry)}
                  disabled={!state.enabled}
                  onchange={(e) => {
                    run(entry, e.currentTarget.value)
                    // Snap back: the control is a command, not a bound value.
                    // Leaving it on the last pick would claim the whole
                    // selection carries that format when it may not.
                    e.currentTarget.selectedIndex = 0
                  }}
                >
                  <option value="">{entry.label}</option>
                  {#each entry.options ?? [] as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
            {:else if entry.kind === 'swatches'}
              <div class="swatches" role="group" aria-label={entry.title}>
                {#each entry.options ?? [] as option (option.value)}
                  <button
                    type="button"
                    class="swatch"
                    class:none={option.value === 'transparent' || option.value === 'inherit'}
                    style:background={entry.id === 'fill' ? option.value : 'transparent'}
                    style:color={entry.id === 'fill' ? 'inherit' : option.value}
                    disabled={!state.enabled}
                    title={`${entry.title}: ${option.label}`}
                    aria-label={`${entry.title}: ${option.label}`}
                    onclick={() => run(entry, option.value)}
                  >{entry.id === 'fill' ? '' : entry.label}</button>
                {/each}
              </div>
            {:else}
              <button
                type="button"
                class="btn"
                class:wide={entry.wide}
                class:on={state.on}
                disabled={!state.enabled}
                title={tip(entry)}
                aria-label={entry.title}
                aria-pressed={entry.kind === 'toggle' ? state.on : undefined}
                onclick={() => run(entry)}
              >
                {#if entry.icon}
                  <span class="bars {entry.icon}" aria-hidden="true">
                    <i></i><i></i><i></i>
                  </span>
                {:else}{entry.label}{/if}
              </button>
            {/if}
          {/each}
        </div>
        <span class="group-label">{group.label}</span>
      </section>
    {/each}
  </div>
</div>

<style>
  .sv-ribbon {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    overflow: hidden;
  }

  .tabs {
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: 0 6px;
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .tab {
    font: inherit;
    font-weight: 600;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--sg-muted, #64748b);
    padding: 7px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .tab:hover { color: var(--sg-fg, #0f172a); }
  .tab.active {
    color: var(--sg-accent, #2563eb);
    border-bottom-color: var(--sg-accent, #2563eb);
  }
  .tab:focus-visible {
    outline: 2px solid var(--sg-accent, #6366f1);
    outline-offset: -2px;
  }

  .band {
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 5px 4px 3px;
    overflow-x: auto;
  }

  /* The separator between groups is a border rather than a gap, which is how
     Excel divides them and what keeps a dense band readable. */
  .group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0 8px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
  }
  .group:last-child { border-right: 0; }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    /* Left-aligned and packed from the top: centring a wrapped row leaves
       the last line floating in the middle of the group, which is the thing
       that stops a dense band reading as a ribbon. */
    justify-content: flex-start;
    align-content: center;
    gap: 3px;
    flex: 1 1 auto;
    min-height: 54px;
  }

  .group-label {
    font-size: 10px;
    letter-spacing: 0.02em;
    color: var(--sg-muted, #64748b);
    white-space: nowrap;
  }

  .btn {
    font: inherit;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn.wide { padding: 0 8px; }
  .btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, #f1f5f9);
    border-color: var(--sg-border, #e2e8f0);
  }
  .btn.on {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
    border-color: transparent;
  }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .btn:focus-visible {
    outline: 2px solid var(--sg-accent, #6366f1);
    outline-offset: -2px;
  }

  /*
   * The alignment icons, drawn rather than typed: three bars where the middle
   * one is short, positioned the way the text would sit. Excel's own icons
   * are the same idea.
   */
  .bars {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 13px;
  }
  .bars i {
    display: block;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }
  .bars i:nth-child(2) { width: 62%; }
  .bars i:nth-child(1),
  .bars i:nth-child(3) { width: 100%; }
  .align-left i:nth-child(2) { margin-right: auto; }
  .align-center i:nth-child(2) { margin-inline: auto; }
  .align-right i:nth-child(2) { margin-left: auto; }

  /* Bold / Italic / Underline read as their own styling, the way Excel's do. */
  .btn[aria-label='Bold'] { font-weight: 800; }
  .btn[aria-label='Italic'] { font-style: italic; font-family: ui-serif, Georgia, serif; }
  .btn[aria-label='Underline'] { text-decoration: underline; }
  .btn[aria-label='Strikethrough'] { text-decoration: line-through; }

  .field { display: inline-flex; }
  select {
    font: inherit;
    height: 26px;
    max-width: 92px;
    padding: 0 4px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1));
    border-radius: 4px;
    /* Not transparent: a native select paints its option list with this
       background, and a see-through one is unreadable on a dark theme. */
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a);
  }
  select:disabled { opacity: 0.4; }

  .swatches { display: inline-flex; gap: 2px; }
  .swatch {
    width: 18px;
    height: 18px;
    padding: 0;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 3px;
    cursor: pointer;
  }
  .swatch.none {
    /* The "no fill" / "automatic" chip, struck through so it does not read as
       just another white swatch. */
    background:
      linear-gradient(to top right,
        transparent calc(50% - 1px), var(--sg-muted, #94a3b8) 50%,
        transparent calc(50% + 1px)) !important;
  }
  .swatch:disabled { opacity: 0.4; cursor: default; }
  .swatch:focus-visible {
    outline: 2px solid var(--sg-accent, #6366f1);
    outline-offset: 1px;
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
