<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  /**
   * The find-in-grid bar. Ctrl+F opens it; Enter steps to the next hit,
   * Shift+Enter to the previous one; Esc closes it. SvGrid loads it on the
   * first open, so a grid nobody searches does not carry it.
   */
  import type { RowData, TableFeatures } from "./index";
  import type { Snippet } from "svelte";
  import type { GridIconName } from "./grid-icons";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let {
    ctrl,
    icon,
  }: {
    ctrl: SvGridController<TFeatures, TData>;
    icon: Snippet<[GridIconName]>;
  } = $props();

  const findHits = $derived(ctrl.findHits);

  function step(by: number) {
    if (findHits.length === 0) return;
    ctrl.findHitIndex = (ctrl.findHitIndex + by + findHits.length) % findHits.length;
    const hit = findHits[ctrl.findHitIndex];
    if (hit) {
      ctrl.setActiveCell(hit.rowIndex, hit.colIndex);
      ctrl.scrollActiveCellIntoView(hit.rowIndex, hit.colIndex);
    }
  }

  function close() {
    ctrl.findOpen = false;
    ctrl.findQuery = "";
    // Return focus to the grid instead of letting it fall to <body> (#80).
    ctrl.gridRootEl?.focus({ preventScroll: true });
  }
</script>

<!-- Anchored to the TOP of the grid root so it tracks the grid even when the
     page scrolls. -->
<div class="sv-grid-find" role="search" aria-label="Find in grid">
  {@render icon("search")}
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="sv-grid-find-input"
    type="search"
    placeholder="Find in grid…"
    autofocus
    bind:value={ctrl.findQuery}
    oninput={() => (ctrl.findHitIndex = 0)}
    onkeydown={(event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }}
  />
  <span class="sv-grid-find-count">
    {findHits.length === 0 && ctrl.findQuery.trim()
      ? "No matches"
      : findHits.length === 0
        ? ""
        : `${ctrl.findHitIndex + 1} of ${findHits.length}`}
  </span>
  <button
    type="button"
    class="sv-grid-find-step"
    aria-label="Previous match"
    disabled={findHits.length === 0}
    onclick={() => step(-1)}>{@render icon("find-prev")}</button
  >
  <button
    type="button"
    class="sv-grid-find-step"
    aria-label="Next match"
    disabled={findHits.length === 0}
    onclick={() => step(1)}>{@render icon("find-next")}</button
  >
  <button type="button" class="sv-grid-find-close" aria-label="Close find" onclick={close}
    >{@render icon("close")}</button
  >
</div>
