---
title: End-to-End Testing SvGrid with Playwright
description: Write reliable Playwright tests for a data grid - sorting, filtering, editing, and keyboard navigation - using accessible roles instead of brittle selectors.
date: 2026-06-13
category: Integration
tags: playwright, testing, e2e, accessibility, svelte data grid
author: Kamelia M
---

Unit tests will not tell you whether sorting actually reorders the rows on screen, whether an edit really persists, or whether keyboard navigation works, those are integration questions, and that is Playwright's turf. The bonus: because SvGrid renders proper ARIA roles, your tests can lean on those instead of brittle CSS selectors. Here is the approach.

## Select by role, not by class

The single most important habit: query the grid through accessible roles. They are stable across refactors and double as an accessibility assertion.

```ts
import { test, expect } from '@playwright/test'

test('sorting reorders rows', async ({ page }) => {
  await page.goto('/people')
  const grid = page.getByRole('grid')
  await grid.getByRole('columnheader', { name: 'Name' }).click()
  const firstCell = grid.getByRole('row').nth(1).getByRole('gridcell').first()
  await expect(firstCell).toHaveText('Ada')
})
```

## Test filtering

Drive the filter UI and assert the visible row count changes:

```ts
test('filtering narrows results', async ({ page }) => {
  await page.goto('/people')
  await page.getByPlaceholder('Search...').fill('berlin')
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(4) // header + 3
})
```

Add a small wait or `expect` auto-retry for debounced/server-side filters.

## Test inline editing

```ts
test('editing a cell commits', async ({ page }) => {
  const cell = page.getByRole('gridcell', { name: '36' })
  await cell.dblclick()
  await page.keyboard.type('40')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('gridcell', { name: '40' })).toBeVisible()
})
```

## Test keyboard navigation

This verifies the part most grids get wrong, and that hand-rolled tables fail:

```ts
test('arrow keys move the active cell', async ({ page }) => {
  await page.getByRole('grid').getByRole('gridcell').first().click()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  // assert the focused cell moved
})
```

## Tips for stable e2e

- Seed deterministic data so assertions are exact.
- For server-side grids, use Playwright's auto-retrying `expect` to ride out network latency.
- Prefer `getByRole` and accessible names over CSS or text that might be localized.

## Frequently asked questions

### How do I write reliable Playwright tests for a data grid?

Query the grid through ARIA roles (`grid`, `row`, `columnheader`, `gridcell`) rather than CSS classes, seed deterministic data, and use Playwright's auto-retrying assertions for debounced or server-side updates.

### Can I test keyboard navigation in the grid?

Yes, and you should. Focus a cell, press arrow keys, Home/End, and F2/Enter, and assert the active cell and edits behave, SvGrid's roving focus model makes this testable, and it is exactly where weaker grids fall down.
