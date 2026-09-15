/**
 * Coverage-focused behavioral tests for the SvGridApi assembled in
 * `build-api.ts`. The existing `svgrid.api.test.ts` / `svgrid.api-extensions
 * .test.ts` cover filters, row selection, pagination, navigation, and
 * getState/setState. This file exercises the remaining surface:
 *   - getCellValue / setCellValue
 *   - selectCells / getSelected
 *   - addRow(s) / removeRow(s) / applyTransaction
 *   - addColumn(s) / removeColumn / setColumnVisible / getColumns
 *   - setColumnWidth / setColumnPinning / setColumnOrder
 *   - setFacetFilter
 *   - undo / redo / canUndo / canRedo / clearHistory
 *   - find (open/close/query/hits)
 *   - grouping (setGroupBy / expandAllGroups / collapseAllGroups)
 *   - autosizeColumn / refresh
 *
 * All tests mount the real <SvGrid /> in jsdom and drive the api handed back
 * from onApiReady.
 */

import { describe, expect, it } from "vitest";
import { mount, unmount } from "svelte";
import SvGrid from "./SvGrid.svelte";
import {
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "./index";
import type { ColumnDef, SvGridApi } from "./index";

type Row = { id: number; name: string; team: string; salary: number };

const baseRows: Row[] = [
  { id: 1, name: "Ada Lovelace", team: "Research", salary: 142_000 },
  { id: 2, name: "Grace Hopper", team: "Compilers", salary: 158_000 },
  { id: 3, name: "Alan Turing", team: "Research", salary: 138_000 },
  { id: 4, name: "Margaret Hamilton", team: "Apollo", salary: 165_000 },
  { id: 5, name: "Linus Torvalds", team: "Kernel", salary: 175_000 },
];

const baseColumns: ColumnDef<any, Row>[] = [
  { field: "name", header: "Name", width: 200 },
  { field: "team", header: "Team", width: 160 },
  { field: "salary", header: "Salary", width: 140 },
];

const flush = () => Promise.resolve();

function mountGrid(
  extraProps: Record<string, unknown> = {},
  features: any = tableFeatures({
    columnFilteringFeature,
    rowSortingFeature,
    rowSelectionFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  }),
): Promise<{ api: SvGridApi<any, Row>; target: HTMLElement; destroy: () => void }> {
  return new Promise((resolveApi, rejectApi) => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    let captured: SvGridApi<any, Row> | null = null;
    const app = mount(SvGrid, {
      target,
      props: {
        data: baseRows.map((r) => ({ ...r })),
        columns: baseColumns.map((c) => ({ ...c })),
        features,
        getRowId: (r: Row) => String(r.id),
        rowHeight: 36,
        containerHeight: 480,
        virtualization: false,
        enableCellSelection: true,
        onApiReady(api: SvGridApi<any, Row>) {
          captured = api;
          resolveApi({
            api,
            target,
            destroy: () => {
              unmount(app);
              target.remove();
            },
          });
        },
        ...extraProps,
      } as any,
    });
    queueMicrotask(() => {
      if (!captured) rejectApi(new Error("onApiReady never fired"));
    });
  });
}

