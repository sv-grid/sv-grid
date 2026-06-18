---
title: An Autocomplete Cell Editor in SvGrid
description: Add a typeahead/autocomplete editor to a grid cell - suggesting values as the user types and committing the selection to your data.
date: 2026-07-03
category: Editing
tags: editing, autocomplete, typeahead, cell editor, recipe
author: Victor Vidolov
---

When a column pulls from a big set of values - thousands of customers, products, tags - a plain dropdown is unusable and free text is a typo factory. Autocomplete splits the difference: type to filter, then pick. SvGrid lets you render a custom editor cell, so you build one from your own input plus a suggestion list.

![Custom cell editors in SvGrid](/blog-media/custom-cell-editors.png)
*Custom, typed cell editors in SvGrid.*

## The quick version: input + datalist

For modest option lists, the native `<datalist>` gives you autocomplete with zero JavaScript and full accessibility:

```svelte
{#snippet TagCell(p: { row: Row })}
  <input
    list="tags"
    value={p.row.tag}
    onchange={(e) => commit(p.row, (e.currentTarget as HTMLInputElement).value)}
  />
  <datalist id="tags">
    {#each allTags as t}<option value={t}></option>{/each}
  </datalist>
{/snippet}
```

This is the right default when options number in the dozens to low hundreds.

## The rich version: filtered suggestions

For large or remote option sets, render your own suggestion list, filtered as the user types, with keyboard support:

```ts
let queryText = $state('')
const suggestions = $derived(
  options.filter((o) => o.label.toLowerCase().includes(queryText.toLowerCase())).slice(0, 20)
)
```

Show the list under the input, support Arrow keys + Enter to choose, Escape to cancel, and commit the selected value to your data. Cap the list (e.g., 20) so rendering stays cheap.

## Remote options

For server-backed suggestions, debounce the query and cancel stale requests (the same discipline as [server-side data](svelte-data-grid-rest-api)). Cache results so repeated lookups are instant.

## Accessibility

If you build a custom list, implement the combobox ARIA pattern: `role="combobox"` on the input, `role="listbox"`/`role="option"` on the suggestions, `aria-activedescendant` for the highlighted item. The native `<datalist>` gives you this for free, which is why it is the recommended starting point.
