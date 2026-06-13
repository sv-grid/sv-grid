---
title: Master-Detail Rows - Expandable Detail Panels in SvGrid
description: Build expandable rows that reveal a detail panel - a nested grid, a chart, or a form - using SvGrid's row expanding feature.
date: 2026-04-14
category: Rows
tags: master detail, expandable rows, nested grid, svelte data grid
author: SvGrid Team
---

Some data does not fit in a single row. An order has line items; a customer has recent activity. Master-detail rows let users expand a row to reveal a rich detail panel - another grid, a chart, or a form - without leaving the page.

## Enable expandable rows

Register `rowExpandingFeature` and provide the detail content:

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowExpandingFeature } from 'sv-grid-community'
  const features = tableFeatures({ rowExpandingFeature })
</script>

<SvGrid data={orders} columns={columns} features={features} />
```

Each row gets an expand toggle. Clicking it reveals the detail region for that row and collapses it again.

## What goes in the detail panel

Anything you can render in Svelte:

- **A nested grid** - the order's line items as their own `<SvGrid>`.
- **A chart** - a sparkline of the customer's last 30 days.
- **A form** - quick-edit fields for the selected record.

Because the detail panel is just Svelte markup, it has full access to the row's data and your app's components.

## Lazy-load detail data

Detail panels are a great place to defer work. Fetch the line items only when a row is expanded, so the initial grid stays light:

```svelte
{#snippet Detail(props: { row: Order })}
  {#await loadLineItems(props.row.id)}
    <p>Loading…</p>
  {:then items}
    <SvGrid data={items} columns={lineItemColumns} />
  {/await}
{/snippet}
```

This pattern keeps a thousand-row order grid fast: you only pay for the details a user actually opens.

## Keyboard and accessibility

Expand toggles are keyboard-operable and announce their state, so screen-reader users can navigate the hierarchy the same way they navigate rows. You get this without extra wiring.

## Frequently asked questions

### How do I add expandable detail rows in a Svelte grid?

Register `rowExpandingFeature` and render a detail snippet per row. The detail panel can hold a nested grid, a chart, or a form.

### Can I lazy-load detail content?

Yes. Fetch detail data inside the detail snippet when the row expands - for example with an `{#await}` block - so the main grid stays fast.