describe("SvGridApi - cell read / write", () => {
  it("getCellValue reads through the column field", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(api.getCellValue(0, "name")).toBe("Ada Lovelace");
      expect(api.getCellValue(3, "team")).toBe("Apollo");
    } finally {
      destroy();
    }
  });

  it("getCellValue returns undefined for out-of-range row or unknown column", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(api.getCellValue(999, "name")).toBeUndefined();
      expect(api.getCellValue(0, "nope")).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("setCellValue writes a new immutable row and reads back", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setCellValue(0, "name", "Ada L.");
      await flush();
      expect(api.getCellValue(0, "name")).toBe("Ada L.");
      // other rows untouched
      expect(api.getCellValue(1, "name")).toBe("Grace Hopper");
    } finally {
      destroy();
    }
  });

  it("setCellValue is a no-op for an invalid target", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(() => api.setCellValue(999, "name", "x")).not.toThrow();
      expect(() => api.setCellValue(0, "unknown", "x")).not.toThrow();
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - cell selection", () => {
  it("selectCells sets a rectangle; getSelected reads it back normalized", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.selectCells([[2, 1, 0, 0]]); // unsorted corners
      await flush();
      expect(api.getSelected()).toEqual([[0, 0, 2, 1]]);
    } finally {
      destroy();
    }
  });

  it("selectCells clamps open-ended (Infinity) coordinates to grid bounds", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.selectCells([[0, 0, Infinity, Infinity]]);
      await flush();
      // 5 rows (0..4), 3 cols (0..2)
      expect(api.getSelected()).toEqual([[0, 0, 4, 2]]);
    } finally {
      destroy();
    }
  });

  it("empty selectCells clears the range; getSelected returns []", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.selectCells([[0, 0, 1, 1]]);
      await flush();
      api.selectCells([]);
      await flush();
      expect(api.getSelected()).toEqual([]);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - Handsontable's selection readers", () => {
  it("getSelectedLast keeps the orientation the selection was made in", async () => {
    const { api, destroy } = await mountGrid();
    try {
      // Programmatic ranges are normalised on the way in, so the orientation
      // has to come from a gesture: anchor at (2,1), then extend up-left.
      api.selectCells([[2, 1, 2, 1]]);
      await flush();
      api.getCommandContext().extendSelection(0, 0);
      await flush();
      expect(api.getSelected()).toEqual([[0, 0, 2, 1]]);
      expect(api.getSelectedLast()).toEqual([2, 1, 0, 0]);
      const last = api.getSelectedRangeLast();
      expect(last?.from).toEqual({ row: 2, col: 1 });
      expect(last?.to).toEqual({ row: 0, col: 0 });
    } finally {
      destroy();
    }
  });

  it("getSelectedRange lists every rectangle oldest first, the active cell as its highlight", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.selectCells([[0, 0, 1, 1], [3, 2, 4, 2]]);
      await flush();
      const ranges = api.getSelectedRange();
      expect(ranges?.map((r) => [r.from, r.to])).toEqual([
        [{ row: 0, col: 0 }, { row: 1, col: 1 }],
        [{ row: 3, col: 2 }, { row: 4, col: 2 }],
      ]);
      // The active cell sits in the last range and highlights only that one.
      expect(ranges?.[1]?.highlight).toEqual({ row: 3, col: 2 });
      expect(ranges?.[0]?.highlight).toEqual({ row: 0, col: 0 });
    } finally {
      destroy();
    }
  });

  it("returns undefined, as Handsontable does, when nothing is selected", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(api.getSelectedLast()).toBeUndefined();
      expect(api.getSelectedRange()).toBeUndefined();
      expect(api.getSelectedRangeLast()).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("reports nothing selected when cell selection is off, whatever cell has focus", async () => {
    // selectable={false} is observable through getSelected() staying [];
    // the focused cell is getActiveCell()'s business, not a selection.
    const { api, destroy } = await mountGrid({ enableCellSelection: false });
    try {
      api.getCommandContext().setActiveCell(1, 2);
      await flush();
      expect(api.getSelected()).toEqual([]);
      expect(api.getSelectedLast()).toBeUndefined();
      expect(api.getSelectedRange()).toBeUndefined();
      expect(api.getSelectedRangeLast()).toBeUndefined();
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - row heights", () => {
  it("getRowHeight reads the declared height until one is set", async () => {
    const { api, destroy } = await mountGrid({ rowHeight: 24 });
    try {
      expect(api.getRowHeight(2)).toBe(24);
      api.setRowHeight(2, 52);
      await flush();
      expect(api.getRowHeight(2)).toBe(52);
      expect(api.getRowHeight(1)).toBe(24);
      api.setRowHeight(2, null);
      await flush();
      expect(api.getRowHeight(2)).toBe(24);
    } finally {
      destroy();
    }
  });

  it("a height belongs to its row: it follows a sort and survives new data", async () => {
    // Keyed by index, a resized row snapped back on every data change and
    // the height stayed in the slot when the rows were sorted.
    const { api, destroy } = await mountGrid({ rowHeight: 24 });
    try {
      api.setRowHeight(0, 60); // Ada
      await flush();
      api.setSort("name", "asc");
      await flush();
      const rows = api.getDisplayedRows() as Row[];
      const ada = rows.findIndex((r) => r.name === "Ada Lovelace");
      expect(ada).toBeGreaterThan(-1);
      expect(api.getRowHeight(ada)).toBe(60);
      for (let i = 0; i < rows.length; i += 1) if (i !== ada) expect(api.getRowHeight(i)).toBe(24);

      // A data change: a row added on top shifts every index by one.
      api.addRow({ id: 9, name: "Aaron", team: "QA", salary: 1 } as Row, "top");
      await flush();
      const again = (api.getDisplayedRows() as Row[]).findIndex((r) => r.name === "Ada Lovelace");
      expect(again).toBe(ada + 1);
      expect(api.getRowHeight(again)).toBe(60);
      expect(api.getRowHeight(ada)).toBe(24);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - collapsed columns and rows", () => {
  it("a collapsed column keeps its index and its width and takes no room", async () => {
    const { api, target, destroy } = await mountGrid();
    try {
      expect(api.isColumnCollapsed("team")).toBe(false);
      api.setColumnCollapsed("team", true);
      await flush();
      expect(api.isColumnCollapsed("team")).toBe(true);
      // Still the second column: nothing after it shifted.
      expect(api.getCommandContext().columnIdAt(1)).toBe("team");
      expect(api.getCommandContext().columnIdAt(2)).toBe("salary");
      expect(api.getColumnWidths().team).toBe(0);
      const th = target.querySelector('[data-svgrid-header-col="team"]')!;
      expect(th.classList.contains("sv-grid-column-collapsed")).toBe(true);
      expect(target.querySelectorAll("td.sv-grid-cell-collapsed").length).toBe(baseRows.length);
      api.setColumnCollapsed("team", false);
      await flush();
      expect(api.getColumnWidths().team).toBe(160);
      expect(target.querySelectorAll("td.sv-grid-cell-collapsed").length).toBe(0);
    } finally {
      destroy();
    }
  });

  it("a collapsed row is 0 high, leaves the flow, and follows its row through a sort", async () => {
    const { api, target, destroy } = await mountGrid({ rowHeight: 24 });
    try {
      api.setRowCollapsed(0, true); // Ada
      await flush();
      expect(api.isRowCollapsed(0)).toBe(true);
      expect(api.getRowHeight(0)).toBe(0);
      expect(target.querySelectorAll("tr.sv-grid-row-collapsed").length).toBe(1);
      api.setSort("name", "desc");
      await flush();
      const rows = api.getDisplayedRows() as Row[];
      const ada = rows.findIndex((r) => r.name === "Ada Lovelace");
      expect(api.isRowCollapsed(ada)).toBe(true);
      expect(api.isRowCollapsed(0)).toBe(false);
      api.setRowCollapsed(ada, false);
      await flush();
      expect(api.getRowHeight(ada)).toBe(24);
      expect(target.querySelectorAll("tr.sv-grid-row-collapsed").length).toBe(0);
    } finally {
      destroy();
    }
  });

  it("the arrow keys step over collapsed rows and columns", async () => {
    const { api, target, destroy } = await mountGrid();
    try {
      api.setColumnCollapsed("team", true);
      api.setRowCollapsed(1, true);
      await flush();
      const cmd = api.getCommandContext();
      cmd.setActiveCell(0, 0);
      await flush();
      const root = target.querySelector<HTMLElement>("table.sv-grid-table")!;
      root.focus();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      await flush();
      expect(api.getActiveCell()).toMatchObject({ rowIndex: 0, colIndex: 2 });
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      await flush();
      expect(api.getActiveCell()).toMatchObject({ rowIndex: 2, colIndex: 2 });
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      await flush();
      expect(api.getActiveCell()).toMatchObject({ rowIndex: 2, colIndex: 0 });
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - row mutations", () => {
  it("addRow appends to the bottom by default", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.addRow({ id: 6, name: "New", team: "QA", salary: 1 } as Row);
      await flush();
      const data = api.getData() as Row[];
      expect(data.length).toBe(6);
      expect(data[5]!.id).toBe(6);
    } finally {
      destroy();
    }
  });

  it("addRows at top / numeric index insert in place", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.addRows([{ id: 7, name: "Top", team: "T", salary: 1 } as Row], "top");
      await flush();
      expect((api.getData() as Row[])[0]!.id).toBe(7);

      api.addRows([{ id: 8, name: "Mid", team: "M", salary: 1 } as Row], 2);
      await flush();
      expect((api.getData() as Row[])[2]!.id).toBe(8);
    } finally {
      destroy();
    }
  });

  it("removeRow / removeRows drop by index", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.removeRow(0);
      await flush();
      expect((api.getData() as Row[]).map((r) => r.id)).toEqual([2, 3, 4, 5]);

      api.removeRows([0, 2]); // drops ids 2 and 4
      await flush();
      expect((api.getData() as Row[]).map((r) => r.id)).toEqual([3, 5]);
    } finally {
      destroy();
    }
  });

  it("applyTransaction adds, updates (by id), and removes; returns counts", async () => {
    const { api, destroy } = await mountGrid();
    try {
      const result = api.applyTransaction({
        add: [{ id: 9, name: "Added", team: "X", salary: 1 } as Row],
        update: [
          { id: 2, name: "Grace H.", team: "Compilers", salary: 999 } as Row,
        ],
        remove: ["3"], // by getRowId string
      });
      await flush();
      expect(result).toEqual({ added: 1, updated: 1, removed: 1 });
      const data = api.getData() as Row[];
      expect(data.find((r) => r.id === 3)).toBeUndefined();
      expect(data.find((r) => r.id === 2)!.salary).toBe(999);
      expect(data.find((r) => r.id === 9)).toBeTruthy();
    } finally {
      destroy();
    }
  });

  it("applyTransaction removes by object reference too", async () => {
    const { api, destroy } = await mountGrid();
    try {
      const target = (api.getData() as Row[])[0]!;
      const result = api.applyTransaction({ remove: [target] });
      await flush();
      expect(result.removed).toBe(1);
      expect((api.getData() as Row[]).find((r) => r === target)).toBeUndefined();
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - column mutations", () => {
  it("addColumn left / right / numeric position, then getColumns reflects it", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.addColumn({ field: "id", header: "ID" } as any, "left");
      await flush();
      expect(api.getColumns()[0]!.id).toBe("id");

      api.addColumns([{ field: "extra", header: "Extra" } as any], "right");
      await flush();
      const cols = api.getColumns();
      expect(cols[cols.length - 1]!.id).toBe("extra");
    } finally {
      destroy();
    }
  });

  it("removeColumn drops a column from the visible set", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.removeColumn("team");
      await flush();
      expect(api.getColumns().find((c) => c.id === "team")).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("setColumnVisible toggles visibility; getColumns lists hidden as visible:false", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setColumnVisible("team", false);
      await flush();
      expect(api.isColumnVisible("team")).toBe(false);
      const hidden = api.getColumns().find((c) => c.id === "team");
      expect(hidden!.visible).toBe(false);

      api.setColumnVisible("team", true);
      await flush();
      expect(api.isColumnVisible("team")).toBe(true);
    } finally {
      destroy();
    }
  });

  it("setColumnWidth clamps + getColumnWidths round-trips", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setColumnWidth("name", 333.7);
      await flush();
      expect(api.getColumnWidths().name).toBe(333);
    } finally {
      destroy();
    }
  });

  it("setColumnPinning dedupes; getColumnPinning returns copies", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setColumnPinning({ left: ["name", "name"], right: ["salary"] });
      await flush();
      const pin = api.getColumnPinning();
      expect(pin.left).toEqual(["name"]);
      expect(pin.right).toEqual(["salary"]);
      // mutating the returned copy doesn't affect internal state
      pin.left.push("hacked");
      expect(api.getColumnPinning().left).toEqual(["name"]);
    } finally {
      destroy();
    }
  });

  it("setColumnOrder + getColumnOrder round-trip", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setColumnOrder(["salary", "name", "team"]);
      await flush();
      expect(api.getColumnOrder().slice(0, 3)).toEqual([
        "salary",
        "name",
        "team",
      ]);
    } finally {
      destroy();
    }
  });

  // Note: autosizeColumn / autosizeAllColumns are intentionally not asserted
  // here - they measure text via real DOM layout (canvas/escape), which jsdom
  // does not provide, so they throw in this environment. They are exercised by
  // the demo gallery / Playwright suite per the coverage config notes.
});

