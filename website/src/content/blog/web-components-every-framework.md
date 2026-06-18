---
title: Web Components - Write Once, Use in React, Vue, and Angular
description: How custom elements let a single UI component run across frameworks, the interop gotchas to know, and when native beats cross-framework.
date: 2026-05-08
category: Architecture
tags: web components, custom elements, react, vue, angular, interop
author: Victor Vidolov
---

Most teams are not on a single framework. A company has a React app, an Angular admin tool a team inherited, a Vue marketing site, and a couple of plain-HTML internal pages. Maintaining the same data grid four times is nobody's idea of fun. Web Components - custom elements built on web standards - are the standard answer to "write the component once, use it everywhere."

## What a Web Component is

A Web Component is a custom HTML element backed by browser-native APIs: the Custom Elements registry, Shadow DOM for style encapsulation, and HTML templates. Because it is part of the platform, any framework that renders HTML can render it.

```html
<sv-grid></sv-grid>
<script type="module">
  const grid = document.querySelector('sv-grid')
  grid.data = rows
  grid.columns = columns
</script>
```

That same tag works inside a React component, a Vue template, an Angular view, or a static page.

## The interop you need to know

Cross-framework freedom comes with a few sharp edges. They are all manageable once you know them:

- **Properties vs attributes.** Attributes are strings. Rich data - arrays, objects, functions - must be set as DOM *properties*, not attributes. `grid.data = rows`, not `data="[object Object]"`.
- **Events.** Custom elements emit DOM `CustomEvent`s. Frameworks with their own synthetic event systems sometimes need a thin binding to listen, though this has improved a lot.
- **Framework bindings.** React historically passed everything as attributes; modern React (19+) handles properties and custom events far better. Vue and Angular have long had clean property and event binding for custom elements.

None of these are dealbreakers, they are just the contract of crossing the framework boundary.

## When cross-framework is the right call

Reach for Web Components when:

- You genuinely ship across multiple frameworks and want one implementation.
- You need a component to outlive a framework migration.
- You are embedding UI into third-party pages you do not control.

This is exactly why the team behind SvGrid also ships Smart UI as web components on [htmlelements.com](https://www.htmlelements.com), one grid that drops into React, Angular, Vue, or plain HTML.

## When native beats cross-framework

Web Components are a compromise: to work everywhere, they cannot assume any one framework's reactivity, so they re-implement state management internally. Inside a single framework, a native component is usually smaller and more ergonomic, because it speaks the framework's own model directly.

That is the case for SvGrid itself: a Svelte app gets a grid written natively on Svelte 5 runes, with no interop layer. A mixed-framework shop gets the web-components route. Same engineering team, two delivery models, chosen by your architecture rather than forced by the tool.

## A practical rule of thumb

- One framework, for the foreseeable future: use the native component.
- Multiple frameworks, or a long horizon across migrations: use Web Components.
- Embedding into pages you do not own: Web Components, almost always.

## Frequently asked questions

### Can one Web Component really work in React, Vue, and Angular?

Yes. Custom elements are part of the browser platform, so any framework that renders HTML can use them. You set rich data as DOM properties and listen for custom events, with minor per-framework binding details.

### Should I use a Web Component or a native framework component?

Use a native component when you are committed to one framework, it is smaller and more ergonomic. Use a Web Component when you ship across multiple frameworks or need to survive a framework migration.
