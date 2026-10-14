// What the open menus do: the column menu's sort / group / facet actions, the
// right-click menu's items and the comment editor. Only GridMenus.svelte calls
// these, and it loads on the first menu open, so this module rides in that
// chunk instead of the grid's base bundle (menus.ts keeps what the grid needs
// before any menu exists: the filter row, opening a menu, paging).
import type { RowData, TableFeatures } from "./index";
import type { ContextMenuIcon } from "./SvGrid.types";
import type { GridIconName } from "./grid-icons";
import { clampMenuX } from "./SvGrid.helpers";

export function createMenuActions<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function openChooseColumns(event: MouseEvent) {
    event.stopPropagation();
    // Submenu behavior: keep the parent operations menu open and float the
    // Choose Columns panel out to the right of it, submenu-style. Falls
    // back to below the item if the popover would clip the viewport.
    const trigger = event.currentTarget as HTMLElement;
    const menuEl = trigger.closest(".sv-grid-menu") as HTMLElement | null;
    const anchor = (menuEl ?? trigger).getBoundingClientRect();
    const panelWidth = 240;
    const wantRight = anchor.right + 4;
    const x =
      wantRight + panelWidth + 8 > window.innerWidth
        ? clampMenuX(anchor.left - panelWidth - 4, panelWidth)
        : clampMenuX(wantRight, panelWidth);
    ctx.chooseColumnsPos = { x, y: anchor.top };
  }

  function sortColumnFromMenu(columnId: string, desc: boolean) {
    ctx.grid.store.setState((prev: any) => ({
      ...prev,
      sorting: [{ id: columnId, desc }],
    }));
    ctx.closeMenus();
  }

  function clearColumnSort(columnId: string) {
    ctx.grid.store.setState((prev: any) => ({
      ...prev,
      sorting: (prev.sorting ?? []).filter(
        (entry: { id: string }) => entry.id !== columnId,
      ),
    }));
    ctx.closeMenus();
  }

  function groupByColumnFromMenu(columnId: string) {
    const current = ctx.grid.getState().grouping ?? [];
    if (current.includes(columnId)) {
      ctx.closeMenus();
      return;
    }
    ctx.grid.setGrouping([...current, columnId]);
    ctx.closeMenus();
  }

  function clearGroupingFromMenu(columnId: string) {
    const current = ctx.grid.getState().grouping ?? [];
    ctx.grid.setGrouping(current.filter((id: string) => id !== columnId));
    ctx.closeMenus();
  }

  function isFacetChecked(columnId: string, value: string) {
    const selected = ctx.valueFilters[columnId];
    return selected ? selected.has(value) : true;
  }

  function toggleFacetValue(columnId: string, value: string) {
    const allValues = ctx.columnMenuFacetValues;
    const next = new Set(ctx.valueFilters[columnId] ?? allValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === allValues.length) {
      const copy = { ...ctx.valueFilters };
      delete copy[columnId];
      ctx.valueFilters = copy;
    } else {
      ctx.valueFilters = { ...ctx.valueFilters, [columnId]: next };
    }
  }

  /**
   * Replace a column's checked-facet set. "Everything checked" is stored as an
   * ABSENT entry (so an unfiltered high-cardinality column never holds a set of
   * every value), which is why the full-size case deletes instead of writing.
   */
  function setFacetSelection(columnId: string, next: ReadonlySet<string>) {
    if (next.size >= ctx.columnMenuFacetValues.length) {
      const copy = { ...ctx.valueFilters };
      delete copy[columnId];
      ctx.valueFilters = copy;
      return;
    }
    ctx.valueFilters = { ...ctx.valueFilters, [columnId]: new Set(next) };
  }

  /**
   * With a search query typed, "select all" means the RESULTS - the same thing
   * it means in a spreadsheet. It used to mean the whole column regardless, so
   * the standard flow (type a query, tick select-all, get just the matches)
   * cleared the entire selection instead: `isAllFacetsChecked` saw every value
   * ticked, read that as "on", and turned everything off.
   */
  function isAllFacetsChecked(columnId: string) {
    const selected = ctx.valueFilters[columnId];
    const visible = ctx.columnMenuVisibleFacets as Array<string>;
    const searching = visible.length !== ctx.columnMenuFacetValues.length;
    if (!selected) return true;
    if (searching) return visible.every((value) => selected.has(value));
    return selected.size >= ctx.columnMenuFacetValues.length;
  }

  function toggleAllFacets(columnId: string) {
    const visible = ctx.columnMenuVisibleFacets as Array<string>;
    const all = ctx.columnMenuFacetValues as Array<string>;
    const searching = visible.length !== all.length;
    const on = isAllFacetsChecked(columnId);

    if (!searching) {
      if (on) {
        ctx.valueFilters = { ...ctx.valueFilters, [columnId]: new Set<string>() };
      } else {
        const copy = { ...ctx.valueFilters };
        delete copy[columnId];
        ctx.valueFilters = copy;
      }
      return;
    }
    // Searching: add or remove just the matches, leaving the rest of the
    // selection alone. An absent entry means "everything", so it has to be
    // materialized before a subtraction can mean anything.
    const current = ctx.valueFilters[columnId]
      ? new Set<string>(ctx.valueFilters[columnId])
      : new Set<string>(all);
    for (const value of visible) {
      if (on) current.delete(value);
      else current.add(value);
    }
    ctx.valueFilters = { ...ctx.valueFilters, [columnId]: current };
  }

  // ---- Right-click context menu --------------------------------------
  type CtxTarget = { rowIndex: number; colIndex: number; columnId: string; rowId: string; row: TData | null };
  type ResolvedItem = { key: string; label: string; icon?: GridIconName | ContextMenuIcon; separator?: boolean; disabled?: boolean; run?: () => void };

  function insertRowAt(t: CtxTarget, offset: number) {
    const data = ctx.internalData.slice() as TData[];
    const idx = t.row ? data.indexOf(t.row) : -1;
    const at = idx < 0 ? data.length : idx + offset;
    data.splice(at, 0, {} as TData);
    ctx.internalData = data;
  }
  function removeRowAt(t: CtxTarget) {
    if (!t.row) return;
    ctx.internalData = (ctx.internalData as TData[]).filter((r) => r !== t.row);
  }
  function removeColAt(t: CtxTarget) {
    ctx.internalColumns = ctx.internalColumns.filter(
      (d: any) => (d.id ?? d.field) !== t.columnId,
    );
  }

  // Built-in items, keyed. `run` reads the live target passed at click time.
  // `msg` names the GridMessages key so the label localizes (falls back to the
  // English `label` when no `localeText` is set).
  const builtins: Record<string, { label: string; msg?: string; run: (t: CtxTarget) => void }> = {
    copy: { label: "Copy", msg: "menuCopy", run: () => ctx.copySelectionToClipboard() },
    cut: { label: "Cut", msg: "menuCut", run: () => ctx.cutSelectionToClipboard() },
    paste: { label: "Paste", msg: "menuPaste", run: () => void ctx.pasteFromClipboard() },
    clear: { label: "Clear", msg: "menuClear", run: () => ctx.clearSelectedCells() },
    row_above: { label: "Insert row above", msg: "menuInsertRowAbove", run: (t) => insertRowAt(t, 0) },
    row_below: { label: "Insert row below", msg: "menuInsertRowBelow", run: (t) => insertRowAt(t, 1) },
    remove_row: { label: "Remove row", msg: "menuRemoveRow", run: removeRowAt },
    remove_col: { label: "Remove column", msg: "menuRemoveColumn", run: removeColAt },
    comment: { label: "Edit comment", msg: "menuEditComment", run: (t) => openCommentEditor(t) },
    // Charting: open the chart panel scoped to the current cell selection. Gated
    // on `chartingEnabled` in the resolver below.
    chart: { label: "Chart selected range", msg: "chartRange", run: () => { ctx.chartPanelOpen = true; } },
  };
  const DEFAULT_ITEMS = [
    "copy", "cut", "paste", "clear", "separator",
    "row_above", "row_below", "remove_row", "separator", "remove_col",
  ];

  function closeContextMenu() {
    ctx.contextMenuFor = null;
  }

  // ---- Editable comments ---------------------------------------------
  function openCommentEditor(t: CtxTarget) {
    const cur =
      ctx.noteOverrides?.[t.rowId]?.[t.columnId] ??
      ctx.props.notes?.[t.rowId]?.[t.columnId] ??
      "";
    ctx.commentDraft = cur;
    ctx.commentEditFor = { rowId: t.rowId, columnId: t.columnId, x: ctx.contextMenuPos.x, y: ctx.contextMenuPos.y };
    ctx.contextMenuFor = null;
  }
  function writeNote(rowId: string, columnId: string, note: string) {
    const next = { ...ctx.noteOverrides };
    next[rowId] = { ...(next[rowId] ?? {}), [columnId]: note };
    ctx.noteOverrides = next;
    ctx.props.onNoteChange?.({ rowId, columnId, note });
  }
  function saveComment() {
    const e = ctx.commentEditFor;
    if (!e) return;
    writeNote(e.rowId, e.columnId, ctx.commentDraft);
    ctx.commentEditFor = null;
  }
  function removeComment() {
    const e = ctx.commentEditFor;
    if (!e) return;
    writeNote(e.rowId, e.columnId, "");
    ctx.commentEditFor = null;
  }
  function closeCommentEditor() {
    ctx.commentEditFor = null;
  }

  /** Resolve the configured items against the current target for rendering. */
  function contextMenuItems(): ResolvedItem[] {
    const target = ctx.contextMenuFor as CtxTarget | null;
    if (!target) return [];
    const cfg = ctx.props.contextMenu;
    const messages = ctx.messages;
    const entries: any[] = Array.isArray(cfg)
      ? cfg
      : [
          ...DEFAULT_ITEMS,
          ...(ctx.chartingEnabled ? ["separator", "chart"] : []),
          ...(ctx.props.editableComments ? ["separator", "comment"] : []),
        ];
    const out: ResolvedItem[] = [];
    for (const entry of entries) {
      if (entry === "separator") { out.push({ key: "sep" + out.length, label: "", separator: true }); continue; }
      if (typeof entry === "string") {
        // The chart item only makes sense when charting is enabled.
        if (entry === "chart" && !ctx.chartingEnabled) continue;
        const b = builtins[entry];
        if (!b) continue;
        const label = (b.msg && messages?.[b.msg]) || b.label;
        out.push({ key: entry, label, run: () => b.run(target) });
        continue;
      }
      if (entry.hidden?.(target)) continue;
      // An object on a built-in's key with no action of its own is that
      // built-in with an icon (or a label) of the consumer's choosing.
      const b = builtins[entry.key];
      const builtinLabel = b ? ((b.msg && messages?.[b.msg]) || b.label) : entry.key;
      out.push({
        key: entry.key,
        label: entry.label ?? builtinLabel,
        icon: entry.icon,
        disabled: entry.disabled?.(target) ?? false,
        run: entry.action ? () => entry.action(target) : b ? () => b.run(target) : undefined,
      });
    }
    // Drop leading/trailing/double separators.
    return out.filter((it, i, a) =>
      !it.separator || (i > 0 && i < a.length - 1 && !a[i - 1]?.separator),
    );
  }

  return {
    openChooseColumns,
    sortColumnFromMenu,
    clearColumnSort,
    groupByColumnFromMenu,
    clearGroupingFromMenu,
    isFacetChecked,
    toggleFacetValue,
    setFacetSelection,
    isAllFacetsChecked,
    toggleAllFacets,
    closeContextMenu,
    contextMenuItems,
    saveComment,
    removeComment,
    closeCommentEditor,
  };
}
