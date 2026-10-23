// menus handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import { untrack } from "svelte";
import type { FilterOperator } from "./SvGrid.types";
import { takesNoValue } from "./filter-operators";
import {
  clampMenuX,
  cssEscape,
} from "./SvGrid.helpers";
import { splitInTokens, joinInTokens } from "./filtering/excel-filters";
import { customFilterIsActive } from "./custom-filter";

export function createMenus<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function updateFilterRow(columnId: string, value: string) {
    ctx.filterRowValues = { ...ctx.filterRowValues, [columnId]: value };
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, value },
    };
  }

  function updateFilterOperator(columnId: string, operator: FilterOperator) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, operator },
    };
  }

  function updateFilterMenuValue(columnId: string, value: string) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, value },
    };
    ctx.filterRowValues = { ...ctx.filterRowValues, [columnId]: value };
  }

  /** Upper-bound input for the `between` operator. Only relevant when
   *  the column's current operator is `between`; harmless to call
   *  otherwise. */
  function updateFilterMenuValueTo(columnId: string, valueTo: string) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "between" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, valueTo },
    };
  }

  /** Current `in` / `notIn` token list for a column (from the filter-row value). */
  function filterTokens(columnId: string): string[] {
    return splitInTokens(ctx.filterRowValues[columnId] ?? "");
  }

  /** Add a value to a column's `in` / `notIn` list (no-op if already present). */
  function addFilterToken(columnId: string, token: string) {
    const t = token.trim();
    if (!t) return;
    const tokens = filterTokens(columnId);
    if (!tokens.includes(t)) tokens.push(t);
    updateFilterRow(columnId, joinInTokens(tokens));
  }

  /** Remove a value from a column's `in` / `notIn` list. */
  function removeFilterToken(columnId: string, token: string) {
    updateFilterRow(
      columnId,
      joinInTokens(filterTokens(columnId).filter((t) => t !== token)),
    );
  }

  /** Toggle a value in a column's `in` / `notIn` list (checklist behaviour). */
  function toggleFilterToken(columnId: string, token: string) {
    if (filterTokens(columnId).includes(token)) removeFilterToken(columnId, token);
    else addFilterToken(columnId, token);
  }

  /**
   * Replace a column's `in` / `notIn` list wholesale. The suggestions dropdown
   * hands back the full token set after a click, which keeps tokens the user
   * typed by hand (or that the search box is currently hiding) intact.
   */
  function setFilterTokens(columnId: string, tokens: Iterable<string>) {
    const list = [...tokens].map((t) => t.trim()).filter(Boolean);
    updateFilterRow(columnId, joinInTokens(list));
  }

  function toggleCheckboxWithKeyboard(
    event: KeyboardEvent,
    toggle: () => void,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  }

  /**
   * Set or clear a column's custom-filter model. `untrack` for the same
   * reason as `clearColumnFilter`: it is reachable from `api.setCustomFilter`,
   * which a consumer may call from inside an effect.
   */
  function setCustomFilter(columnId: string, model: unknown) {
    untrack(() => {
      const next = { ...ctx.customFilterValues };
      if (model == null) {
        if (!(columnId in next)) return;
        delete next[columnId];
      } else {
        next[columnId] = model;
      }
      ctx.customFilterValues = next;
    });
  }

  function isColumnFiltered(columnId: string) {
    if (ctx.valueFilters[columnId]) return true;
    if (columnId in ctx.customFilterValues) {
      const column = ctx.allColumns.find((c: any) => c.id === columnId);
      if (customFilterIsActive(column?.columnDef.customFilter, ctx.customFilterValues[columnId])) return true;
    }
    const menuFilter = ctx.filterMenuValues[columnId];
    return Boolean(
      menuFilter &&
        (takesNoValue(menuFilter.operator) ||
          menuFilter.value.trim()),
    );
  }

  function closeMenus() {
    ctx.columnMenuFor = null;
    ctx.filterMenuFor = null;
    ctx.operatorMenuFor = null;
    ctx.inSuggestFor = null;
    ctx.chooseColumnsPos = null;
  }

  /** Open the `in` / `notIn` value-suggestions dropdown under a chip input. */
  function openInSuggest(anchor: HTMLElement, columnId: string) {
    const rect = anchor.getBoundingClientRect();
    ctx.inSuggestPos = { x: clampMenuX(rect.left, 220), y: rect.bottom + 4 };
    ctx.inSuggestQuery = "";
    ctx.inSuggestFor = columnId;
  }

  function closeInSuggest() {
    ctx.inSuggestFor = null;
    ctx.inSuggestQuery = "";
  }

  function openColumnMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.columnMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.columnMenuPos = {
      x: clampMenuX(rect.right - 240, 240),
      y: rect.bottom + 4,
    };
    ctx.columnMenuTab = "general";
    ctx.columnMenuFor = columnId;
  }

  function openFilterMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.filterMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;

    // If the consumer is running in row-mode (or any mode where the
    // funnel popover wouldn't render), redirect the click to the
    // inline filter input for this column. Without this the funnel
    // would be a dead button - it visibly clicks but nothing happens
    // because the menu is gated behind `showColumnFiltersEffective`.
    if (!ctx.showColumnFiltersEffective && ctx.showFilterRowEffective) {
      // Find the row-mode filter input and focus it. The input is
      // tagged with `data-svgrid-filter-col` so we can target by id
      // without depending on column position.
      const target = (ctx.scrollContainer as HTMLElement | null)?.querySelector<HTMLElement>(
        `[data-svgrid-filter-col="${cssEscape(columnId)}"]`,
      );
      // A custom filter control tags its wrapper instead; focus the first
      // control inside it.
      const input =
        target && !(target instanceof HTMLInputElement)
          ? target.querySelector<HTMLElement>(
              "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
            )
          : target;
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement) input.select();
        // Brief pulse so the user sees where focus landed.
        input.classList.add("sv-grid-filter-value-pulse");
        setTimeout(() => input.classList.remove("sv-grid-filter-value-pulse"), 700);
      }
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.filterMenuPos = {
      x: clampMenuX(rect.right - 260, 260),
      y: rect.bottom + 4,
    };
    ctx.columnMenuSearch = "";
    ctx.filterMenuFor = columnId;
  }

  function openOperatorMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.operatorMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.operatorMenuPos = { x: clampMenuX(rect.left, 184), y: rect.bottom + 4 };
    ctx.operatorMenuFor = columnId;
  }

  function clearColumnFilter(columnId: string) {
    // `untrack`: read-modify-write on the filter maps. Keeps the method safe to
    // call from a consumer's reactive `$effect` (e.g. via `api.clearFilter`)
    // without capturing these reads as a dependency and looping. See
    // `build-api`'s `setFilter` for the full rationale.
    untrack(() => {
      if (ctx.valueFilters[columnId]) {
        const next = { ...ctx.valueFilters };
        delete next[columnId];
        ctx.valueFilters = next;
      }
      if (ctx.filterMenuValues[columnId]) {
        const next = { ...ctx.filterMenuValues };
        delete next[columnId];
        ctx.filterMenuValues = next;
      }
      if (ctx.filterRowValues[columnId]) {
        const next = { ...ctx.filterRowValues };
        delete next[columnId];
        ctx.filterRowValues = next;
      }
      if (columnId in ctx.customFilterValues) {
        const next = { ...ctx.customFilterValues };
        delete next[columnId];
        ctx.customFilterValues = next;
      }
    });
  }

  // External pagination is controlled: emit the requested page/size and let
  // the consumer fetch + update props. Never mutate local pagination state.
  function emitExternalPagination(pageIndex: number, pageSize: number): boolean {
    if (ctx.props.externalPagination !== true) return false;
    ctx.props.onPaginationChange?.({ pageIndex: Math.max(0, pageIndex), pageSize });
    ctx.scrollContainer?.scrollTo?.({ top: 0 });
    return true;
  }

  function changePage(delta: number) {
    if (
      emitExternalPagination(
        (ctx.props.pageIndex ?? 0) + delta,
        ctx.props.pageSize ?? 10,
      )
    )
      return;
    ctx.grid.setPagination((prev: any) => ({
      ...prev,
      pageIndex: Math.max((prev?.pageIndex ?? 0) + delta, 0),
    }));
    ctx.scrollContainer?.scrollTo?.({ top: 0 });
  }

  function goToPage(pageIndex: number) {
    if (emitExternalPagination(pageIndex, ctx.props.pageSize ?? 10)) return;
    ctx.grid.setPagination((prev: any) => ({
      ...prev,
      pageIndex: Math.max(0, pageIndex),
    }));
    ctx.scrollContainer?.scrollTo?.({ top: 0 });
  }

  function setPageSize(pageSize: number) {
    // External mode: changing page size resets to the first page.
    if (emitExternalPagination(0, pageSize)) return;
    ctx.grid.setPagination((prev: any) => {
      const oldSize = prev?.pageSize ?? 10;
      const oldIndex = prev?.pageIndex ?? 0;
      // Keep the first visible row in view when the page size changes.
      const firstVisibleRow = oldIndex * oldSize;
      return {
        ...prev,
        pageSize,
        pageIndex: Math.max(0, Math.floor(firstVisibleRow / pageSize)),
      };
    });
  }

  // ---- Right-click context menu --------------------------------------
  function openContextMenu(
    event: MouseEvent,
    rowIndex: number,
    colIndex: number,
    columnId: string,
  ) {
    if (!ctx.props.contextMenu) return;
    event.preventDefault();
    closeMenus();
    ctx.contextMenuFor = null;
    const rowModel = ctx.allRows[rowIndex];
    const row = rowModel?.original ?? null;
    const rowId = rowModel?.id ?? String(rowIndex);
    // Reserve ~280px for the menu body. If the click is in the bottom third,
    // flip the menu above the cursor so it stays fully in the viewport.
    const menuHeight = 280;
    const y = event.clientY + menuHeight > window.innerHeight
      ? Math.max(8, event.clientY - menuHeight)
      : event.clientY;
    ctx.contextMenuPos = {
      x: clampMenuX(event.clientX, 220),
      y,
    };
    ctx.contextMenuFor = { rowIndex, colIndex, columnId, rowId, row };
  }

  return {
    updateFilterRow,
    updateFilterOperator,
    updateFilterMenuValue,
    updateFilterMenuValueTo,
    addFilterToken,
    removeFilterToken,
    toggleFilterToken,
    toggleCheckboxWithKeyboard,
    isColumnFiltered,
    setCustomFilter,
    closeMenus,
    openInSuggest,
    closeInSuggest,
    openColumnMenu,
    openFilterMenu,
    openOperatorMenu,
    setFilterTokens,
    clearColumnFilter,
    changePage,
    goToPage,
    setPageSize,
    openContextMenu,
  };
}