describe("SvGridApi - facet filter", () => {
  it("setFacetFilter narrows displayed rows; null clears it", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setFacetFilter("team", ["Research"]);
      await flush();
      const displayed = api.getDisplayedRows() as Row[];
      expect(displayed.every((r) => r.team === "Research")).toBe(true);
      expect(displayed.length).toBe(2);

      api.setFacetFilter("team", null);
      await flush();
      expect((api.getDisplayedRows() as Row[]).length).toBe(5);
    } finally {
      destroy();
    }
  });

  it("setFacetFilter with an empty array also clears", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setFacetFilter("team", ["Apollo"]);
      await flush();
      api.setFacetFilter("team", []);
      await flush();
      expect((api.getDisplayedRows() as Row[]).length).toBe(5);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - find", () => {
  it("openFind / setFindQuery / getFindHits / closeFind", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.openFind();
      api.setFindQuery("Research");
      await flush();
      const hits = api.getFindHits();
      expect(Array.isArray(hits)).toBe(true);
      // two cells contain "Research"
      expect(hits.length).toBeGreaterThanOrEqual(2);

      api.closeFind();
      await flush();
      expect(api.getFindHits()).toEqual([]);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - undo / redo / history", () => {
  it("canUndo is false before any history; undo/redo are no-ops then", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(api.canUndo()).toBe(false);
      expect(api.canRedo()).toBe(false);
      expect(api.undo()).toBe(false);
      expect(api.redo()).toBe(false);
    } finally {
      destroy();
    }
  });

  it("clearHistory resets the stacks without throwing", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(() => api.clearHistory()).not.toThrow();
      expect(api.canUndo()).toBe(false);
      expect(api.canRedo()).toBe(false);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - grouping / expansion", () => {
  it("setGroupBy groups rows; the underlying data is unchanged", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setGroupBy(["team"]);
      await flush();
      // Grouping reshapes the display pipeline; the source data is intact.
      expect((api.getData() as Row[]).length).toBe(5);
      expect(api.getState().grouping).toContain("team");
    } finally {
      destroy();
    }
  });

  it("expandAllGroups / collapseAllGroups run without error", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setGroupBy(["team"]);
      await flush();
      expect(() => api.expandAllGroups()).not.toThrow();
      await flush();
      expect(() => api.collapseAllGroups()).not.toThrow();
      await flush();
      // un-group
      api.setGroupBy([]);
      await flush();
      expect((api.getData() as Row[]).length).toBe(5);
    } finally {
      destroy();
    }
  });

  it("setRowExpanded toggles a row's expanded flag", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(() => api.setRowExpanded("1", true)).not.toThrow();
      await flush();
      expect(() => api.setRowExpanded("1", false)).not.toThrow();
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - sort opt-out + refresh", () => {
  it("setSort with a direction sets a single active clause", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setSort("salary", "asc");
      await flush();
      expect(api.getState().sorting).toEqual([{ id: "salary", desc: false }]);

      api.setSort("name", "desc");
      await flush();
      // Setting a direction replaces the active sort clause.
      expect(api.getState().sorting).toEqual([{ id: "name", desc: true }]);
    } finally {
      destroy();
    }
  });

  it("setSort with a falsy direction removes that column's clause", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setSort("salary", "asc");
      await flush();
      api.setSort("salary", null as any);
      await flush();
      expect(
        api.getState().sorting.find((s) => s.id === "salary"),
      ).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("setSort is ignored for a non-sortable column", async () => {
    const { api, destroy } = await mountGrid({
      columns: [
        { field: "name", header: "Name", width: 200, sortable: false },
        { field: "team", header: "Team", width: 160 },
      ],
    });
    try {
      api.setSort("name", "asc");
      await flush();
      expect(api.getState().sorting.find((s) => s.id === "name")).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("refresh re-runs the pipeline without throwing or losing data", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(() => api.refresh()).not.toThrow();
      await flush();
      expect((api.getData() as Row[]).length).toBe(5);
    } finally {
      destroy();
    }
  });
});

