# Prompt: 50-seller-panel

Source: `examples/src/demos/50-seller-panel.svelte`
Live:   https://svgrid.dev/#/demos/50-seller-panel

## What this demo proves

50. E-commerce seller panel - catalog + inventory + orders + pricing
---------------------------------------------------------------------
The view a marketplace seller (Amazon / Shopify / eBay style)
lives in: four tabs over the same underlying product list.

  1. **Catalog.** Product thumbnail (programmatic SVG icon),
     ASIN, title, category, price + sale price, stock, status.
     Price + sale + stock + status are inline-editable.

  2. **Inventory.** Stock level vs reorder threshold visualised
     as a bar; low-stock and out-of-stock rows highlighted in
     colour. One-click "reorder" simulates a PO submission.

  3. **Orders.** A small pipeline of orders for these SKUs with
     status pills (pending / packing / shipped / delivered /
     returned), customer, line value, ship-by date.

  4. **Pricing rules.** Catalog-wide rules with type +
     condition + action + last-triggered timestamp; toggle
     active / inactive inline.

KPI strip across the top rolls live numbers regardless of which
tab is active.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
