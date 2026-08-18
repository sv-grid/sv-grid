# Status bar

The status bar is the strip under the grid that shows live aggregates of the
**selected cell range** - count, sum, average, min, max - the way Excel does at
the bottom-right when you select a block of numbers.

```svelte
<SvGrid {data} {columns} {features} enableCellSelection statusBar />
```

It needs `enableCellSelection` (the bar aggregates the selected rectangle).
Drag a range across numeric cells and the bar updates instantly.

## Choosing aggregates

`statusBar={true}` shows the default set (`count`, `sum`, `avg`, `min`, `max`).
Pass an object to pick which:

```svelte
<SvGrid enableCellSelection statusBar={{ aggregates: ['count', 'sum', 'avg'] }} />
```

| Aggregate      | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `count`        | Cells in the selection (non-group).                  |
| `numericCount` | How many of those hold a finite number.              |
| `sum`          | Sum of the numeric cells.                            |
| `avg`          | Mean of the numeric cells.                           |
| `min` / `max`  | Smallest / largest numeric value.                    |

## Behavior

- The numeric aggregates (`sum`, `avg`, `min`, `max`) only appear when the
  selection actually contains numbers - selecting text cells shows just the
  count.
- A single-cell selection shows nothing; the bar appears once a range of two
  or more cells is selected.
- Edited values are respected: the aggregates read the displayed value, so an
  in-progress edit is reflected.
- Group rows are skipped.

See the live [Status bar](https://svgrid.com/demos/144-status-bar/) demo.