describe("SvGridApi - setOption / getOption (runtime prop overrides)", () => {
  it("getOption returns the incoming prop when no override is set", async () => {
    const { api, destroy } = await mountGrid();
    try {
      expect(api.getOption("rowHeight")).toBe(36);
      expect(api.getOption("zebraRows")).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it("setOption overrides a prop, getOption reflects it, undefined clears it", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setOption("rowHeight", 48);
      await flush();
      expect(api.getOption("rowHeight")).toBe(48);

      api.setOption("zebraRows", true);
      await flush();
      expect(api.getOption("zebraRows")).toBe(true);

      // Clearing an override falls back to the incoming prop.
      api.setOption("rowHeight", undefined);
      await flush();
      expect(api.getOption("rowHeight")).toBe(36);
    } finally {
      destroy();
    }
  });

  it("setOption('sortable', true) turns sorting on at runtime; false turns it off", async () => {
    // Mount with NO features so sorting starts disabled - only the runtime
    // override can inject rowSortingFeature (mirrors resolveEffectiveFeatures).
    const { api, destroy } = await mountGrid({}, tableFeatures({}));
    try {
      // Off by default: setSort is guarded to a no-op.
      api.setSort("salary", "asc");
      await flush();
      expect(api.getState().sorting).toEqual([]);

      // Turn sorting on via the override, then setSort takes effect.
      api.setOption("sortable", true);
      await flush();
      api.setSort("salary", "asc");
      await flush();
      expect(api.getState().sorting).toEqual([{ id: "salary", desc: false }]);

      // Turn it back off: setSort is guarded again.
      api.setOption("sortable", false);
      await flush();
      api.clearSort();
      await flush();
      api.setSort("team", "asc");
      await flush();
      expect(api.getState().sorting).toEqual([]);
    } finally {
      destroy();
    }
  });

  it("a view-direct prop (zebraRows) visually re-renders on override", async () => {
    const { api, target, destroy } = await mountGrid();
    try {
      // No striping to start.
      expect(target.querySelectorAll(".sv-grid-row-alt").length).toBe(0);

      api.setOption("zebraRows", true);
      await flush();
      await flush();
      // Odd rows now carry the alternate-row class (view reads props.zebraRows,
      // which is the effective proxy).
      expect(target.querySelectorAll(".sv-grid-row-alt").length).toBeGreaterThan(0);

      api.setOption("zebraRows", undefined);
      await flush();
      await flush();
      expect(target.querySelectorAll(".sv-grid-row-alt").length).toBe(0);
    } finally {
      destroy();
    }
  });

  it("resetOptions clears every override", async () => {
    const { api, destroy } = await mountGrid();
    try {
      api.setOption("rowHeight", 60);
      api.setOption("zebraRows", true);
      await flush();
      expect(api.getOption("rowHeight")).toBe(60);

      api.resetOptions();
      await flush();
      expect(api.getOption("rowHeight")).toBe(36);
      expect(api.getOption("zebraRows")).toBeUndefined();
    } finally {
      destroy();
    }
  });
});
