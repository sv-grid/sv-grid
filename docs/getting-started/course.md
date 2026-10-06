# Learn SvGrid: the video course

Ten short lessons that take you from an empty project to a grid you would put
in front of users. Each one is a few minutes, each ends where the next begins,
and every line of code on screen is a file you can open: the lessons are
recorded against the runnable examples on these pages, so what you watch is
what runs.

Watch them in order the first time. After that they work as reference, since
each lesson sits on the docs page for its subject and the page carries the
same code in text.

## What you need

A project with Svelte 5 and the package installed. [Install](./1-install.md)
covers both, and takes about a minute. Everything else is in the lessons.

The course assumes you know Svelte 5 runes well enough to read `$state`, and
nothing about data grids.

All ten also play back to back as a
[YouTube playlist](https://www.youtube.com/playlist?list=PLODWzOnOLhEk), with
narration.

## The lessons

<!-- course:learn -->

| # | Lesson | What it covers | Length |
| --- | --- | --- | --- |
| 1 | [Install and your first grid](./2-first-grid.md#tutorial-learn-1-first-grid) | Install the package, write a twenty-line component, and get a styled, keyboard-navigable table. | 2 min 01 s |
| 2 | [Your data, your columns](./3-data-and-columns.md#tutorial-learn-2-data-and-columns) | Put your own row type in, keep it reactive, then set headers, widths and currency, percent and date formats. | 1 min 28 s |
| 3 | [Sorting, filtering and paging](./4-features.md#tutorial-learn-3-sort-filter-page) | Switch on sorting, filtering, grouping and pagination with boolean props, and see what each one does to the same table. | 2 min 23 s |
| 4 | [Editing rows, and validating them](../help/editing/validation.md#tutorial-learn-4-editing) | Make cells editable, pick an editor per column, and use validate with rejectInvalid so bad input never reaches your data. | 1 min 31 s |
| 5 | [Selection and bulk actions](../help/rows/selection-bar.md#tutorial-learn-5-selection) | Add row checkboxes, give the grid a stable row id, and float a bulk-action bar over the rows the user picked. | 1 min 26 s |
| 6 | [Grouping and totals](../help/grouping-aggregation.md#tutorial-learn-6-grouping) | Group rows by a column, average and sum per group with the aggregate option, and add a summary row for the whole table. | 1 min 34 s |
| 7 | [Themes, dark mode and density](./5-theme-and-density.md#tutorial-learn-7-theme) | Set the CSS custom properties yourself, flip dark mode with one attribute, and change row density with a prop. | 1 min 53 s |
| 8 | [Data from a server](./6-going-to-production.md#tutorial-learn-8-server-data) | Move sorting, filtering and paging to the backend, send one request per change, and cancel the one that is now stale. | 1 min 46 s |
| 9 | [SvelteKit end to end](./sveltekit.md#tutorial-learn-9-sveltekit) | Query in a load function, hand the rows to the page, and get real server-rendered HTML instead of an empty shell. | 1 min 21 s |
| 10 | [Going to production](./6-going-to-production.md#tutorial-learn-10-production) | Virtualization, the accessibility you already have, server-rendered markup, and the TypeScript habit that prevents blank columns. | 1 min 48 s |

Ten lessons, 17 min 10 s in all.

<!-- /course:learn -->

## How the lessons are made

The code you see typed in the editor is not a screenshot or a re-typed copy.
Each lesson reads a runnable block straight out of these docs, types that
file's own source, and mounts that same file in the browser pane beside it. So
the code shown and the result shown cannot drift apart, and when a doc changes
the lesson is re-recorded from it rather than edited to match.

Every claim the narration makes is also checked while recording. When a lesson
says a button adds a row, the recorder counts the rows before and after and
fails the take if the count did not move. That check exists because a take
once shipped where it had not.

## See also

- [Install](./1-install.md) - the one-minute setup the course assumes.
- [Starters](./starters.md) - a scaffolded project if you would rather not
  wire one up by hand.
- [SvelteKit](./sveltekit.md) - the same grid in a SvelteKit app, end to end.
- [Going to production](./6-going-to-production.md) - the checks before you
  ship, which is where lesson ten ends.
