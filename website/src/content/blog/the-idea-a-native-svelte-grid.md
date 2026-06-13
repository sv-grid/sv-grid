---
title: The Idea - Svelte 5 Deserves a Data Grid Built for It
description: After Svelte 5 shipped, we surveyed the Svelte data-grid landscape and found ports and adapters, but nothing native to runes. So we decided to build one.
date: 2026-06-13
category: Company
tags: company, story, idea, svelte data grid
author: SvGrid Team
---

Once Svelte 5 shipped with its signal-based reactivity, the question for us was what it meant for data grids. The answer came from looking hard at what already existed, finding a real gap, and deciding to fill it.

## We surveyed the landscape first

Before building anything, you should check whether you need to. So we went looking for the data grid a Svelte 5 developer would reach for. What we found fell into three buckets:

- **Framework-agnostic engines with a Svelte adapter.** Excellent data pipelines, but bridged to Svelte through stores and `.subscribe` wrappers - a translation layer between the engine's reactivity and Svelte's.
- **Headless table libraries.** Great logic, no rendering, and largely written for the Svelte 4 store model rather than runes.
- **Ports of older grids.** Capable, but carrying years of assumptions from the framework they were born in.

All of them work. None of them were written natively for Svelte 5 runes. There was no grid where state was just `$state` and derived rows were just `$derived`, end to end.

## A gap is only worth filling if you can fill it well

Plenty of gaps in software exist because filling them is nobody's idea of a good time. A data grid is exactly that kind of gap: virtualization, accessibility, keyboard navigation, editing, filtering, grouping - the unglamorous, easy-to-get-wrong work that makes naive in-house tables fall over.

But it happens to be the work we have done for over a decade. We built jqxGrid in 2011 and have maintained grids through every shift since - jQuery, web components, and the components on htmlelements.com used by thousands of teams at companies like Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. If anyone should build the native Svelte 5 grid, it is a team that has already built one for every era before it.

## The shape of the decision

Once we decided to do it, the big choices came quickly, because the survey had already taught us what to avoid:

1. **Native runes, no adapter.** The whole point. If we were going to wrap a foreign engine, there was no reason to start.
2. **Headless core plus a render component.** A pure engine (`createSvGrid`) for control, and a `<SvGrid>` component for speed - sharing one set of column definitions, so you never hit a wall.
3. **MIT-licensed core.** The grid most people need should be free for commercial use, the way the ecosystem expects.
4. **AI-native from the start.** Assistants write a lot of grid code now. We wanted ours to be the one they get right - which later became the MCP server and `llms.txt`.

## Naming it

It needed a name that said what it was without ceremony. A Svelte grid. SvGrid. The mark became a tiny data grid with one sorted column - the most honest possible logo for the thing.

## What comes next

A decision is not a product. Read next: [how we started building SvGrid](day-one-building-svgrid), and the first architectural calls that everything else rests on.

## Frequently asked questions

### Why build a new Svelte data grid instead of using an existing one?

When Svelte 5 shipped, the existing options were adapters, headless libraries built for the Svelte 4 store model, or ports of older grids. None were written natively for runes, so none avoided the translation layer a native grid removes.

### Who decided to build SvGrid, and why are they qualified?

The jQWidgets team, which has shipped data grids since 2011 - jqxGrid and the Smart UI web components - across the jQuery, web-components, and now Svelte eras. Building a grid for a new framework is something they have done repeatedly.
