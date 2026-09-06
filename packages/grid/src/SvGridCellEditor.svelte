<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  /**
   * The in-cell and full-row editor UI, lifted out of SvGrid.svelte.
   *
   * Editing is off by default (`editable` / `enableInlineEditing` both default
   * to false) and this markup only ever renders while a cell is actually being
   * edited, so it has no business sitting in the base bundle. SvGrid.svelte
   * loads it with `import()` the moment editing is enabled - well before any
   * double-click can happen - so behaviour is unchanged either way.
   *
   * Keep `SvGridDropdown` and `SvDateTimePicker` DYNAMIC below. Importing
   * either statically would drag ~22 KB into this chunk for every text edit,
   * and a static import from anywhere reachable by SvGrid.svelte has silently
   * defeated a lazy boundary in this codebase before.
   */
  import {
    type CellEditorOption,
    type Column,
    type EditorContext,
    type Row,
    type RowData,
    type TableFeatures,
  } from "./index";
  import {
    dateToTimeString,
    getEditableInputValue,
    getEditorClass,
    getEditorInputType,
    getCellEditorInputType,
    isNumericEditorInput,
    timeStringToDate,
    toValueArray,
  } from "./SvGrid.helpers";
  import {
    getCellEditor,
    hasCellEditor,
    resolveEditorProps,
    type CellEditorContext,
  } from "./editor-registry";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let {
    ctrl,
    column,
    row,
    fullRow = false,
  }: {
    ctrl: SvGridController<TFeatures, TData>;
    column: Column<TData>;
    row: Row<TData>;
    /** Render the full-row editor for this cell instead of the single-cell one. */
    fullRow?: boolean;
  } = $props();

  // Heavy editors stay behind their own `import()` so a text edit never pays
  // for the dropdown or the date picker.
  let DropdownEditor = $state<typeof import("./SvGridDropdown.svelte").default | null>(null);
  let DateEditor = $state<typeof import("./SvDateTimePicker.svelte").default | null>(null);
  $effect(() => {
    const t = ctrl.editingCell?.editorType;
    if (
      (t === "list" || t === "chips" || t === "select" || t === "rich-select") &&
      !DropdownEditor
    )
      import("./SvGridDropdown.svelte").then((m) => (DropdownEditor = m.default));
    if ((t === "date" || t === "datetime" || t === "time") && !DateEditor)
      import("./SvDateTimePicker.svelte").then((m) => (DateEditor = m.default));
  });

  const grid = $derived(ctrl.grid);
  const fullRowEdit = $derived(ctrl.fullRowEdit);
  const getColumnEditorOptions = $derived(ctrl.getColumnEditorOptions);
  const areEditorOptionsLoading = $derived(ctrl.areEditorOptionsLoading);
  const saveEditingCell = $derived(ctrl.saveEditingCell);
  const updateEditingCellValue = $derived(ctrl.updateEditingCellValue);
  const onEditorKeyDown = $derived(ctrl.onEditorKeyDown);
  const focusOnMount = $derived(ctrl.focusOnMount);
  const toggleCheckboxWithKeyboard = $derived(ctrl.toggleCheckboxWithKeyboard);

  /**
   * Focus a button-based editor on mount. `focusOnMount` is for text controls -
   * it also places the caret - and the checkbox and rating editors, being
   * <button>s, had no equivalent and so never took focus at all. Their own key
   * handlers therefore never fired: neither could be operated from the
   * keyboard, and Escape never reached them, so the cell stayed stuck in edit
   * mode until the user clicked somewhere else.
   *
   * `enabled` lets a group of buttons (the rating stars) pick which one holds
   * focus, since an action cannot be applied conditionally.
   */
  function focusControlOnMount(node: HTMLElement, enabled: boolean = true) {
    if (!enabled) return;
    requestAnimationFrame(() => node.focus({ preventScroll: true }));
  }

  function fullRowKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      ctrl.commitFullRowEdit();
      ctrl.gridRootEl?.focus({ preventScroll: true });
    } else if (e.key === "Escape") {
      e.preventDefault();
      ctrl.cancelFullRowEdit();
      ctrl.gridRootEl?.focus({ preventScroll: true });
    }
  }
  function optionValueOf(o: unknown): string {
    return typeof o === "object" && o !== null && "value" in o
      ? String((o as { value: unknown }).value)
      : String(o);
  }
  function optionLabelOf(o: unknown): string {
    return typeof o === "object" && o !== null && "label" in o
      ? String((o as { label: unknown }).label)
      : String(o);
  }

  // Build the interaction context handed to a CUSTOM cell editor registered via
  // `registerCellEditor`. Maps the grid's editing lifecycle onto the uniform
  // change / commit / cancel contract every registered editor speaks.
  function buildRegisteredEditorContext(): CellEditorContext {
    const cell = ctrl.editingCell;
    return {
      value: cell?.value,
      rowId: cell?.rowId ?? "",
      columnId: cell?.columnId ?? "",
      onChange: (v: unknown) => updateEditingCellValue(v),
      onCommit: (v?: unknown) => {
        if (v !== undefined) updateEditingCellValue(v);
        saveEditingCell();
      },
      onCancel: () => {
        ctrl.editingCell = null;
        ctrl.gridRootEl?.focus({ preventScroll: true });
      },
      // Tab out of an editor: commit, then step to the adjacent cell. Without
      // this a registered editor's Tab walks focus out of the grid (#48) - the
      // built-in editors already route through the same helper.
      onCommitAndMove: (v: unknown, direction: 1 | -1) => {
        if (v !== undefined) updateEditingCellValue(v);
        ctrl.commitAndMoveByTab(direction === -1);
      },
      // Close a popover editor without committing. Same effect as cancel today;
      // named separately so an editor can distinguish "dismiss my panel" from
      // "abandon the edit" if that ever diverges.
      onRequestClose: () => {
        ctrl.editingCell = null;
        ctrl.gridRootEl?.focus({ preventScroll: true });
      },
      inCell: true,
    };
  }
