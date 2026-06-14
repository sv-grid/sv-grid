---
title: A Svelte Data Grid with Laravel and Inertia
description: Use SvGrid in a Laravel + Inertia (Svelte) app - server-side paging with Laravel's paginator, passing data as page props, and partial reloads.
date: 2026-06-13
category: Integration
tags: laravel, inertia, server-side, integration, svelte data grid
author: SvGrid Team
---

Inertia.js lets a Laravel backend drive Svelte pages without building a separate API. SvGrid fits naturally: Laravel's paginator produces exactly the page and total a grid needs, and Inertia's partial reloads keep navigation snappy. Here is the setup.

## Laravel controller

Use Laravel's query builder and paginator, reading grid state from the request:

```php
public function index(Request $request)
{
    $sort = $request->input('sort', 'created_at');
    $desc = $request->boolean('desc', true);
    $q    = $request->input('q');

    $people = Person::query()
        ->when($q, fn ($query) => $query->where('name', 'like', "%{$q}%"))
        ->orderBy($sort, $desc ? 'desc' : 'asc')
        ->paginate($request->integer('size', 50))
        ->withQueryString();

    return inertia('People', ['people' => $people]);
}
```

`paginate()` gives you `data` and a `total`, both available on the Inertia page prop.

## The Svelte page

Read the paginator from props and feed SvGrid; drive navigation with Inertia visits in the grid's callbacks:

```svelte
<script lang="ts">
  import { router } from '@inertiajs/svelte'
  let { people } = $props() // Laravel paginator: { data, total, current_page, ... }

  function reload(params: Record<string, unknown>) {
    router.get('/people', params, { preserveState: true, preserveScroll: true, only: ['people'] })
  }
</script>

<SvGrid data={people.data} columns={columns} features={features}
  showPagination pageSize={50} rowCount={people.total}
  onSortingChange={(s) => reload({ sort: s[0]?.id, desc: !!s[0]?.desc })}
  onPaginationChange={(p) => reload({ page: p.pageIndex + 1 })} />
```

`only: ['people']` makes Inertia fetch just the grid prop (a partial reload), so paging and sorting are fast and do not reload the whole page. Laravel pages are 1-based, so add one to SvGrid's `pageIndex`.

## Why this works well

- **No separate API.** The controller returns the page directly to the Svelte component.
- **Partial reloads.** Only the grid data refetches on sort/page changes.
- **Validation and policies.** Laravel's request validation and authorization protect the query.

## Frequently asked questions

### How do I use SvGrid with Laravel and Inertia?

Return a Laravel paginator as an Inertia page prop, bind its `data` to SvGrid and `total` to `rowCount`, and trigger Inertia partial reloads (`only: ['people']`) in the grid's sort and pagination callbacks.

### How do I avoid full page reloads when paging?

Use Inertia's partial reloads with `only: ['people']` and `preserveState`/`preserveScroll`, so only the grid's data prop is refetched when the user sorts or changes pages.
