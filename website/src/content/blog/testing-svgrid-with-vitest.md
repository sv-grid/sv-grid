---
title: Unit-Testing SvGrid with Vitest
description: Test data grid logic and components with Vitest and @testing-library/svelte - testing column definitions, the headless core, and rendered output.
date: 2026-06-13
category: Integration
tags: vitest, testing, unit tests, integration, svelte data grid
author: Boyko Markov
---

A data grid carries real logic - accessors, formatters, sort and filter behavior - and that logic deserves tests. Vitest plus `@testing-library/svelte` covers both pure logic and rendered components. Here is how to test SvGrid effectively.

## Test the pure parts first

The cheapest, most valuable tests target your column logic - accessors and formatters - with no DOM:

```ts
import { expect, test } from 'vitest'

const fullName = (r: Row) => `${r.first} ${r.last}`

test('full name accessor', () => {
  expect(fullName({ first: 'Ada', last: 'Lovelace' })).toBe('Ada Lovelace')
})
```

Keep accessor and formatter functions exported so they are trivial to test in isolation.

## Test the headless core without rendering

Because SvGrid has a headless engine, you can assert on the row model - sorting, filtering - without a DOM, which is fast and stable:

```ts
import { createSvGrid, rowSortingFeature, tableFeatures } from 'sv-grid-community'

test('sorts by age descending', () => {
  const grid = createSvGrid({ data, columns, features: tableFeatures({ rowSortingFeature }) })
  // apply a sort and assert the resulting row order
})
```

This is the sweet spot: real grid behavior, no rendering flakiness.

## Component tests with Testing Library

For the rendered grid, use `@testing-library/svelte` and assert on accessible roles, which doubles as an accessibility check:

```ts
import { render, screen } from '@testing-library/svelte'
import Grid from './Grid.svelte'

test('renders a grid with headers', () => {
  render(Grid)
  expect(screen.getByRole('grid')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
})
```

Query by `role="grid"`, `role="row"`, and `role="columnheader"` rather than CSS selectors - it is more robust and verifies the ARIA structure.

## Config note

Use the `jsdom` (or `happy-dom`) environment for component tests and the Svelte Vitest plugin. Keep logic tests in the default environment for speed.

## Frequently asked questions

### How do I unit-test a SvGrid data grid?

Test exported accessor and formatter functions directly, assert on the headless `createSvGrid` row model for sort/filter behavior without a DOM, and use `@testing-library/svelte` to render the component and query by ARIA roles.

### Should I test the rendered grid or the logic?

Both, but lean on logic and headless-core tests - they are fast and stable. Use a few component tests (querying by `role`) to confirm the grid renders and stays accessible.
