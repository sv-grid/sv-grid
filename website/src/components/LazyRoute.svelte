<script lang="ts">
  // Renders a route component that is imported on demand, so each route ships
  // as its own chunk instead of being bundled into the entry. The `loader`
  // must be a STABLE reference (e.g. an entry from the ROUTES map in
  // App.svelte) - a fresh arrow on every render would re-trigger the import
  // and remount the route on unrelated state changes.
  import type { Component } from 'svelte'

  type Props = {
    loader: () => Promise<{ default: Component<any> }>
    props?: Record<string, unknown>
  }
  let { loader, props = {} }: Props = $props()
</script>

{#await loader()}
  <!-- Brief, intentional blank: route chunks are small and usually resolve
       within a frame. A spinner here would flash more than it would help. -->
{:then mod}
  {@const RouteComponent = mod.default}
  <RouteComponent {...props} />
{:catch}
  <section class="mx-auto max-w-3xl px-6 py-24 text-center">
    <h1 class="text-3xl font-bold">Couldn't load this page</h1>
    <p class="mt-3" style="color: var(--site-muted);">
      A network error stopped this page from loading. Please refresh.
    </p>
  </section>
{/await}