</script>

  {#snippet chipsEditor(
    opts: CellEditorOption[],
    multi: boolean,
    selectedArr: Array<string | number>,
    optsLoading: boolean,
  )}
    {#if opts.length > 0}
      <!-- Options-driven chips editor: defer to the custom dropdown,
           which renders the selected values as chips in its trigger and
           pops out a styled listbox. Identical UX to the list editor
           with renderChipsInTrigger flipped on. -->
      {#if DropdownEditor}
        <DropdownEditor
          options={opts}
          loading={optsLoading}
          value={ctrl.editingCell?.value}
          multiple={multi}
          placeholder="Pick…"
          renderChipsInTrigger={true}
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else}
      <!-- Free-form chips: typed tags. Enter / comma commits a chip,
           Backspace on empty input removes the last chip, blur saves. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="sv-grid-cell-editor sv-grid-cell-editor-chips"
        role="group"
        tabindex={-1}
      >
        <div class="sv-grid-chips-row">
          {#each selectedArr as v, idx (String(v) + "_" + idx)}
            <span class="sv-grid-chip sv-grid-chip-removable">
              {String(v)}
              <button
                type="button"
                class="sv-grid-chip-remove"
                aria-label="Remove {String(v)}"
                onmousedown={(event) => event.preventDefault()}
                onclick={() => {
                  const next = selectedArr.filter((_, i) => i !== idx);
                  ctrl.editingCell = ctrl.editingCell
                    ? {
                        ...ctrl.editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : ctrl.editingCell;
                }}>×</button
              >
            </span>
          {/each}
          <input
            use:focusOnMount
            class="sv-grid-chip-input"
            type="text"
            placeholder={multi ? "Type, Enter to add" : "Type a value"}
            onkeydown={(event) => {
              if (event.key === "Enter" || (multi && event.key === ",")) {
                event.preventDefault();
                event.stopPropagation();
                const input = event.currentTarget as HTMLInputElement;
                const raw = input.value.trim();
                if (raw) {
                  const next = multi ? [...selectedArr, raw] : [raw];
                  ctrl.editingCell = ctrl.editingCell
                    ? { ...ctrl.editingCell, value: multi ? next : raw }
                    : ctrl.editingCell;
                  input.value = "";
                  if (!multi) saveEditingCell();
                }
              } else if (event.key === "Escape") {
                onEditorKeyDown(event);
              } else if (event.key === "Backspace") {
                const input = event.currentTarget as HTMLInputElement;
                if (input.value === "" && selectedArr.length > 0) {
                  event.preventDefault();
                  const next = selectedArr.slice(0, -1);
                  ctrl.editingCell = ctrl.editingCell
                    ? {
                        ...ctrl.editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : ctrl.editingCell;
                }
              }
            }}
            onblur={() => saveEditingCell()}
          />
          {#if multi}
            <button
              type="button"
              class="sv-grid-chip-commit"
              onmousedown={(event) => event.preventDefault()}
              onclick={() => saveEditingCell()}
              aria-label="Commit chip selection">Done</button
            >
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

{#if fullRow}
    {@const et = column.columnDef.editorType ?? "text"}
    {@const val = fullRowEdit?.draft[column.id]}
    {#if et === "checkbox"}
      <input
        type="checkbox"
        class="sv-grid-fr-editor sv-grid-fr-checkbox"
        checked={Boolean(val)}
        onchange={(e) =>
          ctrl.setFullRowDraft(column.id, e.currentTarget.checked)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      />
    {:else if et === "list" || et === "select" || et === "rich-select"}
      {@const opts = getColumnEditorOptions(column, row)}
      <select
        class="sv-grid-cell-editor sv-grid-fr-editor"
        value={String(val ?? "")}
        onchange={(e) => ctrl.setFullRowDraft(column.id, e.currentTarget.value)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      >
        {#each opts as o (optionValueOf(o))}
          <option value={optionValueOf(o)}>{optionLabelOf(o)}</option>
        {/each}
      </select>
    {:else}
      {@const inputType =
        et === "number"
          ? "number"
          : et === "date"
            ? "date"
            : et === "datetime"
              ? "datetime-local"
              : et === "time"
                ? "time"
                : et === "password"
                  ? "password"
                  : "text"}
      <input
        type={inputType}
        class="sv-grid-cell-editor sv-grid-fr-editor"
        value={String(val ?? "")}
        oninput={(e) => ctrl.setFullRowDraft(column.id, e.currentTarget.value)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      />
    {/if}
{:else}
    {#if column.columnDef.cellEditor}
      <!-- Custom editor slot. The columnDef provides a snippet that
           receives the editor context (value + commit + cancel) so the
           consumer fully owns the in-cell UI. -->
      {@const customEditor = column.columnDef
        .cellEditor as unknown as import("svelte").Snippet<
        [EditorContext<TData>]
      >}
      {@render customEditor({
        cell: row.getAllCells().find((c) => c.column.id === column.id)!,
        row,
        column,
        table: grid,
        getValue: () => ctrl.editingCell?.value,
        value: ctrl.editingCell?.value,
        update: (next: unknown) => {
          // Stage the draft without closing. Live-preview controls
          // (sliders, color pickers) call this on every input tick.
          ctrl.editingCell = ctrl.editingCell
            ? { ...ctrl.editingCell, value: next }
            : ctrl.editingCell;
        },
        commit: (next?: unknown) => {
          // Write + close. If the caller passed a value, stage it
          // first; otherwise save whatever update() last wrote.
          if (next !== undefined) {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }
          saveEditingCell();
        },
        cancel: () => {
          ctrl.editingCell = null;
          ctrl.gridRootEl?.focus({ preventScroll: true });
        },
      })}
    {:else if ctrl.editingCell?.editorType === "checkbox"}
      <button
        use:focusControlOnMount
        type="button"
        class="sv-grid-checkbox"
        role="checkbox"
        aria-checked={Boolean(ctrl.editingCell.value)}
        aria-label="Edit checkbox value"
        onclick={(event) => {
          event.stopPropagation();
          const nextValue = !ctrl.editingCell?.value;
          ctrl.editingCell = ctrl.editingCell
            ? { ...ctrl.editingCell, value: nextValue }
            : ctrl.editingCell;
          saveEditingCell();
        }}
        onkeydown={(event) => {
          // Enter / Space are the checkbox's own activation keys. Everything
          // else - Escape to cancel, Tab to commit and move on - goes to the
          // shared editor handler, which this editor used to bypass entirely.
          if (event.key === "Enter" || event.key === " ") {
            toggleCheckboxWithKeyboard(event, () => {
              event.stopPropagation();
              const nextValue = !ctrl.editingCell?.value;
              ctrl.editingCell = ctrl.editingCell
                ? { ...ctrl.editingCell, value: nextValue }
                : ctrl.editingCell;
              saveEditingCell();
            });
            return;
          }
          onEditorKeyDown(event);
        }}
        onblur={() => saveEditingCell()}
      ></button>
    {:else if ctrl.editingCell?.editorType === "list"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const optsLoading = areEditorOptionsLoading(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {#if DropdownEditor}
        <DropdownEditor
          options={opts}
          loading={optsLoading}
          value={ctrl.editingCell?.value}
          multiple={multi}
          placeholder="Select…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "chips"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const optsLoading = areEditorOptionsLoading(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {@const selectedArr = toValueArray(ctrl.editingCell?.value)}
      {@render chipsEditor(opts, multi, selectedArr, optsLoading)}
    {:else if ctrl.editingCell?.editorType === "rating"}
      {@const ratingVal = Math.max(
        0,
        Math.min(5, Math.round(Number(ctrl.editingCell?.value) || 0)),
      )}
      <!-- Focus the star for the current rating (the first one when unrated),
           the radio a radiogroup is expected to enter on. Without it nothing
           in this editor held focus, so `onEditorKeyDown` below never ran and
           Escape could not close the cell. -->
      {@const focusStar = Math.min(5, Math.max(1, ratingVal))}
      <span class="sv-grid-rating-editor" role="radiogroup" aria-label="Rating">
        {#each [1, 2, 3, 4, 5] as n (n)}
          <button
            use:focusControlOnMount={n === focusStar}
            type="button"
            role="radio"
            aria-checked={ratingVal >= n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            class={`sv-grid-rating-star ${ratingVal >= n ? "sv-grid-rating-star-on" : ""}`}
            onmousedown={(event) => event.preventDefault()}
            onclick={(event) => {
              event.stopPropagation();
              ctrl.editingCell = ctrl.editingCell
                ? { ...ctrl.editingCell, value: n }
                : ctrl.editingCell;
              saveEditingCell();
            }}
            onkeydown={(event) => {
              // Arrows move between the stars, the way a radiogroup is
              // expected to work - without them the editor takes focus (see
              // focusControlOnMount) but Space can only re-pick the star that
              // already holds the value. Enter / Escape / Tab still fall
              // through to the shared handler.
              const key = event.key;
              if (
                key !== "ArrowLeft" &&
                key !== "ArrowRight" &&
                key !== "Home" &&
                key !== "End"
              ) {
                onEditorKeyDown(event);
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const current = Math.min(5, Math.max(1, ratingVal));
              const next =
                key === "Home"
                  ? 1
                  : key === "End"
                    ? 5
                    : key === "ArrowLeft"
                      ? Math.max(1, current - 1)
                      : Math.min(5, current + 1);
              ctrl.editingCell = ctrl.editingCell
                ? { ...ctrl.editingCell, value: next }
                : ctrl.editingCell;
              const stars = (
                event.currentTarget as HTMLElement
              ).parentElement?.querySelectorAll<HTMLElement>(
                ".sv-grid-rating-star",
              );
              stars?.[next - 1]?.focus({ preventScroll: true });
            }}>★</button
          >
        {/each}
        <button
          type="button"
          aria-label="Clear rating"
          class="sv-grid-rating-clear"
          onmousedown={(event) => event.preventDefault()}
          onclick={(event) => {
            event.stopPropagation();
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: 0 }
              : ctrl.editingCell;
            saveEditingCell();
          }}>×</button
        >
      </span>
    {:else if ctrl.editingCell?.editorType === "select"}
      <!-- Custom dropdown: opens a themed popover identical in feel to
           the existing 'list' editor (single-select, no typeahead). -->
      {@const selectOpts = getColumnEditorOptions(column, row)}
      {@const optsLoading = areEditorOptionsLoading(column, row)}
      {#if DropdownEditor}
        <DropdownEditor
          options={selectOpts}
          loading={optsLoading}
          value={ctrl.editingCell?.value}
          multiple={false}
          placeholder="Select…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "rich-select"}
      <!-- Searchable combobox: same popover as 'select' with a
           typeahead filter input baked in at the top. -->
      {@const richOpts = getColumnEditorOptions(column, row)}
      {@const optsLoading = areEditorOptionsLoading(column, row)}
      {#if DropdownEditor}
        <DropdownEditor
          options={richOpts}
          loading={optsLoading}
          value={ctrl.editingCell?.value}
          multiple={false}
          searchable={true}
          placeholder="Search…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "textarea"}
      <!-- Multi-line editor. Commits on Tab, Ctrl/Cmd+Enter, or blur.
           Plain Enter inserts a newline (the whole point of textarea).
           Esc cancels. -->
      <textarea
        use:focusOnMount
        class="sv-grid-cell-editor sv-grid-cell-editor-textarea"
        rows="4"
        value={String(ctrl.editingCell?.value ?? "")}
        onpointerdown={(event) => event.stopPropagation()}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLTextAreaElement).value,
          )}
        onkeydown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
            return;
          }
          // Tab and Ctrl/Cmd+Enter both commit. Plain Enter inserts a newline.
          // Tab goes through the shared helper so it advances the active cell
          // like every other editor does (#48).
          if (event.key === "Tab") {
            event.preventDefault();
            ctrl.commitAndMoveByTab(event.shiftKey);
            return;
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            saveEditingCell();
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }
        }}
        onblur={() => saveEditingCell()}
      ></textarea>
    {:else if ctrl.editingCell?.editorType === "autocomplete"}
      <!-- Free-text autocomplete: a text input with a live-filtered
           suggestion list. Typing edits the value freely; clicking a
           suggestion (or blur) commits. Accepts values not in the list. -->
      {@const acOpts = getColumnEditorOptions(column, row)}
      {@const acText = String(ctrl.editingCell?.value ?? "")}
      {@const acFiltered = acText.trim()
        ? acOpts.filter((o) =>
            String(o.label).toLowerCase().includes(acText.toLowerCase()),
          )
        : acOpts}
      <div class="sv-grid-autocomplete">
        <input
          use:focusOnMount
          class="sv-grid-cell-editor sv-grid-cell-editor-autocomplete"
          type="text"
          value={acText}
          onpointerdown={(event) => event.stopPropagation()}
          oninput={(event) =>
            updateEditingCellValue(
              (event.currentTarget as HTMLInputElement).value,
            )}
          onblur={() => saveEditingCell()}
          onkeydown={onEditorKeyDown}
        />
        {#if acFiltered.length > 0}
          <div class="sv-grid-autocomplete-list" role="listbox">
            {#each acFiltered.slice(0, 50) as opt (opt.value)}
              <button
                type="button"
                class="sv-grid-autocomplete-option"
                role="option"
                aria-selected={String(opt.value) === acText}
                onmousedown={(event) => {
                  event.preventDefault();
                  ctrl.editingCell = ctrl.editingCell
                    ? { ...ctrl.editingCell, value: opt.value }
                    : ctrl.editingCell;
                  saveEditingCell();
                }}>{opt.label}</button
              >
            {/each}
          </div>
        {/if}
      </div>
    {:else if ctrl.editingCell?.editorType === "date"}
      <!-- Rich date editor: SvCalendar popover over a formatted input. Opts
           out to the native <input type="date"> via editorType 'date-native'. -->
      {#if DateEditor}
        <DateEditor
          value={ctrl.editingCell?.value as string | number | Date | null}
          formatString="yyyy-MM-dd"
          dropDownDisplayMode="calendar"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(d)}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "datetime"}
      {#if DateEditor}
        <DateEditor
          value={ctrl.editingCell?.value as string | number | Date | null}
          formatString="yyyy-MM-dd HH:mm"
          dropDownDisplayMode="both"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(d)}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "time"}
      <!-- Rich time editor: SvTimePicker dial. Stores the 'HH:MM' string the
           `time` parser expects; opts out via editorType 'time-native'. -->
      {#if DateEditor}
        <DateEditor
          value={timeStringToDate(ctrl.editingCell?.value)}
          formatString="HH:mm"
          dropDownDisplayMode="time"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(dateToTimeString(d))}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "color"}
      <!-- Native <input type="color"> opens its picker in a separate OS
           overlay; once the picker closes, focus stays on the input so
           `blur` never fires on its own. Commit on `change` (which fires
           exactly once when the picker is dismissed) so the chosen color
           is saved without needing the user to click elsewhere. -->
      <input
        use:focusOnMount
        class={getEditorClass("color")}
        type="color"
        value={getEditableInputValue("color", ctrl.editingCell?.value)}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLInputElement).value,
          )}
        onchange={(event) => {
          updateEditingCellValue(
            (event.currentTarget as HTMLInputElement).value,
          );
          saveEditingCell();
        }}
        onblur={() => saveEditingCell()}
        onkeydown={onEditorKeyDown}
      />
    {:else if hasCellEditor(String(ctrl.editingCell?.editorType ?? ""))}
      <!-- Custom editor registered via `registerCellEditor(type, Component)`:
           mount it and hand it the uniform change / commit / cancel context. -->
      {@const _reg = getCellEditor(String(ctrl.editingCell?.editorType))!}
      {@const CustomCellEditor = _reg.component}
      <CustomCellEditor {...resolveEditorProps(_reg, buildRegisteredEditorContext())} />
    {:else}
      {@const editorType = ctrl.editingCell?.editorType ?? "text"}
      {@const isNumberEditor = getCellEditorInputType(editorType) === "text" &&
        getEditorInputType(editorType) === "number"}
      <input
        use:focusOnMount
        class={getEditorClass(editorType)}
        type={getCellEditorInputType(editorType)}
        inputmode={isNumberEditor ? "decimal" : undefined}
        value={getEditableInputValue(
          editorType,
          ctrl.editingCell?.value,
        )}
        oninput={(event) => {
          const input = event.currentTarget as HTMLInputElement;
          // The number editor is a TEXT input so intermediate values survive
          // (see getCellEditorInputType). That means nothing stops a letter
          // being typed, which type="number" used to - so reject it here and
          // put the last good draft back, rather than letting "12x" reach the
          // commit and coerce to null.
          if (isNumberEditor && !isNumericEditorInput(input.value)) {
            input.value = String(ctrl.editingCell?.value ?? "");
            return;
          }
          updateEditingCellValue(input.value);
        }}
        onblur={() => saveEditingCell()}
        onkeydown={onEditorKeyDown}
      />
    {/if}
{/if}
