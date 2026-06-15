---
title: 15 Years of UI Components - The Story Behind jQWidgets and Smart UI
description: From jQWidgets in 2011 to Smart UI web components and now SvGrid for Svelte 5 - the throughline behind the team and what we have learned shipping components for over a decade.
date: 2026-06-05
category: Company
tags: company, jqwidgets, smart ui, htmlelements, history
author: Boyko Markov
---

SvGrid did not appear out of nowhere. It is the latest product from a team that has been shipping UI components since 2011. This is the story of how we got here, and what a decade and a half of building grids taught us.

## 2011: jQWidgets and the jqxGrid

We started in the jQuery era with jQWidgets - a suite of widgets anchored by jqxGrid, a data grid that had to be fast on the browsers of the time. That constraint shaped how we think to this day: a grid is a performance product first. Users do not forgive a table that stutters when they scroll, sort, or type in a filter.

Over the years jQWidgets components found their way into enterprise software at companies you know - Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel among thousands of others. Shipping into environments like that teaches you to value stability, backward compatibility, and accessibility over chasing trends.

## The web components era: Smart UI

As the platform matured, we rebuilt our component library on web standards - custom elements - and launched it as Smart UI on [htmlelements.com](https://www.htmlelements.com). Web Components let one component run in React, Angular, Vue, or plain HTML, which matched how real engineering teams actually work: heterogeneous, long-lived, and rarely on a single framework.

Smart UI keeps moving. The 26.0.0 release brought Pro Themes - Material 3, Fluent, Strata, and Tabula - plus data grid modularity improvements and AI-assisted API documentation. And the work continues into 2026 with a roadmap that leans hard into AI: an MCP server, an AI-assisted dashboard builder, smart data-grid summaries, and AI-powered paste.

## Recognition

In Visual Studio Magazine's 2025 Readers' Choice Awards, Smart UI was voted Gold Winner among software development service providers. Awards are not the point - shipping is - but it is good to know the people who use the tools every day rate them highly.

## 2026: SvGrid for Svelte 5

Which brings us to SvGrid. When Svelte 5 introduced runes, we saw a chance to build a data grid that exploits fine-grained reactivity natively rather than wrapping an engine designed for another model. So we wrote a new grid from scratch, with a headless core and a render component, MIT-licensed at its heart.

## What 15 years taught us

A few principles carry through every product we have built:

- **Performance is a feature, not an optimization.** Virtualization, stable references, and minimal repaints are designed in from the start.
- **Accessibility is the default, not a setting.** WAI-ARIA roles and full keyboard support ship on by default because retrofitting them never works.
- **Meet developers where they are.** That meant jQuery in 2011, web components later, native Svelte today, and AI assistants now.
- **Honesty builds trust.** Our comparison pages tell you when a competitor is the better choice. Developers see through marketing; they respond to candor.

## Where we are headed

The same team that has shipped grids for over a decade is now all-in on two things: native framework-first components, and AI-native tooling so assistants can use our libraries correctly. SvGrid is where those threads meet.

## Frequently asked questions

### How long has the team behind SvGrid been building UI components?

Since 2011 - first jQWidgets and jqxGrid, then the Smart UI web components on htmlelements.com, and now SvGrid for Svelte 5.

### What is the relationship between SvGrid, jQWidgets, and Smart UI?

They are all products from the same team. jQWidgets is the original jQuery-era suite, Smart UI is the web-components library on htmlelements.com, and SvGrid is the new native Svelte 5 data grid.
