---
"@svgrid/grid": patch
---

Cell editors and the number input, fixes found using `SvNumberInput` as an
in-cell editor:

- A cell editor registered with `registerCellEditor` could throw "Cannot read
  properties of undefined (reading 'props')" when its edit ended. The grid
  cleared the editing cell before the editor unmounted, and an editor that read
  one of its props in that moment (an input firing `onChange` on the blur its
  commit causes) made the grid look its registration up again from the cleared
  cell. The grid now keeps the registration of the mounted editor.
- A click on a control inside an open cell editor (a stepper button, a clear
  button) was handled as a click on the cell: it moved focus to the grid while
  the editor stayed open, and the next Enter went to the grid instead of
  committing. Those clicks now stay with the editor.
- An empty value in a `number`, `currency` or `percent` column rendered as
  "0" / "$0", because `Number(null)` and `Number('')` are 0. It now renders
  empty; a real zero still formats.
- `SvNumberInput`: the stepper buttons no longer take focus (no Tab stop, and
  pressing one keeps focus in the field), and a keystroke that can never be
  part of a number, such as a letter, is rejected as it is typed.
- `SvRepeatButton` has a `focusable` prop (default `true`) for buttons that
  step a field beside them.
- The empty state is styled: centred in the body with an icon. When a filter
  is what emptied the grid it says so (`noRowsFiltered`) and offers a
  "Clear filters" button (`clearFilters`) that clears every filter surface.
  It used to be one unstyled line of text against the left edge. A
  consumer's `emptyMessage` still wins and hides the button.
- The pager wraps onto a second line when the grid is narrower than it,
  instead of overflowing off the left edge on a phone.
