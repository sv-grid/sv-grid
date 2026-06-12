# Prompt: 58-export-with-images

Source: `examples/src/demos/58-export-with-images.svelte`
Live:   https://svgrid.dev/#/demos/58-export-with-images

## What this demo proves

58. Export - grid with images (Pro)
----------------------------------
A products grid with a thumbnail column. On export to xlsx the
thumbnails are embedded as real image cells, not as URL strings.

Two pieces make this work:

  1. The "thumbnail" data column holds a data-URL or http(s) URL
     pointing at an image. We render it in the grid via a custom
     cell snippet.

  2. `pro.exportData({ imageFields: ['thumbnail'] })` tells the
     xlsx writer to treat that field as an embedded image rather
     than text. The exporter pulls the image into the workbook's
     `_media` directory and references it from the cell.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
})
```

## Column shape

A representative column array from this demo (truncated):

```ts
const columns = [
{ field: 'thumbnail', header: 'Thumb' },
          { field: 'sku',       header: 'SKU' },
          { field: 'name',      header: 'Name' },
          { field: 'category',  header: 'Category' },
          { field: 'price',     header: 'Price' },
          { field: 'inStock',   header: 'In stock' },
]
```

## SvGridApi methods called

- `api.exportData(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
