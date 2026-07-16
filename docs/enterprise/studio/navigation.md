# Navigation & row actions

Blocks show data; **navigation** turns a set of screens into an app. Studio wires
two kinds of flow, both grid-native: **drill-through** (click a row or a chart
category to open another screen, filtered to what you clicked) and **row action
buttons** (per-row Edit / Delete / Open).

## Drill-through (row click)

Select a grid, open **Navigation & actions** in the inspector, and set **Row
click opens** to a target screen. Choose which field to **pass** (defaults to the
id) and which field on the target to **filter** by:

> Customers grid -> "Row click opens: Orders", pass `id`, filter Orders' `customer_id`.
> Clicking Ada now opens `/orders?customer_id=<ada's id>` with the grid already
> filtered to her orders.

The generator wires the source grid's `onRowClick` to `goto(...)`, and **every
target screen reads matching URL query params into an initial filter** - so the
link actually narrows the destination. That also makes screens **deep-linkable**:
`/orders?customer_id=42` filters on load, whether reached by a click or a
bookmark.

## Drill-through (chart)

A chart can drill too. In the chart's **Appearance** section set **Drill into (on
click)** to a screen; clicking a bar / slice navigates there filtered by the
clicked category (`goto('/orders?status=' + category)`). It reuses the same
URL-filter mechanism, so no target-side wiring is needed.

## Row action buttons

Under **Row action buttons**, add any of:

| Action | What it does |
| --- | --- |
| **Edit** | Opens the row in the edit form. (Needs the grid's popup form.) |
| **Delete** | Deletes the row via the controller - the affordance a read-only grid otherwise lacks. |
| **Navigate** | Opens a target screen filtered by this row (like drill-through, as an explicit button). |

Each renders in a generated **actions column**. Give an action a custom **label**
(e.g. "Approve", "View invoices"); a Navigate action picks its own target screen.
When [RBAC](./access-control.md) is on, Edit is hidden without `update` and Delete
without `delete` - and the server still enforces both.

## How it's generated

- Source grid: `onRowClick={(e) => goto('/orders?customer_id=' + encodeURIComponent(...))}`.
- Target screen: on load, any URL param matching one of its fields becomes an
  `equals` filter on the controller.
- Row actions: a synthetic `{ id: '__actions', cell: ... }` column rendering the
  buttons, unrolled from your config, with `goto` / `controller.deleteRow` /
  `editing = row` handlers.

It's plain SvelteKit navigation (`goto`) + the `ServerDataSource` controller you
already own - nothing bespoke to learn.

## See also

- [The visual designer](./app-designer.md) - where you wire navigation
- [Access control (RBAC)](./access-control.md) - gates Edit / Delete actions
- [Master-detail](./master-detail.md) - the other way to relate two entities on one screen
