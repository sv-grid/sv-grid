<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  // Kanban board renderer for SvGrid. Rendered in place of the table when the
  // `board` prop is set. Everything a board needs is built in here:
  //   - buckets rows into lanes by a field (explicit lanes or derived)
  //   - renders each row as a card (default template or a `card` snippet)
  //   - mouse drag-and-drop between and within lanes, with a live insertion
  //     marker, AND keyboard drag-and-drop (grab with Space, move with arrows)
  //   - the move itself (lane reassign + reorder) is computed and applied here
  //     as a per-row overlay keyed by row id, so consumers write no move code;
  //     `onCardMove` fires purely as a notification for persistence / mirroring
  // Themes entirely from the grid's `--sg-*` tokens.
  import { tick } from "svelte";
  import type {
    ColumnDef,
    RowData,
    TableFeatures,
    BoardConfig,
    BoardLane,
    BoardSubtask,
    BoardComment,
    MenuItem,
    FormField,
    FormFieldType,
  } from "@svgrid/grid";
  import {
    SvMenuList,
    SvForm,
    SvDrawer,
    portalToBody,
    popIn,
    createDismissableLayer,
  } from "@svgrid/grid";

  let {
    data,
    columns,
    board,
    getRowId,
  }: {
    data: ReadonlyArray<TData>;
    columns: Array<ColumnDef<TFeatures, TData>>;
    board: BoardConfig<TFeatures, TData>;
    getRowId?: (row: TData, index: number) => string;
  } = $props();

  const groupBy = $derived(board.groupBy);

  // --- value access (casts live here, never in the template) ---
  function fieldValue(row: TData, field: string): unknown {
    // Saved edits show immediately without mutating the consumer's rows.
    const e = edits[key(row)];
    if (e && field in e) return e[field];
    return (row as Record<string, unknown>)[field];
  }
  function rawLane(row: TData): string {
    const v = fieldValue(row, groupBy);
    return v == null ? "" : String(v);
  }
  function fmt(value: unknown): string {
    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  // --- stable per-row key (getRowId, else a synthetic id pinned to the row
  // object) so the move overlay survives data adds/removes and re-sorts ---
  const indexOf = $derived(new Map<TData, number>(data.map((r, i) => [r, i])));
  const synthetic = new WeakMap<object, string>();
  let synthSeq = 0;
  function key(row: TData): string {
    if (getRowId) return getRowId(row, indexOf.get(row) ?? 0);
    const obj = row as unknown as object;
    let id = synthetic.get(obj);
    if (!id) {
      id = `__b${++synthSeq}`;
      synthetic.set(obj, id);
    }
    return id;
  }

  // --- the move overlay: rowKey -> lane and rowKey -> sort order. Applied on
  // top of the data; never mutates the consumer's rows. The edit overlay does
  // the same for saved field values. ---
  let laneOf = $state<Record<string, string>>({});
  let orderOf = $state<Record<string, number>>({});
  let swimOf = $state<Record<string, string>>({});
  let edits = $state<Record<string, Record<string, unknown>>>({});
  let subDone = $state<Record<string, Record<string, boolean>>>({});
  let subAdded = $state<Record<string, BoardSubtask[]>>({});
  let laneOrder = $state<string[]>([]);
  let collapsedSwim = $state<Record<string, boolean>>({});

  function effectiveLane(row: TData): string {
    return laneOf[key(row)] ?? rawLane(row);
  }
  function ord(row: TData): number {
    return orderOf[key(row)] ?? (indexOf.get(row) ?? 0);
  }

  // --- swimlanes: an optional second axis (board.swimlaneBy). ---
  const swimField = $derived(board.swimlaneBy);
  function rawSwim(row: TData): string {
    if (!swimField) return "";
    const v = fieldValue(row, swimField);
    return v == null ? "" : String(v);
  }
  function effectiveSwim(row: TData): string {
    return swimOf[key(row)] ?? rawSwim(row);
  }
  const swimlanes = $derived.by<Array<{ id: string; title: string }>>(() => {
    if (!swimField) return [];
    const seen = new Set<string>();
    const out: Array<{ id: string; title: string }> = [];
    for (const row of data) {
      const k = rawSwim(row);
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ id: k, title: k === "" ? "(none)" : k });
      }
    }
    return out;
  });

  // --- lane collapse ---
  let collapsed = $state<Record<string, boolean>>({});
  function toggleCollapse(laneId: string) {
    if (board.collapsibleLanes) collapsed[laneId] = !collapsed[laneId];
  }
  function toggleSwim(swimId: string) {
    if (board.collapsibleSwimlanes) collapsedSwim[swimId] = !collapsedSwim[swimId];
  }

  // --- inline lane rename (board.onLaneRename) ---
  let renamingLane = $state<string | null>(null);
  let renameText = $state("");
  function startRename(lane: BoardLane) {
    if (!board.onLaneRename) return;
    renamingLane = lane.id;
    renameText = laneTitle(lane);
  }
  function commitRename(laneId: string) {
    const t = renameText.trim();
    renamingLane = null;
    if (t) board.onLaneRename?.(laneId, t);
  }

  // --- layout persistence: the overlay + collapse state, saved to
  // localStorage (persistKey) and/or emitted via onLayoutChange. Needs a
  // stable getRowId so the keys survive a reload. ---
  const canPersist = $derived(!!board.persistKey && !!getRowId);
  function serializeLayout() {
    return {
      laneOf: { ...laneOf },
      orderOf: { ...orderOf },
      swimOf: { ...swimOf },
      edits: { ...edits },
      collapsed: { ...collapsed },
      subDone: { ...subDone },
      subAdded: { ...subAdded },
      laneOrder: [...laneOrder],
      collapsedSwim: { ...collapsedSwim },
    };
  }
  // Restore once at init (before first paint).
  if (board.persistKey && getRowId && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(board.persistKey);
      if (raw) {
        const s = JSON.parse(raw);
        laneOf = s.laneOf ?? {};
        orderOf = s.orderOf ?? {};
        swimOf = s.swimOf ?? {};
        edits = s.edits ?? {};
        collapsed = s.collapsed ?? {};
        subDone = s.subDone ?? {};
        subAdded = s.subAdded ?? {};
        laneOrder = s.laneOrder ?? [];
        collapsedSwim = s.collapsedSwim ?? {};
      }
    } catch {
      /* ignore corrupt/blocked storage */
    }
  }
  let layoutLoaded = false;
  $effect(() => {
    const layout = serializeLayout(); // reads every map -> tracks changes
    // Skip the initial run so we don't rewrite what we just restored.
    if (!layoutLoaded) {
      layoutLoaded = true;
      return;
    }
    if (canPersist && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(board.persistKey as string, JSON.stringify(layout));
      } catch {
        /* ignore */
      }
    }
    board.onLayoutChange?.(layout);
  });

  // --- per-lane virtualization (fixed-height windowing) ---
  const virtualized = $derived(board.virtualized === true);
  const cardH = $derived(board.cardHeight ?? 76);
  const VOVERSCAN = 4;
  const VGAP = 8;
  let laneScroll = $state<Record<string, number>>({});
  let laneVh = $state<Record<string, number>>({});
  const laneBodyEl = new Map<string, HTMLElement>();
  function cellKey(laneId: string, swimId: string | null): string {
    return `${swimId ?? ""}::${laneId}`;
  }
  function laneWindow(laneId: string, swimId: string | null, count: number) {
    if (!virtualized) return { start: 0, end: count, top: 0, bottom: 0 };
    const ck = cellKey(laneId, swimId);
    const stride = cardH + VGAP;
    const scroll = laneScroll[ck] ?? 0;
    const vh = laneVh[ck] || 400;
    const start = Math.max(0, Math.floor(scroll / stride) - VOVERSCAN);
    const end = Math.min(count, Math.ceil((scroll + vh) / stride) + VOVERSCAN);
    return { start, end, top: start * stride, bottom: Math.max(0, (count - end) * stride) };
  }
  // Svelte action: track a lane body's scroll + height so windowing follows it.
  function trackLane(node: HTMLElement, ck: string) {
    laneBodyEl.set(ck, node);
    const update = () => {
      laneScroll[ck] = node.scrollTop;
      laneVh[ck] = node.clientHeight;
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(node);
    }
    return {
      update(nextCk: string) {
        laneBodyEl.delete(ck);
        ck = nextCk;
        laneBodyEl.set(ck, node);
        update();
      },
      destroy() {
        laneBodyEl.delete(ck);
        node.removeEventListener("scroll", update);
        ro?.disconnect();
      },
    };
  }

  // --- columns lookup + default title/meta fields ---
  const fieldColumns = $derived(
    columns.filter((c) => typeof c.field === "string"),
  );
  function headerLabel(field: string): string {
    const col = fieldColumns.find((c) => c.field === field);
    return col && typeof col.header === "string" ? col.header : field;
  }
  const titleField = $derived(
    board.titleField ?? (fieldColumns[0]?.field as string | undefined),
  );
  const metaFields = $derived.by(() => {
    if (board.cardFields) return board.cardFields.slice(0, 4);
    return fieldColumns
      .map((c) => c.field as string)
      .filter((f) => f !== titleField && f !== groupBy)
      .slice(0, 3);
  });

  // --- built-in card editor: fields come from columns with an editorType (or
  // all fields if none declare one). Edits go to the overlay + `onCardCommit`.
  const editable = $derived(board.editable === true);
  const editColumns = $derived.by(() => {
    const typed = fieldColumns.filter((c) => c.editorType);
    return (typed.length ? typed : fieldColumns).filter(
      (c) => c.field !== groupBy,
    );
  });
  function editorKind(col: (typeof editColumns)[number]): string {
    const t = col.editorType;
    if (t === "number") return "number";
    if (t === "checkbox") return "checkbox";
    if (t === "date") return "date";
    return "text";
  }

  let editingKey = $state<string | null>(null);
  let draft = $state<Record<string, unknown>>({});

  function openEditor(row: TData) {
    if (board.onCardEdit) {
      board.onCardEdit(row);
      return;
    }
    if (board.drawer) {
      drawerRow = row;
      return;
    }
    if (!editable) return;
    const next: Record<string, unknown> = {};
    for (const col of editColumns) {
      const f = col.field as string;
      next[f] = fieldValue(row, f);
    }
    draft = next;
    editingKey = key(row);
  }
  function saveEditor(row: TData) {
    const k = key(row);
    const changes: Record<string, unknown> = {};
    for (const col of editColumns) {
      const f = col.field as string;
      if (draft[f] !== fieldValue(row, f)) changes[f] = draft[f];
    }
    edits[k] = { ...(edits[k] ?? {}), ...draft };
    editingKey = null;
    board.onCardCommit?.({ row, changes, values: { ...draft } });
  }
  function cancelEditor() {
    editingKey = null;
    draft = {};
  }
  function onDraftInput(field: string, kind: string, e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    draft[field] =
      kind === "checkbox"
        ? el.checked
        : kind === "number"
          ? el.value === ""
            ? null
            : Number(el.value)
          : el.value;
  }

  // --- built-in detail drawer (board.drawer): an SvDrawer + SvForm of the
  // card's fields, rendered with the UI-kit editors. ---
  let drawerRow = $state.raw<TData | null>(null);
  const drawerCfg = $derived(
    board.drawer && typeof board.drawer === "object" ? board.drawer : null,
  );
  type DrawerCol = ColumnDef<TFeatures, TData>;
  const drawerFieldCols = $derived.by<DrawerCol[]>(() => {
    const wanted = drawerCfg?.fields;
    if (wanted && wanted.length) {
      return wanted
        .map((f) => fieldColumns.find((c) => c.field === f))
        .filter((c): c is DrawerCol => !!c);
    }
    return fieldColumns;
  });
  function formType(t: string | undefined): FormFieldType {
    switch (t) {
      case "number":
        return "number";
      case "checkbox":
        return "checkbox";
      case "date":
      case "date-native":
      case "datetime":
      case "datetime-native":
        return "date";
      case "textarea":
        return "textarea";
      case "password":
        return "password";
      case "color":
        return "color";
      case "list":
      case "select":
      case "rich-select":
        return "select";
      default:
        return "text";
    }
  }
  function drawerOptions(col: DrawerCol, row: TData) {
    const raw =
      typeof col.editorOptions === "function" ? col.editorOptions(row) : col.editorOptions;
    if (!raw) return undefined;
    return raw.map((o) =>
      typeof o === "object"
        ? { value: o.value, label: o.label ?? String(o.value) }
        : { value: o, label: String(o) },
    );
  }
  function drawerForm(row: TData): FormField[] {
    return drawerFieldCols.map((col) => {
      const f = col.field as string;
      const type = formType(col.editorType);
      return {
        name: f,
        label: typeof col.header === "string" ? col.header : f,
        type,
        options: type === "select" ? drawerOptions(col, row) : undefined,
      };
    });
  }
  function drawerInitial(row: TData): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of drawerFieldCols) {
      const f = col.field as string;
      out[f] = fieldValue(row, f);
    }
    return out;
  }
  function drawerTitleOf(row: TData): string {
    const t = drawerCfg?.title;
    if (typeof t === "function") return t(row);
    if (typeof t === "string") return t;
    return titleField ? fmt(fieldValue(row, titleField)) : "Details";
  }
  function onDrawerSubmit(row: TData, values: Record<string, unknown>) {
    const k = key(row);
    const changes: Record<string, unknown> = {};
    for (const [f, v] of Object.entries(values)) {
      if (v !== fieldValue(row, f)) changes[f] = v;
    }
    edits[k] = { ...(edits[k] ?? {}), ...values };
    board.onCardCommit?.({ row, changes, values });
    drawerRow = null;
  }

  // --- sub-tasks (checklist on a card). Toggles/adds live in an overlay so the
  // consumer's data is never mutated; callbacks notify. subDone/subAdded are
  // declared with the other overlays above (so persistence can read them). ---
  let subOpen = $state<Record<string, boolean>>({});
  let subSeq = 0;
  function baseSubtasks(row: TData): BoardSubtask[] {
    if (!board.subtasks) return [];
    const v = fieldValue(row, board.subtasks);
    return Array.isArray(v) ? (v as BoardSubtask[]) : [];
  }
  function subtasksOf(row: TData): BoardSubtask[] {
    const k = key(row);
    const overrides = subDone[k] ?? {};
    const base = baseSubtasks(row).map((s) =>
      String(s.id) in overrides ? { ...s, done: overrides[String(s.id)]! } : s,
    );
    return [...base, ...(subAdded[k] ?? [])];
  }
  function subProgress(row: TData): { done: number; total: number } {
    const list = subtasksOf(row);
    return { done: list.filter((s) => s.done).length, total: list.length };
  }
  function toggleSubtask(row: TData, sub: BoardSubtask) {
    const k = key(row);
    const next = !sub.done;
    const added = subAdded[k];
    const inAdded = added?.find((s) => String(s.id) === String(sub.id));
    if (inAdded) inAdded.done = next;
    else subDone[k] = { ...(subDone[k] ?? {}), [String(sub.id)]: next };
    board.onSubtaskToggle?.(row, sub.id, next);
  }
  function addSubtask(row: TData, title: string) {
    const t = title.trim();
    if (!t) return;
    const k = key(row);
    subAdded[k] = [...(subAdded[k] ?? []), { id: `s${++subSeq}`, title: t, done: false }];
    board.onSubtaskAdd?.(row, t);
  }

  // --- card badges (default card): labels, due date, assignees ---
  function labelsOf(row: TData): Array<{ text: string; color?: string }> {
    if (!board.labelsField) return [];
    const v = fieldValue(row, board.labelsField);
    if (!Array.isArray(v)) return [];
    return v.map((l) =>
      typeof l === "string" ? { text: l } : (l as { text: string; color?: string }),
    );
  }
  function assigneesOf(row: TData): string[] {
    if (!board.assigneesField) return [];
    const v = fieldValue(row, board.assigneesField);
    if (Array.isArray(v)) return v.map(String);
    return v == null ? [] : [String(v)];
  }
  function dueOf(row: TData): { label: string; overdue: boolean } | null {
    if (!board.dueField) return null;
    const v = fieldValue(row, board.dueField);
    if (v == null || v === "") return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return { label: String(v), overdue: false };
    const overdue = d.getTime() < todayStart;
    return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), overdue };
  }
  function initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }
  function countOf(row: TData, field: string | undefined): number {
    if (!field) return 0;
    const v = fieldValue(row, field);
    if (Array.isArray(v)) return v.length;
    if (typeof v === "number") return v;
    return 0;
  }
  function coverColorOf(row: TData): string | null {
    if (!board.coverField) return null;
    const v = fieldValue(row, board.coverField);
    return v == null || v === "" ? null : String(v);
  }
  const todayStart = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  })();
  function isFlagged(row: TData): boolean {
    return board.flagField ? !!fieldValue(row, board.flagField) : false;
  }
  function flagReason(row: TData): string | null {
    if (!board.flagField) return null;
    const v = fieldValue(row, board.flagField);
    return typeof v === "string" && v.trim() ? v : null;
  }
  // A blocked card is locked from moving unless flagBlocksMoves is false.
  const flagBlocksMoves = $derived(board.flagBlocksMoves !== false);
  function movable(row: TData): boolean {
    return !(flagBlocksMoves && isFlagged(row));
  }

  // --- comments (read / write / delete) ---
  let commentsOpen = $state<Record<string, boolean>>({});
  function commentsOf(row: TData): BoardComment[] {
    if (!board.commentsField) return [];
    const v = fieldValue(row, board.commentsField);
    if (!Array.isArray(v)) return [];
    return v.map((c, i) =>
      typeof c === "string"
        ? { id: i, text: c }
        : (c as BoardComment),
    );
  }
  function addComment(row: TData, text: string) {
    const t = text.trim();
    if (t) board.onCommentAdd?.(row, t);
  }
  function deleteComment(row: TData, id: string | number) {
    board.onCommentDelete?.(row, id);
  }
  function ageOf(row: TData): string | null {
    if (!board.ageField) return null;
    const v = fieldValue(row, board.ageField);
    if (v == null || v === "") return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.floor((todayStart - d.getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
  }

  // --- facet filter bar (board.facets) ---
  let facetSel = $state<Record<string, string[]>>({});
  function rowFacetValues(row: TData, field: string): string[] {
    const v = fieldValue(row, field);
    if (Array.isArray(v))
      return v.map((el) =>
        typeof el === "string" ? el : String((el as { text?: unknown }).text ?? el),
      );
    return v == null || v === "" ? [] : [String(v)];
  }
  function facetOptions(field: string): Array<{ value: string; count: number }> {
    const counts = new Map<string, number>();
    for (const row of data)
      for (const val of rowFacetValues(row, field)) counts.set(val, (counts.get(val) ?? 0) + 1);
    return [...counts.entries()].map(([value, count]) => ({ value, count }));
  }
  function toggleFacet(field: string, value: string) {
    const cur = facetSel[field] ?? [];
    facetSel[field] = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  }
  function clearFacets() {
    facetSel = {};
  }
  const anyFacet = $derived(Object.values(facetSel).some((a) => a.length > 0));
  function matchesFacets(row: TData): boolean {
    for (const [field, sel] of Object.entries(facetSel)) {
      if (!sel.length) continue;
      const vals = rowFacetValues(row, field);
      if (!sel.some((s) => vals.includes(s))) return false;
    }
    return true;
  }

  // --- multi-select (board.selectable) ---
  let selected = $state<Record<string, boolean>>({});
  function selectedRows(): TData[] {
    return data.filter((r) => selected[key(r)]);
  }
  function emitSelection() {
    board.onSelectionChange?.(selectedRows());
  }
  function onCardClick(e: MouseEvent, row: TData) {
    if (!board.selectable) return;
    const k = key(row);
    if (e.ctrlKey || e.metaKey) {
      selected[k] = !selected[k];
    } else {
      selected = { [k]: true };
    }
    emitSelection();
  }

  // --- child cards (board.childrenField) - epic -> stories ---
  let childOpen = $state<Record<string, boolean>>({});
  function childrenOf(row: TData): TData[] {
    if (!board.childrenField) return [];
    const v = fieldValue(row, board.childrenField);
    return Array.isArray(v) ? (v as TData[]) : [];
  }

  // --- quick-add composer (per lane) ---
  let composerOpen = $state<Record<string, boolean>>({});
  let composerText = $state<Record<string, string>>({});
  function submitComposer(laneId: string) {
    const t = (composerText[laneId] ?? "").trim();
    if (t) board.onCardAdd?.(laneId, t);
    composerText[laneId] = "";
  }
  function focusNode(node: HTMLElement) {
    node.focus();
  }

  // --- lane model: explicit lanes, else distinct field values (first-seen).
  // Derived from the RAW field, not the move overlay, so the lane order stays
  // stable when a card is moved. (Pass `lanes` to pin the order explicitly.) ---
  const lanes = $derived.by<BoardLane[]>(() => {
    let base: BoardLane[];
    if (board.lanes && board.lanes.length) {
      base = [...board.lanes];
    } else {
      const seen = new Set<string>();
      base = [];
      for (const row of data) {
        const k = rawLane(row);
        if (!seen.has(k)) {
          seen.add(k);
          base.push({ id: k, title: k === "" ? "(empty)" : k });
        }
      }
    }
    if (!laneOrder.length) return base;
    // Apply the drag-reorder overlay: ordered ids first, then any new lanes.
    const byId = new Map(base.map((l) => [l.id, l]));
    const ordered = laneOrder.map((id) => byId.get(id)).filter((l): l is BoardLane => !!l);
    const rest = base.filter((l) => !laneOrder.includes(l.id));
    return [...ordered, ...rest];
  });

  // --- lane drag-reorder (drag lane headers) ---
  let dragLaneId = $state<string | null>(null);
  let overLaneId = $state<string | null>(null);
  function onLaneHeaderDragStart(e: DragEvent, laneId: string) {
    dragLaneId = laneId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `lane:${laneId}`);
    }
  }
  function onLaneHeaderDragOver(e: DragEvent, laneId: string) {
    if (dragLaneId == null || laneId === dragLaneId) return;
    e.preventDefault();
    overLaneId = laneId;
  }
  function onLaneHeaderDrop(e: DragEvent, laneId: string) {
    if (dragLaneId == null) return;
    e.preventDefault();
    const ids = lanes.map((l) => l.id);
    const to = ids.indexOf(laneId);
    if (to > -1) reorderLaneTo(dragLaneId, to);
    dragLaneId = null;
    overLaneId = null;
  }
  function onLaneHeaderDragEnd() {
    dragLaneId = null;
    overLaneId = null;
  }

  // Shared by mouse drag-drop (above) and keyboard reorder (below): moves
  // `fromId` to `toIndex` in the lane order, persists it, and notifies.
  // Returns the new ordered ids, or null if the move was a no-op / invalid.
  function reorderLaneTo(fromId: string, toIndex: number): string[] | null {
    const ids = lanes.map((l) => l.id);
    const from = ids.indexOf(fromId);
    if (from < 0 || toIndex < 0 || toIndex >= ids.length || from === toIndex) return null;
    ids.splice(toIndex, 0, ids.splice(from, 1)[0]!);
    laneOrder = ids;
    board.onLaneReorder?.(ids);
    return ids;
  }
  // Keyboard lane reorder: Ctrl/Cmd+ArrowLeft/Right shifts the focused lane
  // header by one position, mirroring the drag-reorder above.
  function onLaneHeaderKeydown(e: KeyboardEvent, laneId: string) {
    if (!board.reorderableLanes) return;
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const ids = lanes.map((l) => l.id);
    const from = ids.indexOf(laneId);
    if (from < 0) return;
    const to = from + (e.key === "ArrowRight" ? 1 : -1);
    const moved = reorderLaneTo(laneId, to);
    if (moved) {
      const pos = moved.indexOf(laneId) + 1;
      announce(`Moved ${laneTitleById(laneId)} to position ${pos} of ${moved.length}.`);
    }
  }

  // Runtime group-by change: the position overlay (laneOf/orderOf/laneOrder) is
  // keyed to the old field, so reset it when `groupBy` changes. Edits and
  // sub-tasks (keyed by row) are kept. Skips the initial run so a restored
  // layout isn't wiped on mount.
  let gbInitialized = false;
  let prevGroupBy: string | undefined;
  $effect(() => {
    const g = groupBy;
    if (!gbInitialized) {
      gbInitialized = true;
      prevGroupBy = g;
      return;
    }
    if (g !== prevGroupBy) {
      prevGroupBy = g;
      laneOf = {};
      orderOf = {};
      laneOrder = [];
    }
  });

  function laneCards(laneId: string, swimId: string | null = null): TData[] {
    return data
      .filter(
        (r) =>
          effectiveLane(r) === laneId &&
          (swimId == null || effectiveSwim(r) === swimId) &&
          matchesFacets(r),
      )
      .sort((a, b) => ord(a) - ord(b));
  }
  function laneTitle(lane: BoardLane): string {
    return lane.title ?? (lane.id === "" ? "(empty)" : lane.id);
  }
  function laneWip(laneId: string): number | undefined {
    return lanes.find((l) => l.id === laneId)?.wipLimit ?? undefined;
  }
  function swimRows(swimId: string): TData[] {
    return data.filter((r) => effectiveSwim(r) === swimId && matchesFacets(r));
  }
  function swimCount(swimId: string): number {
    return swimRows(swimId).length;
  }

  // --- the one place a move is applied: compute the new order slot and record
  // it in the overlay, then notify. `pos` is the insertion index within the
  // destination lane (excluding the moved card). Returns false if rejected. ---
  function applyMove(
    row: TData,
    fromLane: string,
    toLane: string,
    pos: number,
    toSwim: string | null = null,
    fromSwim: string | null = null,
  ): boolean {
    const sameCell = fromLane === toLane && (toSwim == null || toSwim === fromSwim);
    // WIP enforcement: reject a move INTO a different lane past its limit.
    if (board.enforceWip && !sameCell) {
      const lim = laneWip(toLane);
      if (lim != null && laneCards(toLane, toSwim).filter((r) => r !== row).length >= lim) {
        announce(`${laneTitleById(toLane)} is at its WIP limit (${lim}).`);
        return false;
      }
    }
    const list = laneCards(toLane, toSwim).filter((r) => r !== row);
    const clamped = Math.max(0, Math.min(pos, list.length));
    if (sameCell) {
      const currentPos = laneCards(fromLane, toSwim).indexOf(row);
      if (currentPos === clamped) return false;
    }
    const before = list[clamped - 1];
    const after = list[clamped];
    let newOrd: number;
    if (before && after) newOrd = (ord(before) + ord(after)) / 2;
    else if (before) newOrd = ord(before) + 1;
    else if (after) newOrd = ord(after) - 1;
    else newOrd = 0;
    const k = key(row);
    laneOf[k] = toLane;
    orderOf[k] = newOrd;
    if (swimField && toSwim != null) swimOf[k] = toSwim;
    board.onCardMove?.({
      row,
      fromLane,
      toLane,
      toIndex: clamped,
      ...(swimField ? { fromSwimlane: fromSwim ?? undefined, toSwimlane: toSwim ?? undefined } : {}),
    });
    return true;
  }

  // --- mouse drag & drop ---
  // Row-holding state is `$state.raw` so the stored object keeps its identity
  // (plain `$state` would proxy it and break `row === dragRow` comparisons).
  let dragRow = $state.raw<TData | null>(null);
  let dragFromLane = $state<string | null>(null);
  let dragFromSwim = $state<string | null>(null);
  let overLane = $state<string | null>(null);
  let overSwim = $state<string | null>(null);
  let overRow = $state.raw<TData | null>(null);
  let overAfter = $state(false);

  function markerIndex(laneId: string, swimId: string | null, cards: TData[]): number {
    if (!dragRow || overLane !== laneId || overSwim !== swimId) return -1;
    if (!overRow) return cards.length;
    const i = cards.indexOf(overRow);
    if (i < 0) return cards.length;
    return overAfter ? i + 1 : i;
  }

  function onCardDragStart(e: DragEvent, row: TData, fromLane: string, fromSwim: string | null) {
    if (!movable(row)) {
      e.preventDefault();
      return;
    }
    // Dragging an unselected card (with multi-select on) reduces the selection
    // to just it, so the drag moves what the user grabbed.
    if (board.selectable && !selected[key(row)]) {
      selected = { [key(row)]: true };
      emitSelection();
    }
    dragRow = row;
    dragFromLane = fromLane;
    dragFromSwim = fromSwim;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", key(row));
    }
  }
  function onCardDragOver(e: DragEvent, row: TData, laneId: string, swimId: string | null) {
    if (!dragRow) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    overLane = laneId;
    overSwim = swimId;
    overRow = row;
    overAfter = e.clientY - rect.top > rect.height / 2;
  }
  function onLaneDragOver(e: DragEvent, laneId: string, swimId: string | null) {
    if (!dragRow) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    // Only claim the append slot when the pointer is over empty lane space
    // (a card's own handler stops propagation for the over-a-card case).
    if (e.target === e.currentTarget) {
      overLane = laneId;
      overSwim = swimId;
      overRow = null;
    }
  }
  function onLaneDrop(e: DragEvent, laneId: string, swimId: string | null) {
    e.preventDefault();
    const row = dragRow;
    const fromLane = dragFromLane;
    const fromSwim = dragFromSwim;
    const target = overRow;
    const after = overAfter;
    resetDrag();
    if (!row || fromLane == null) return;
    // Multi-select: dragging a selected card moves the whole selection.
    const multi = board.selectable && selected[key(row)] && selectedRows().length > 1;
    const movers = multi ? selectedRows() : [row];
    const moverKeys = new Set(movers.map((r) => key(r)));
    const rest = laneCards(laneId, swimId).filter((r) => !moverKeys.has(key(r)));
    let pos: number;
    if (!target || moverKeys.has(key(target))) pos = rest.length;
    else {
      const i = rest.indexOf(target);
      pos = i < 0 ? rest.length : after ? i + 1 : i;
    }
    movers.forEach((r, i) => applyMove(r, effectiveLane(r), laneId, pos + i, swimId, fromSwim));
  }
  function resetDrag() {
    dragRow = null;
    dragFromLane = null;
    dragFromSwim = null;
    overLane = null;
    overSwim = null;
    overRow = null;
    overAfter = false;
  }

  // --- keyboard drag & drop (grab with Space/Enter, move with arrows) ---
  let grabbed = $state.raw<TData | null>(null);
  let grabInfo: { lane: string; order: number; swim: string } | null = null;
  let liveMsg = $state("");

  function announce(msg: string) {
    liveMsg = msg;
  }

  function laneIndex(laneId: string): number {
    return lanes.findIndex((l) => l.id === laneId);
  }

  function onCardKeydown(e: KeyboardEvent, row: TData, laneId: string) {
    if (e.key === "F2" && (editable || board.onCardEdit || board.drawer)) {
      e.preventDefault();
      openEditor(row);
      return;
    }
    // Keyboard multi-select: Ctrl/Cmd+Space toggles this card's selection,
    // mirroring onCardClick's ctrl/meta-click branch. Kept on a modifier so it
    // never collides with plain Space, which grabs the card for a move.
    if (board.selectable && e.key === " " && (e.ctrlKey || e.metaKey) && grabbed == null) {
      e.preventDefault();
      const k = key(row);
      selected[k] = !selected[k];
      emitSelection();
      announce(
        `${selected[k] ? "Selected" : "Deselected"} ${cardLabel(row)}. ${selectedRows().length} selected.`,
      );
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbed === row) {
        announce(`Dropped ${cardLabel(row)} in ${laneTitleById(laneId)}.`);
        grabbed = null;
        grabInfo = null;
      } else if (!movable(row)) {
        announce(`${cardLabel(row)} is blocked and can't be moved.`);
      } else {
        grabbed = row;
        grabInfo = { lane: effectiveLane(row), order: ord(row), swim: effectiveSwim(row) };
        announce(
          `Grabbed ${cardLabel(row)}. Use arrow keys to move, Space to drop, Escape to cancel.`,
        );
      }
      return;
    }
    if (e.key === "Escape" && grabbed === row) {
      e.preventDefault();
      if (grabInfo) {
        const k = key(row);
        laneOf[k] = grabInfo.lane;
        orderOf[k] = grabInfo.order;
        if (swimField) swimOf[k] = grabInfo.swim;
      }
      grabbed = null;
      grabInfo = null;
      announce("Cancelled.");
      return;
    }
    const li = laneIndex(laneId);
    // Keyboard move/nav stays within the card's own swimlane band.
    const swim = swimField ? effectiveSwim(row) : null;
    if (grabbed === row) {
      // Grabbed: arrow keys MOVE the card (within its swimlane band).
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dest = lanes[e.key === "ArrowRight" ? li + 1 : li - 1];
        if (!dest) return;
        const pos = laneCards(dest.id, swim).filter((r) => r !== row).length;
        if (applyMove(row, laneId, dest.id, pos, swim, swim)) {
          announce(`Moved to ${laneTitle(dest)}.`);
          focusCardSoon(row);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const cards = laneCards(laneId, swim);
        const idx = cards.indexOf(row);
        const target = idx + (e.key === "ArrowDown" ? 1 : -1);
        if (target < 0 || target >= cards.length) return;
        // In the list excluding the moved card, `target` is the insertion slot
        // for both directions (indices shift by the card's own removal).
        applyMove(row, laneId, laneId, target, swim, swim);
        announce(`Moved ${e.key === "ArrowDown" ? "down" : "up"}.`);
        focusCardSoon(row);
      }
      return;
    }
    // Not grabbed: arrow keys MOVE FOCUS between cards and lanes.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const cards = laneCards(laneId, swim);
      const idx = cards.indexOf(row);
      const next = cards[idx + (e.key === "ArrowDown" ? 1 : -1)];
      if (next) focusCardEl(next);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dest = lanes[e.key === "ArrowRight" ? li + 1 : li - 1];
      if (!dest) return;
      const idx = Math.max(0, laneCards(laneId, swim).indexOf(row));
      const destCards = laneCards(dest.id, swim);
      const targetCard = destCards[Math.min(idx, destCards.length - 1)];
      if (targetCard) focusCardEl(targetCard);
    }
  }

  function cardLabel(row: TData): string {
    return titleField ? fmt(fieldValue(row, titleField)) : "card";
  }
  function laneTitleById(laneId: string): string {
    const l = lanes.find((x) => x.id === laneId);
    return l ? laneTitle(l) : laneId;
  }
  async function focusCardEl(row: TData) {
    let el = rootEl?.querySelector<HTMLElement>(
      `[data-card-key="${cssEscape(key(row))}"]`,
    );
    if (!el && virtualized) {
      // Off-screen in a virtualized lane: scroll it into view, then focus.
      const laneId = effectiveLane(row);
      const swimId = swimField ? effectiveSwim(row) : null;
      const idx = laneCards(laneId, swimId).indexOf(row);
      const body = laneBodyEl.get(cellKey(laneId, swimId));
      if (body && idx >= 0) {
        body.scrollTop = idx * (cardH + VGAP);
        laneScroll[cellKey(laneId, swimId)] = body.scrollTop;
        await tick();
        el = rootEl?.querySelector<HTMLElement>(
          `[data-card-key="${cssEscape(key(row))}"]`,
        );
      }
    }
    el?.focus();
  }
  async function focusCardSoon(row: TData) {
    // Re-focus the card after the DOM re-sorts so keyboard flow continues.
    await tick();
    focusCardEl(row);
  }
  function cssEscape(s: string): string {
    return s.replace(/["\\]/g, "\\$&");
  }

  let rootEl: HTMLDivElement | undefined;

  // --- card context menu (board.cardMenu) ---
  let menuOpen = $state(false);
  let menuPos = $state({ x: 0, y: 0 });
  let menuItems = $state.raw<ReadonlyArray<MenuItem>>([]);
  let menuPanel = $state<HTMLDivElement | null>(null);
  const MENU_W = 200;
  function showMenuAt(e: MouseEvent, items: ReadonlyArray<MenuItem>) {
    if (!items.length) return;
    e.preventDefault();
    e.stopPropagation();
    const estH = Math.min(items.length, 12) * 34 + 8;
    const x = Math.min(e.clientX, window.innerWidth - MENU_W - 6);
    const y = Math.min(e.clientY, window.innerHeight - estH - 6);
    menuPos = { x: Math.max(6, x), y: Math.max(6, y) };
    menuItems = items;
    menuOpen = true;
  }
  function openCardMenu(e: MouseEvent, row: TData) {
    if (!board.cardMenu) return;
    const swim = swimField ? effectiveSwim(row) : null;
    const items = board.cardMenu(row, {
      lanes,
      moveTo: (laneId: string) => {
        const pos = laneCards(laneId, swim).filter((r) => r !== row).length;
        applyMove(row, effectiveLane(row), laneId, pos, swim, swim);
      },
      edit: () => openEditor(row),
    });
    if (items) showMenuAt(e, items);
  }
  function openLaneMenu(e: MouseEvent, laneId: string, cards: TData[]) {
    if (!board.laneMenu) return;
    const items = board.laneMenu(laneId, {
      laneId,
      cards,
      collapsed: collapsed[laneId] === true,
      toggleCollapse: () => toggleCollapse(laneId),
      addCard: (title?: string) => board.onCardAdd?.(laneId, title),
    });
    if (items) showMenuAt(e, items);
  }
  $effect(() => {
    if (!menuOpen) return;
    queueMicrotask(() =>
      menuPanel?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus(),
    );
    const layer = createDismissableLayer({
      element: () => menuPanel,
      onDismiss: () => (menuOpen = false),
    });
    layer.activate();
    const onScroll = () => (menuOpen = false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      layer.release();
      window.removeEventListener("scroll", onScroll, true);
    };
  });
</script>

<div
  class="sv-board"
  class:is-swim={!!swimField}
  role="group"
  aria-label="Board"
  bind:this={rootEl}
>
  {#if board.facets && board.facets.length}
    <div class="sv-board-facets">
      {#each board.facets as field (field)}
        {#each facetOptions(field) as opt (field + ":" + opt.value)}
          <button
            type="button"
            class="sv-board-facet"
            class:is-active={(facetSel[field] ?? []).includes(opt.value)}
            onclick={() => toggleFacet(field, opt.value)}
          >
            {opt.value}<span class="sv-board-facet-count">{opt.count}</span>
          </button>
        {/each}
      {/each}
      {#if anyFacet}
        <button type="button" class="sv-board-facet-clear" onclick={clearFacets}>Clear filters</button>
      {/if}
    </div>
  {/if}

  {#if swimField}
    {#each swimlanes as swim (swim.id)}
      {@const swimCollapsed = collapsedSwim[swim.id] === true}
      <section class="sv-board-swim" aria-label={swim.title}>
        <header class="sv-board-swim-head">
          {#if board.collapsibleSwimlanes}
            <button
              type="button"
              class="sv-board-swim-toggle"
              aria-expanded={!swimCollapsed}
              aria-label={swimCollapsed ? `Expand ${swim.title}` : `Collapse ${swim.title}`}
              onclick={() => toggleSwim(swim.id)}>{swimCollapsed ? "▸" : "▾"}</button
            >
          {/if}
          <span class="sv-board-swim-title">{swim.title}</span>
          <span class="sv-board-swim-count">{swimCount(swim.id)}</span>
          {#if board.swimlaneSummary}
            <span class="sv-board-swim-summary">{board.swimlaneSummary(swimRows(swim.id), swim.id)}</span>
          {/if}
        </header>
        {#if !swimCollapsed}
          <div class="sv-board-lanes">
            {#each lanes as lane (lane.id)}
              {@render laneCol(lane, swim.id)}
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {:else}
    <div class="sv-board-lanes">
      {#each lanes as lane (lane.id)}
        {@render laneCol(lane, null)}
      {/each}
    </div>
  {/if}

  <div class="sv-board-sr" aria-live="polite" role="status">{liveMsg}</div>
</div>

{#if menuOpen}
  <div
    bind:this={menuPanel}
    class="sv-board-ctx"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${menuPos.y}px`}
    style:left={`${menuPos.x}px`}
    aria-label="Card actions"
  >
    <SvMenuList items={menuItems} onclose={() => (menuOpen = false)} onselect={() => (menuOpen = false)} />
  </div>
{/if}

{#if drawerRow}
  {@const dr = drawerRow}
  <SvDrawer
    open
    onClose={() => (drawerRow = null)}
    side={drawerCfg?.side ?? "right"}
    size={drawerCfg?.size ?? "380px"}
    title={drawerTitleOf(dr)}
    closeOnBackdrop={false}
  >
    {#key key(dr)}
      <SvForm
        fields={drawerForm(dr)}
        initial={drawerInitial(dr)}
        columns={drawerCfg?.columns ?? 1}
        submitLabel={drawerCfg?.submitLabel ?? "Save"}
        onSubmit={(values) => onDrawerSubmit(dr, values)}
      />
      {#if board.commentsField}
        <div class="sv-board-drawer-comments">
          <div class="sv-board-drawer-h">Comments</div>
          {@render commentThread(dr)}
        </div>
      {/if}
    {/key}
  </SvDrawer>
{/if}

{#snippet commentThread(row: TData)}
  {@const cmts = commentsOf(row)}
  {#each cmts as c (c.id)}
    <div class="sv-board-comment">
      <div class="sv-board-comment-body">
        {#if c.author}<span class="sv-board-comment-author">{c.author}</span>{/if}
        <span class="sv-board-comment-text">{c.text}</span>
        {#if c.at}<span class="sv-board-comment-at">{c.at}</span>{/if}
      </div>
      {#if board.onCommentDelete}
        <button
          type="button"
          class="sv-board-comment-del"
          aria-label="Delete comment"
          onclick={() => deleteComment(row, c.id)}>×</button
        >
      {/if}
    </div>
  {/each}
  {#if !cmts.length}
    <div class="sv-board-comment-empty">No comments yet.</div>
  {/if}
  {#if board.onCommentAdd}
    <input
      class="sv-board-comment-add"
      placeholder="Write a comment..."
      onkeydown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const el = e.currentTarget;
          addComment(row, el.value);
          el.value = "";
        }
      }}
    />
  {/if}
{/snippet}

{#snippet laneCol(lane: BoardLane, swimId: string | null)}
  {@const cards = laneCards(lane.id, swimId)}
  {@const over = lane.wipLimit != null && cards.length > lane.wipLimit}
  {@const mark = markerIndex(lane.id, swimId, cards)}
  {@const isCollapsed = collapsed[lane.id] === true}
  <section
    class="sv-board-lane"
    class:is-collapsed={isCollapsed}
    style={lane.color ? `--sv-board-accent: ${lane.color};` : undefined}
    aria-label={laneTitle(lane)}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header
      class="sv-board-lane-head"
      class:is-reorderable={board.reorderableLanes}
      class:is-lane-dropover={overLaneId === lane.id && dragLaneId !== lane.id}
      draggable={board.reorderableLanes ? true : undefined}
      tabindex={board.reorderableLanes ? 0 : undefined}
      role={board.reorderableLanes ? "group" : undefined}
      aria-roledescription={board.reorderableLanes ? "Reorderable lane" : undefined}
      title={board.reorderableLanes ? "Ctrl+Left/Right arrow to reorder this lane" : undefined}
      ondragstart={board.reorderableLanes ? (e) => onLaneHeaderDragStart(e, lane.id) : undefined}
      ondragover={board.reorderableLanes ? (e) => onLaneHeaderDragOver(e, lane.id) : undefined}
      ondrop={board.reorderableLanes ? (e) => onLaneHeaderDrop(e, lane.id) : undefined}
      ondragend={board.reorderableLanes ? onLaneHeaderDragEnd : undefined}
      onkeydown={board.reorderableLanes ? (e) => onLaneHeaderKeydown(e, lane.id) : undefined}
      oncontextmenu={board.laneMenu ? (e) => openLaneMenu(e, lane.id, cards) : undefined}
    >
      {#if board.collapsibleLanes}
        <button
          type="button"
          class="sv-board-lane-toggle"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? `Expand ${laneTitle(lane)}` : `Collapse ${laneTitle(lane)}`}
          onclick={() => toggleCollapse(lane.id)}>{isCollapsed ? "▸" : "▾"}</button
        >
      {/if}
      {#if renamingLane === lane.id}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="sv-board-lane-rename"
          bind:value={renameText}
          use:focusNode
          onkeydown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename(lane.id); }
            else if (e.key === "Escape") { renamingLane = null; }
          }}
          onblur={() => commitRename(lane.id)}
        />
      {:else if board.onLaneRename}
        <button
          type="button"
          class="sv-board-lane-title is-renamable"
          ondblclick={() => startRename(lane)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === "F2") {
              e.preventDefault();
              startRename(lane);
            }
          }}
          title="Double-click, Enter, or F2 to rename"
        >{laneTitle(lane)}</button>
      {:else}
        <span class="sv-board-lane-title">{laneTitle(lane)}</span>
      {/if}
      <span
        class="sv-board-lane-count"
        class:is-over={over}
        title={lane.wipLimit != null ? `WIP limit ${lane.wipLimit}` : undefined}
      >
        {cards.length}{#if lane.wipLimit != null}/{lane.wipLimit}{/if}
      </span>
      {#if board.laneSummary && !isCollapsed}
        <span class="sv-board-lane-summary">{board.laneSummary(cards, lane.id)}</span>
      {/if}
      {#if board.onCardAdd && !isCollapsed}
        <button
          type="button"
          class="sv-board-lane-add"
          aria-label={`Add card to ${laneTitle(lane)}`}
          onclick={() => board.onCardAdd?.(lane.id)}>+</button
        >
      {/if}
    </header>

    {#if !isCollapsed}
      {@const win = laneWindow(lane.id, swimId, cards.length)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sv-board-lane-body"
        class:is-virtual={virtualized}
        role="list"
        class:is-dropover={overLane === lane.id && overSwim === swimId}
        use:trackLane={cellKey(lane.id, swimId)}
        ondragover={(e) => onLaneDragOver(e, lane.id, swimId)}
        ondrop={(e) => onLaneDrop(e, lane.id, swimId)}
      >
        {#if win.top > 0}
          <div style={`height:${win.top}px`} aria-hidden="true"></div>
        {/if}
        {#each cards.slice(win.start, win.end) as row, i (key(row))}
          {@const index = win.start + i}
          {#if mark === index}
            <div class="sv-board-drop-marker" aria-hidden="true"></div>
          {/if}
          {@const isEditing = editingKey === key(row)}
          <article
            class="sv-board-card"
            class:is-dragging={dragRow === row}
            class:is-grabbed={grabbed === row}
            class:is-editing={isEditing}
            class:is-flagged={isFlagged(row)}
            class:is-locked={!movable(row)}
            class:is-selected={board.selectable && selected[key(row)]}
            role="listitem"
            tabindex="0"
            data-card-key={key(row)}
            aria-roledescription="Draggable card"
            aria-grabbed={grabbed === row}
            aria-selected={board.selectable ? !!selected[key(row)] : undefined}
            draggable={!isEditing && movable(row)}
            ondragstart={(e) => onCardDragStart(e, row, lane.id, swimId)}
            ondragover={(e) => onCardDragOver(e, row, lane.id, swimId)}
            ondragend={resetDrag}
            onclick={board.selectable ? (e) => onCardClick(e, row) : undefined}
            ondblclick={() => openEditor(row)}
            oncontextmenu={board.cardMenu ? (e) => openCardMenu(e, row) : undefined}
            onkeydown={(e) => onCardKeydown(e, row, lane.id)}
          >
            {#if isFlagged(row)}<span class="sv-board-card-flag" aria-label="Blocked"></span>{/if}
            {#if isEditing}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <form
                class="sv-board-card-edit"
                onsubmit={(e) => {
                  e.preventDefault();
                  saveEditor(row);
                }}
                onkeydown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    cancelEditor();
                  }
                }}
              >
                {#each editColumns as col (col.field)}
                  {@const kind = editorKind(col)}
                  <label class="sv-board-field">
                    <span>{headerLabel(col.field ?? "")}</span>
                    {#if kind === "checkbox"}
                      <input
                        type="checkbox"
                        checked={draft[col.field ?? ""] === true}
                        oninput={(e) => onDraftInput(col.field ?? "", kind, e)}
                      />
                    {:else}
                      <!-- svelte-ignore a11y_autofocus -->
                      <input
                        type={kind}
                        value={draft[col.field ?? ""] ?? ""}
                        oninput={(e) => onDraftInput(col.field ?? "", kind, e)}
                      />
                    {/if}
                  </label>
                {/each}
                <div class="sv-board-card-edit-actions">
                  <button type="button" class="sv-board-btn" onclick={cancelEditor}>Cancel</button>
                  <button type="submit" class="sv-board-btn is-primary">Save</button>
                </div>
              </form>
            {:else if board.card}
              {@render board.card(row)}
              {@render cardBadges(row)}
            {:else}
              {@const cover = coverColorOf(row)}
              {#if cover}
                <div class="sv-board-card-cover" style={`background:${cover}`} aria-hidden="true"></div>
              {/if}
              {#if titleField}
                <div class="sv-board-card-title">
                  {fmt(fieldValue(row, titleField))}
                </div>
              {/if}
              {@render cardBadges(row)}
              {#if metaFields.length}
                <dl class="sv-board-card-meta">
                  {#each metaFields as field (field)}
                    {@const v = fmt(fieldValue(row, field))}
                    {#if v !== ""}
                      <div class="sv-board-card-metarow">
                        <dt>{headerLabel(field)}</dt>
                        <dd>{v}</dd>
                      </div>
                    {/if}
                  {/each}
                </dl>
              {/if}
            {/if}

            {#if !isEditing && board.subtasks}
              {@const prog = subProgress(row)}
              {@const opened = subOpen[key(row)] === true}
              <div class="sv-board-subs">
                <button
                  type="button"
                  class="sv-board-subs-head"
                  aria-expanded={opened}
                  onclick={() => (subOpen[key(row)] = !opened)}
                >
                  <span class="sv-board-subs-chev">{opened ? "▾" : "▸"}</span>
                  <span class="sv-board-subs-count">{prog.done}/{prog.total}</span>
                  <span class="sv-board-subs-bar" aria-hidden="true">
                    <span style={`width:${prog.total ? (prog.done / prog.total) * 100 : 0}%`}></span>
                  </span>
                </button>
                {#if opened}
                  <ul class="sv-board-subs-list">
                    {#each subtasksOf(row) as st (st.id)}
                      <li>
                        <label class:is-done={st.done}>
                          <input type="checkbox" checked={st.done} onchange={() => toggleSubtask(row, st)} />
                          <span>{st.title}</span>
                        </label>
                      </li>
                    {/each}
                  </ul>
                  <input
                    class="sv-board-subs-add"
                    placeholder="Add subtask..."
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const el = e.currentTarget;
                        addSubtask(row, el.value);
                        el.value = "";
                      }
                    }}
                  />
                {/if}
              </div>
            {/if}

            {#if !isEditing && board.childrenField}
              {@const kids = childrenOf(row)}
              {#if kids.length}
                {@const kidsOpen = childOpen[key(row)] === true}
                <div class="sv-board-kids">
                  <button
                    type="button"
                    class="sv-board-kids-head"
                    aria-expanded={kidsOpen}
                    onclick={() => (childOpen[key(row)] = !kidsOpen)}
                  >
                    <span class="sv-board-subs-chev">{kidsOpen ? "▾" : "▸"}</span>
                    {kids.length}
                    {kids.length === 1 ? "subtask" : "subtasks"}
                  </button>
                  {#if kidsOpen}
                    <ul class="sv-board-kids-list">
                      {#each kids as kid, ki (key(kid) + ":" + ki)}
                        <li class="sv-board-kid">
                          <span class="sv-board-kid-title"
                            >{titleField ? fmt(fieldValue(kid, titleField)) : ""}</span
                          >
                          <span class="sv-board-kid-lane">{rawLane(kid)}</span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/if}
            {/if}

            {#if !isEditing && board.commentsField && commentsOpen[key(row)]}
              <div class="sv-board-comments">
                {@render commentThread(row)}
              </div>
            {/if}
          </article>
        {/each}
        {#if win.bottom > 0}
          <div style={`height:${win.bottom}px`} aria-hidden="true"></div>
        {:else if mark === cards.length}
          <div class="sv-board-drop-marker" aria-hidden="true"></div>
        {/if}
        {#if cards.length === 0}
          <div class="sv-board-lane-empty">No cards</div>
        {/if}
      </div>
      {#if board.composer && board.onCardAdd}
        {#if composerOpen[lane.id]}
          <input
            class="sv-board-composer-input"
            placeholder="Card title..."
            bind:value={composerText[lane.id]}
            use:focusNode
            onkeydown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitComposer(lane.id);
              } else if (e.key === "Escape") {
                composerOpen[lane.id] = false;
              }
            }}
            onblur={() => {
              submitComposer(lane.id);
              composerOpen[lane.id] = false;
            }}
          />
        {:else}
          <button
            type="button"
            class="sv-board-composer-btn"
            onclick={() => (composerOpen[lane.id] = true)}>+ Add a card</button
          >
        {/if}
      {/if}
    {/if}
  </section>
{/snippet}

{#snippet cardBadges(row: TData)}
  {@const labels = labelsOf(row)}
  {@const due = dueOf(row)}
  {@const asg = assigneesOf(row)}
  {@const comments = countOf(row, board.commentsField)}
  {@const attachments = countOf(row, board.attachmentsField)}
  {@const age = ageOf(row)}
  {@const blocked = isFlagged(row)}
  {#if blocked || labels.length || due || asg.length || comments || attachments || age}
    <div class="sv-board-badges">
      {#if blocked}
        <span class="sv-board-badge is-blocked" title={flagReason(row) ?? "Blocked"}>Blocked</span>
      {/if}
      {#each labels as lb (lb.text)}
        <span class="sv-board-badge is-label" style={lb.color ? `--b:${lb.color}` : undefined}
          >{lb.text}</span
        >
      {/each}
      {#if due}
        <span class="sv-board-badge is-due" class:is-overdue={due.overdue}>{due.label}</span>
      {/if}
      {#if age}
        <span class="sv-board-badge is-meta" title="Age">{age}</span>
      {/if}
      {#if comments || board.onCommentAdd}
        <button
          type="button"
          class="sv-board-badge is-meta is-btn"
          title="Comments"
          onclick={(e) => {
            e.stopPropagation();
            commentsOpen[key(row)] = !commentsOpen[key(row)];
          }}
        >
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M2 3h12v8H8l-3 2v-2H2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          {comments}
        </button>
      {/if}
      {#if attachments}
        <span class="sv-board-badge is-meta" title={`${attachments} attachments`}>
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M11 5.5 6.5 10a2 2 0 0 1-3-3l5-5a3 3 0 0 1 4 4l-5 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {attachments}
        </span>
      {/if}
      {#if asg.length}
        <span class="sv-board-avatars">
          {#each asg.slice(0, 3) as name (name)}
            <span class="sv-board-avatar" title={name}>{initials(name)}</span>
          {/each}
        </span>
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  .sv-board {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
    font-family: var(--sg-font, inherit);
  }
  .sv-board.is-swim {
    overflow-y: auto;
    gap: 14px;
  }
  .sv-board-lanes {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    overflow-x: auto;
    padding: 4px;
    flex: 1 1 auto;
    min-height: 0;
    scrollbar-color: var(--sg-scrollbar-thumb, color-mix(in srgb, var(--sg-fg, #101828) 28%, transparent))
      transparent;
  }
  .sv-board.is-swim .sv-board-lanes {
    flex: none;
  }
  .sv-board.is-swim .sv-board-lane {
    max-height: 340px;
  }
  .sv-board-swim {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: none;
  }
  .sv-board-swim-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-weight: 700;
    font-size: 0.78rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 78%, transparent);
    position: sticky;
    left: 0;
  }
  .sv-board-swim-count {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-swim-summary {
    font-size: 0.7rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--sg-accent, #3b82f6) 85%, var(--sg-fg, #101828));
  }
  .sv-board-swim-toggle {
    all: unset;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 2px;
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-lane-title.is-renamable {
    all: unset;
    cursor: text;
    font-weight: 600;
    font-size: 0.82rem;
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  .sv-board-lane-rename {
    flex: 1 1 auto;
    min-width: 0;
    font: inherit;
    font-weight: 600;
    font-size: 0.82rem;
    padding: 1px 4px;
    border: 1px solid var(--sv-board-accent);
    border-radius: 5px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
  }
  .sv-board-swim-toggle:hover {
    color: var(--sg-fg, #101828);
  }
  .sv-board-lane {
    flex: 0 0 var(--sg-board-lane-w, 272px);
    max-width: var(--sg-board-lane-w, 272px);
    display: flex;
    flex-direction: column;
    max-height: 100%;
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: var(--sg-radius, 8px);
    background: var(--sg-header-bg, color-mix(in srgb, var(--sg-fg, #101828) 3%, var(--sg-bg, #fff)));
    --sv-board-accent: var(--sg-accent, #3b82f6);
  }
  .sv-board-lane-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--sg-border, #e4e7ec);
    border-top: 3px solid var(--sv-board-accent);
    border-radius: var(--sg-radius, 8px) var(--sg-radius, 8px) 0 0;
  }
  .sv-board-lane-head.is-reorderable {
    cursor: grab;
  }
  .sv-board-lane-head.is-lane-dropover {
    box-shadow: inset 3px 0 0 var(--sv-board-accent);
  }
  .sv-board-lane-title {
    font-weight: 600;
    font-size: 0.82rem;
    flex: 1 1 auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sv-board-lane-toggle {
    all: unset;
    cursor: pointer;
    font-size: 0.7rem;
    line-height: 1;
    color: color-mix(in srgb, var(--sg-fg, #101828) 55%, transparent);
    padding: 2px;
  }
  .sv-board-lane-toggle:hover {
    color: var(--sg-fg, #101828);
  }
  .sv-board-lane.is-collapsed {
    flex: 0 0 auto;
    max-width: none;
  }
  .sv-board-lane.is-collapsed .sv-board-lane-head {
    writing-mode: vertical-rl;
    height: 180px;
    border-top: none;
    border-left: 3px solid var(--sv-board-accent);
    border-radius: 0 var(--sg-radius, 8px) var(--sg-radius, 8px) 0;
    gap: 6px;
  }
  .sv-board-lane-count {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    color: color-mix(in srgb, var(--sg-fg, #101828) 70%, transparent);
  }
  .sv-board-lane-count.is-over {
    background: color-mix(in srgb, var(--sg-danger, #ef4444) 16%, transparent);
    color: var(--sg-danger, #ef4444);
    font-weight: 700;
  }
  .sv-board-lane-summary {
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--sv-board-accent) 85%, var(--sg-fg, #101828));
  }
  .sv-board-lane-add {
    all: unset;
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 5px;
    font-size: 1rem;
    line-height: 1;
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-lane-add:hover {
    background: color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    color: var(--sg-fg, #101828);
  }
  .sv-board-lane-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 48px;
    transition: background 0.12s ease;
  }
  .sv-board-lane-body.is-dropover {
    background: color-mix(in srgb, var(--sv-board-accent) 8%, transparent);
  }
  /* Virtualized lanes use block flow + per-card margin (not flex gap) so the
     spacer heights match the windowing math exactly. */
  .sv-board-lane-body.is-virtual {
    display: block;
    gap: 0;
  }
  .sv-board-lane-body.is-virtual .sv-board-card {
    margin-bottom: 8px;
  }
  .sv-board-card {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: var(--sg-radius, 8px);
    padding: 9px 11px;
    cursor: grab;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
    transition:
      box-shadow 0.12s ease,
      opacity 0.12s ease,
      transform 0.12s ease;
  }
  .sv-board-card:hover {
    box-shadow: 0 2px 8px rgba(16, 24, 40, 0.12);
    border-color: color-mix(in srgb, var(--sv-board-accent) 45%, var(--sg-border, #e4e7ec));
  }
  .sv-board-card:focus-visible {
    outline: none;
    border-color: var(--sv-board-accent);
    box-shadow: var(--sg-focus-ring, 0 0 0 2px color-mix(in srgb, var(--sv-board-accent) 45%, transparent));
  }
  .sv-board-card.is-dragging {
    opacity: 0.45;
  }
  .sv-board-card.is-grabbed {
    border-color: var(--sv-board-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sv-board-accent) 55%, transparent);
    cursor: grabbing;
  }
  .sv-board-card.is-editing {
    cursor: default;
    border-color: var(--sv-board-accent);
  }
  .sv-board-card-edit {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .sv-board-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.72rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-field input[type="text"],
  .sv-board-field input[type="number"],
  .sv-board-field input[type="date"] {
    font: inherit;
    font-size: 0.8rem;
    padding: 4px 7px;
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
  }
  .sv-board-field input:focus-visible {
    outline: none;
    border-color: var(--sv-board-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sv-board-accent) 35%, transparent);
  }
  .sv-board-field input[type="checkbox"] {
    align-self: flex-start;
    width: 15px;
    height: 15px;
    accent-color: var(--sv-board-accent);
  }
  .sv-board-card-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }
  .sv-board-btn {
    font: inherit;
    font-size: 0.74rem;
    padding: 3px 10px;
    border-radius: var(--sg-radius, 6px);
    border: 1px solid var(--sg-border, #e4e7ec);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
    cursor: pointer;
  }
  .sv-board-btn:hover {
    background: color-mix(in srgb, var(--sg-fg, #101828) 6%, transparent);
  }
  .sv-board-btn.is-primary {
    background: var(--sv-board-accent);
    border-color: var(--sv-board-accent);
    color: #fff;
  }
  .sv-board-btn.is-primary:hover {
    filter: brightness(0.95);
  }
  .sv-board-card-title {
    font-weight: 600;
    font-size: 0.84rem;
    line-height: 1.3;
  }
  .sv-board-card-meta {
    margin: 6px 0 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sv-board-card-metarow {
    display: flex;
    gap: 6px;
    font-size: 0.74rem;
  }
  .sv-board-card-metarow dt {
    color: color-mix(in srgb, var(--sg-fg, #101828) 55%, transparent);
    margin: 0;
  }
  .sv-board-card-metarow dd {
    margin: 0;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-board-lane-empty {
    text-align: center;
    font-size: 0.76rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 42%, transparent);
    padding: 14px 0;
    border: 1px dashed var(--sg-border, #e4e7ec);
    border-radius: var(--sg-radius, 8px);
  }
  .sv-board-drop-marker {
    height: 2px;
    border-radius: 2px;
    background: var(--sv-board-accent);
    margin: -3px 0;
  }
  :global(.sv-board-ctx) {
    z-index: 2147483646;
    min-width: 200px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35);
    font-size: 13px;
  }
  .sv-board-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  /* Card badges */
  .sv-board-badges {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .sv-board-badge {
    font-size: 0.66rem;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    line-height: 1.5;
    white-space: nowrap;
  }
  .sv-board-badge.is-label {
    --b: var(--sv-board-accent);
    background: color-mix(in srgb, var(--b) 16%, transparent);
    color: color-mix(in srgb, var(--b) 80%, var(--sg-fg, #101828));
  }
  .sv-board-badge.is-due {
    background: color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    color: color-mix(in srgb, var(--sg-fg, #101828) 65%, transparent);
  }
  .sv-board-badge.is-due.is-overdue {
    background: color-mix(in srgb, var(--sg-danger, #ef4444) 15%, transparent);
    color: var(--sg-danger, #ef4444);
  }
  .sv-board-badge.is-meta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: transparent;
    padding: 1px 3px;
    color: color-mix(in srgb, var(--sg-fg, #101828) 55%, transparent);
  }
  .sv-board-badge.is-btn {
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 0.66rem;
    font-weight: 600;
    border-radius: 5px;
  }
  .sv-board-badge.is-btn:hover {
    background: color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    color: var(--sg-fg, #101828);
  }
  .sv-board-badge.is-blocked {
    background: var(--sg-danger, #ef4444);
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 0.6rem;
  }
  /* Comments thread */
  .sv-board-comments {
    margin-top: 7px;
    border-top: 1px solid color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    padding-top: 7px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .sv-board-drawer-comments {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--sg-border, #e4e7ec);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sv-board-drawer-h {
    font-weight: 600;
    font-size: 0.82rem;
    margin-bottom: 2px;
  }
  .sv-board-comment {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 0.74rem;
  }
  .sv-board-comment-body {
    flex: 1 1 auto;
    min-width: 0;
  }
  .sv-board-comment-author {
    font-weight: 600;
    margin-right: 5px;
  }
  .sv-board-comment-at {
    margin-left: 6px;
    font-size: 0.66rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 45%, transparent);
  }
  .sv-board-comment-del {
    all: unset;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    color: color-mix(in srgb, var(--sg-fg, #101828) 40%, transparent);
    padding: 0 2px;
  }
  .sv-board-comment-del:hover {
    color: var(--sg-danger, #ef4444);
  }
  .sv-board-comment-empty {
    font-size: 0.72rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 42%, transparent);
  }
  .sv-board-comment-add {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-size: 0.74rem;
    padding: 4px 7px;
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: 5px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
  }
  .sv-board-card-cover {
    height: 6px;
    border-radius: 4px;
    margin: -2px 0 7px;
  }
  .sv-board-avatars {
    display: inline-flex;
    margin-left: auto;
  }
  .sv-board-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 0.6rem;
    font-weight: 700;
    color: #fff;
    background: var(--sv-board-accent);
    border: 1.5px solid var(--sg-bg, #fff);
    margin-left: -6px;
  }
  .sv-board-avatar:first-child {
    margin-left: 0;
  }
  /* Sub-tasks */
  .sv-board-subs {
    margin-top: 7px;
    border-top: 1px solid color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    padding-top: 6px;
  }
  .sv-board-subs-head {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    font-size: 0.7rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-subs-chev {
    font-size: 0.6rem;
  }
  .sv-board-subs-count {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .sv-board-subs-bar {
    flex: 1 1 auto;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--sg-fg, #101828) 10%, transparent);
    overflow: hidden;
  }
  .sv-board-subs-bar span {
    display: block;
    height: 100%;
    background: var(--sv-board-accent);
    transition: width 0.15s ease;
  }
  .sv-board-subs-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sv-board-subs-list label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    cursor: pointer;
  }
  .sv-board-subs-list label.is-done span {
    text-decoration: line-through;
    color: color-mix(in srgb, var(--sg-fg, #101828) 45%, transparent);
  }
  .sv-board-subs-list input {
    accent-color: var(--sv-board-accent);
  }
  .sv-board-subs-add {
    margin-top: 5px;
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-size: 0.74rem;
    padding: 3px 6px;
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: 5px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
  }
  /* Quick-add composer */
  .sv-board-composer-btn {
    all: unset;
    cursor: pointer;
    display: block;
    margin: 6px 8px 8px;
    padding: 5px 8px;
    border-radius: var(--sg-radius, 6px);
    font-size: 0.76rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 55%, transparent);
  }
  .sv-board-composer-btn:hover {
    background: color-mix(in srgb, var(--sg-fg, #101828) 6%, transparent);
    color: var(--sg-fg, #101828);
  }
  .sv-board-composer-input {
    margin: 6px 8px 8px;
    width: calc(100% - 16px);
    box-sizing: border-box;
    font: inherit;
    font-size: 0.8rem;
    padding: 6px 8px;
    border: 1px solid var(--sv-board-accent);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #101828);
  }
  /* Facet filter bar */
  .sv-board-facets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 4px 8px;
    align-items: center;
  }
  .sv-board-facet {
    all: unset;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.73rem;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--sg-border, #e4e7ec);
    color: color-mix(in srgb, var(--sg-fg, #101828) 70%, transparent);
  }
  .sv-board-facet:hover {
    border-color: var(--sg-accent, #3b82f6);
  }
  .sv-board-facet.is-active {
    background: var(--sg-accent, #3b82f6);
    border-color: var(--sg-accent, #3b82f6);
    color: #fff;
  }
  .sv-board-facet-count {
    font-size: 0.66rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }
  .sv-board-facet-clear {
    all: unset;
    cursor: pointer;
    font-size: 0.72rem;
    color: var(--sg-accent, #3b82f6);
    padding: 2px 6px;
  }
  /* Blocked flag + selection */
  .sv-board-card {
    position: relative;
  }
  .sv-board-card-flag {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-top: 14px solid var(--sg-danger, #ef4444);
    border-left: 14px solid transparent;
    border-top-right-radius: var(--sg-radius, 8px);
  }
  .sv-board-card.is-selected {
    border-color: var(--sv-board-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sv-board-accent) 55%, transparent);
  }
  .sv-board-card.is-locked {
    cursor: default;
  }
  /* Child cards (epic -> stories) */
  .sv-board-kids {
    margin-top: 7px;
    border-top: 1px solid color-mix(in srgb, var(--sg-fg, #101828) 8%, transparent);
    padding-top: 6px;
  }
  .sv-board-kids-head {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
    color: color-mix(in srgb, var(--sg-fg, #101828) 60%, transparent);
  }
  .sv-board-kids-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sv-board-kid {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    padding: 4px 7px;
    border: 1px solid var(--sg-border, #e4e7ec);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
  }
  .sv-board-kid-title {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-board-kid-lane {
    font-size: 0.64rem;
    font-weight: 600;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sv-board-accent) 15%, transparent);
    color: color-mix(in srgb, var(--sv-board-accent) 85%, var(--sg-fg, #101828));
    text-transform: capitalize;
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-board-card,
    .sv-board-lane-body,
    .sv-board-subs-bar span {
      transition: none;
    }
  }
</style>
