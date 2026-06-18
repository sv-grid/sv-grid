---
title: What Is llms.txt, and Why SvGrid Ships One
description: An explainer on llms.txt - the emerging convention for making a site legible to AI - how it works, and how SvGrid uses it for AI discoverability.
date: 2026-09-23
category: AI
tags: ai, llms.txt, seo, discoverability, svelte data grid
author: Victor Vidolov
---

`llms.txt` is a small file with an outsized idea: a clean, machine-readable summary of your site at a known URL, so AI systems read you accurately instead of scraping your nav and ads. As people increasingly find tools through AI rather than search results, it is becoming as worth having as `robots.txt` or `sitemap.xml`.

![A natural-language filter bar in SvGrid.](/blog-media/nl-filter.png)
*A natural-language filter bar in SvGrid.*

## The idea

Web pages are built for humans - navigation, scripts, styling, ads - which makes them noisy for an LLM to parse. `llms.txt` is a curated, plain-Markdown file at `/llms.txt` that points to the canonical, clean version of your important content: what the project is, where the docs live, key pages, in a form a model can read directly.

It complements, not replaces, `robots.txt` (crawl rules) and `sitemap.xml` (URL list). Where a sitemap says "here are all my URLs," `llms.txt` says "here is what matters and what it means," distilled.

## Why it matters now

People increasingly discover and evaluate tools through AI - "what's the best Svelte data grid?", "how do I do X in Svelte?" - not just a search results page. If an AI system can ingest a clean, accurate summary of your project, it can represent and recommend it correctly. If it only has a noisy HTML page or stale training data, it guesses. `llms.txt` is a low-cost way to be legible to that pipeline.

## How SvGrid uses it

SvGrid publishes an `llms.txt` that points AI systems at the canonical, machine-readable description of the grid, what it is, its docs, its API, its examples. Combined with the [MCP server](svgrid-with-cursor-zed-windsurf) (which grounds assistants while you code) and structured data on every page, it is part of a deliberate strategy: be the Svelte data grid that AI gets *right*, whether someone is asking about it or building with it.

## Should your project have one?

If developers might ask an AI about your library, yes. It is a single Markdown file, cheap to maintain, and it improves how AI systems understand and surface you, a small investment as AI-mediated discovery grows.
