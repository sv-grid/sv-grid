# Accessibility

A Studio screen is accessible out of the box, because it is built from the grid
and the edit form - both designed to the [WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/)
patterns. This page is what you get for free, what you own, and how to verify it.

## What you get for free

- **The grid is a WAI-ARIA grid** - `role="grid"` with rows and cells, a **roving
  tabindex** (one tab stop for the whole grid; arrow keys move the active cell),
  and `aria-sort` on sorted headers. Full keyboard navigation, no mouse required.
  See [Accessibility](../../help/accessibility.md) for the grid's complete a11y
  behaviour and the [live demo](https://svgrid.com/#/demos/17-accessibility).
- **The edit form** labels every input from the schema's `label` (or a title-cased
  field name), marks required fields, and surfaces validation messages next to the
  field they belong to.
- **Focus is managed** - opening the create / edit modal moves focus into it and
  restores focus on close; `Esc` cancels.
- **Live announcements** - loading, row counts, and validation errors are exposed
  through `aria-live` regions so screen-reader users hear state changes.

## What you own

The generated code is yours, so a few things are on you to keep accessible:

- **Labels that read well.** The column header and form label both come from the
  schema `label`. Set it to human text (`{ field: 'mrr', label: 'MRR ($)' }`), not
  a raw column name.
- **Colour is never the only signal.** If you use a `cellClass` or an enum
  `color` to convey status, pair it with text or an icon so it survives for
  colour-blind users and in high contrast.
- **Contrast.** The default theme meets WCAG AA. If you [retheme](./theming.md)
  with your brand tokens, re-check the `--sg-fg` / `--sg-bg` and
  `--sg-accent` / `--sg-on-accent` pairs against a contrast checker. A
  ready-made high-contrast preset is in the [Theme Builder](https://svgrid.com/theme-builder).
- **Custom cell renderers.** If you drop in your own cell content (buttons,
  links), give it an accessible name and make it keyboard-reachable.

## Keyboard reference

| Key | Action |
| --- | --- |
| `Tab` | Move into / out of the grid (one stop), then to the toolbar and pager |
| Arrow keys | Move the active cell |
| `Enter` / `F2` | Start editing the active cell (inline mode) |
| `Esc` | Cancel the current edit or close the modal |
| `Space` | Toggle a row checkbox (when selection is on) |
| `Home` / `End`, `PageUp` / `PageDown` | Jump within the grid |

## Verify it

Automated checks catch the regressions. Run [axe](https://github.com/dequelabs/axe-core)
against the running screen in a Playwright test:

```ts
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test('customers screen has no a11y violations', async ({ page }) => {
  await page.goto('/customers')
  await injectAxe(page)
  await checkA11y(page, undefined, { detailedReport: true })
})
```

Automated tools find roughly half of issues - also **tab through the screen** with
no mouse, and try it with a screen reader (VoiceOver / NVDA) once. Both take a
couple of minutes and catch what axe cannot.

## See also

- [Accessibility](../../help/accessibility.md) - the grid's full a11y behaviour
- [Testing a Studio app](./testing.md) - where the axe test fits
- [Themes & styling](./theming.md) - contrast + the high-contrast preset
