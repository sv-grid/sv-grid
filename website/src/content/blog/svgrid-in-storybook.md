---
title: Documenting SvGrid in Storybook
description: Build a living catalog of your data grid configurations in Storybook - stories for states, controls for props, and accessibility checks.
date: 2026-06-13
category: Integration
tags: storybook, documentation, testing, integration, svelte data grid
author: Victor Vidolov
---

Storybook turns your grid configurations into a living catalog your team can actually browse, gold for design review, QA, and onboarding the next hire. The trick with a data grid is capturing the states people forget (empty, loading, huge), and giving it a real height. Here is how to do it well.

## A basic story

Wrap SvGrid in a story component and export named stories for the states that matter:

```svelte
<!-- PeopleGrid.stories.svelte -->
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import PeopleGrid from './PeopleGrid.svelte'
  const { Story } = defineMeta({ title: 'Data/PeopleGrid', component: PeopleGrid })
</script>

<Story name="Default" args={{ rows: sampleRows }} />
<Story name="Empty" args={{ rows: [] }} />
<Story name="Loading" args={{ loading: true }} />
<Story name="Large dataset" args={{ rows: makeRows(100000) }} />
```

The "Empty", "Loading", and "Large dataset" stories are the ones teams forget, and the ones that catch bugs. See [empty, loading, and error states](empty-loading-and-error-states-svelte-grid).

## Controls for props

Expose SvGrid's umbrella props (`filterMode`, `showPagination`, `pageSize`, `selectionMode`, `enableInlineEditing`) as Storybook args so reviewers can toggle behavior live without code. This makes Storybook a self-serve playground for the grid's options.

## Height matters in Storybook

Stories render in a frame, so give the grid a bounded height (a fixed-height wrapper or a full-height decorator) or virtualization will not engage and the "Large dataset" story will look broken.

```svelte
<div style="height: 480px;"><SvGrid {...args} /></div>
```

## Accessibility add-on

Enable Storybook's a11y addon. Because SvGrid renders proper ARIA grid roles, your stories will pass the automated checks, and the addon will catch issues you introduce in custom cells (an icon button missing a label, low contrast).

## Frequently asked questions

### How do I document a data grid in Storybook?

Create stories for each meaningful state - default, empty, loading, large dataset - expose SvGrid's props as Storybook controls, and give the grid a bounded height so virtualization works inside the story frame.
