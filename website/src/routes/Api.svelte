<script lang="ts">
  import { sections, sectionGroups, findSection, memberHeading } from '../lib/api-reference'
  import { getApiDemo } from '../lib/api-demos'

  let selectedId = $state<string>(sections[0]!.id)
  const current = $derived(findSection(selectedId))
  const demo = $derived(getApiDemo(current.demo))

  function go(id: string) {
    selectedId = id
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }
</script>

<!--
  Layout:
  - The outer container is a normal flex row with no fixed height, so the
    page scrolls with the browser (no inner scrollbar inside <main>).
  - The sidebar is `position: sticky` so it stays visible while the
    reference content scrolls past on the right.
  - On mobile the sidebar hides; the user gets a top "Jump to" select
    fallback further down.
-->
<div class="api-shell flex">
  <aside
    class="api-sidebar hidden md:block w-72 shrink-0 border-r p-4"
    style="border-color: var(--sg-border)"
  >
    <div class="mb-6">
      <h1 class="text-lg font-semibold">SvGrid</h1>
      <p class="text-xs" style="color: var(--sg-muted)">
        API reference · {sections.length} sections
      </p>
    </div>

    <nav aria-label="API sections">
      {#each sectionGroups as group (group.category)}
        <div class="mb-4">
          <p
            class="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style="color: var(--sg-muted);"
          >
            {group.category}
          </p>
          <ul class="space-y-1">
            {#each group.items as s (s.id)}
              {@const active = s.id === current.id}
              <li>
                <button
                  type="button"
                  onclick={() => go(s.id)}
                  class="w-full text-left rounded px-3 py-2 text-sm transition-colors"
                  style:background={active ? 'var(--sg-row-hover-bg)' : 'transparent'}
                  style:color={active ? 'var(--sg-fg)' : 'var(--sg-fg)'}
                  style:font-weight={active ? '600' : '400'}
                >
                  {s.title}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <p class="mt-8 text-xs" style="color: var(--sg-muted)">
      Curated from the public type sources. The data behind this page lives
      in <code>website/src/lib/api-reference.ts</code>.
    </p>
  </aside>

  <main class="flex flex-col flex-1 p-6 max-w-5xl">
    <!-- Mobile-only section picker; the desktop sidebar handles this on md+. -->
    <div class="md:hidden mb-6">
      <label class="text-xs uppercase tracking-wider" style="color: var(--sg-muted);" for="api-mobile-jump">
        Jump to
      </label>
      <select
        id="api-mobile-jump"
        class="mt-1 w-full rounded border p-2 text-sm"
        style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
        value={selectedId}
        onchange={(e) => go((e.currentTarget as HTMLSelectElement).value)}
      >
        {#each sectionGroups as group (group.category)}
          <optgroup label={group.category}>
            {#each group.items as s (s.id)}
              <option value={s.id}>{s.title}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    <header class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        {current.category}
      </p>
      <h1
        class="mt-2 text-3xl md:text-4xl font-bold tracking-tight"
        style="color: var(--sg-fg);"
      >
        {current.title}
      </h1>
      <p class="mt-3 text-base md:text-lg" style="color: var(--site-muted);">{current.blurb}</p>
    </header>

    {#if current.intro}
      <div class="space-y-4 mb-8">
        {#each current.intro as para}
          <p style="color: var(--sg-fg)" class="text-base leading-relaxed">{para}</p>
        {/each}
      </div>
    {/if}

    {#if demo}
      {@const DemoComponent = demo}
      <div class="mb-10">
        <div class="flex items-center gap-2 mb-3">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style="background: rgba(34,197,94,0.15); color: #16a34a;"
          >
            <span
              style="width: 7px; height: 7px; border-radius: 9999px; background: #22c55e; display: inline-block;"
            ></span>
            Live example
          </span>
          <span class="text-xs" style="color: var(--sg-muted);">Runs the real grid - edit, sort, filter, click.</span>
        </div>
        <div
          class="rounded-xl border p-4"
          style="border-color: var(--sg-border); background: var(--sg-bg);"
        >
          {#key current.id}
            <DemoComponent />
          {/key}
        </div>
      </div>
    {/if}

    {#if current.signature}
      <h2 class="mt-4 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Signature
      </h2>
      <pre class="rounded-lg border p-4 text-sm overflow-x-auto font-mono leading-relaxed"
        style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{current.signature}</code></pre>
    {/if}

    {#if current.props && current.props.length > 0}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        {memberHeading(current.category)}
      </h2>
      <div class="overflow-x-auto rounded-lg border" style="border-color: var(--sg-border);">
        <table class="w-full text-sm">
          <thead>
            <tr style="background: var(--sg-row-alt-bg);">
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Name</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Type</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Default</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Description</th>
            </tr>
          </thead>
          <tbody>
            {#each current.props as p, i (p.name)}
              <tr
                style:background={i % 2 === 0 ? 'var(--sg-header-bg)' : 'var(--sg-bg)'}
                style="border-top: 1px solid var(--sg-border)"
              >
                <td class="p-3 align-top font-mono" style="color: var(--sg-fg);">
                  <div class="flex items-center gap-2">
                    <span>{p.name}</span>
                    {#if p.required}
                      <span
                        class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style="background: rgba(239,68,68,0.15); color: #fca5a5;"
                      >
                        Required
                      </span>
                    {/if}
                  </div>
                  {#if p.since}
                    <div class="mt-0.5 text-[11px]" style="color: var(--sg-muted);">since {p.since}</div>
                  {/if}
                </td>
                <td class="p-3 align-top font-mono text-xs" style="color: var(--site-accent-2);">{p.type}</td>
                <td class="p-3 align-top font-mono text-xs" style="color: var(--sg-muted);">{p.default ?? ''}</td>
                <td class="p-3 align-top" style="color: var(--sg-fg);">
                  <div>{p.description}</div>
                  {#if p.example}
                    <pre class="mt-2 rounded p-2 text-xs overflow-x-auto"
                      style="background: #0a1124; color: #e2e8f0;"><code>{p.example}</code></pre>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if current.example}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Example
      </h2>
      <h3 class="text-lg font-semibold" style="color: var(--sg-fg);">{current.example.title}</h3>
      {#if current.example.description}
        <p class="mt-1 text-sm" style="color: var(--site-muted);">{current.example.description}</p>
      {/if}
      <pre class="mt-3 rounded-lg border p-4 text-sm overflow-x-auto font-mono leading-relaxed"
        style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{current.example.code}</code></pre>
    {/if}

    {#if current.notes && current.notes.length > 0}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Notes & gotchas
      </h2>
      <ul class="space-y-2">
        {#each current.notes as note}
          <li
            class="flex items-start gap-2 rounded-lg border p-3 text-sm"
            style="border-color: var(--sg-border); background: var(--sg-header-bg); color: var(--sg-fg);"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="color: var(--site-accent-2); margin-top: 1px; flex-shrink: 0;"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{note}</span>
          </li>
        {/each}
      </ul>
    {/if}

    <footer class="mt-16 border-t pt-6" style="border-color: var(--sg-border);">
      <p class="text-sm" style="color: var(--site-muted);">
        Found a mistake or missing detail? The page is generated from
        <a
          class="underline"
          style="color: var(--site-accent-2);"
          href="https://github.com/sv-grid/sv-grid/blob/main/website/src/lib/api-reference.ts"
          target="_blank"
          rel="noopener noreferrer"
        >website/src/lib/api-reference.ts</a> - PRs welcome.
      </p>
    </footer>
  </main>
</div>

<style>
  /* Sticky sidebar: stays pinned to the top of the viewport (below the
     site header) while the right-hand reference scrolls. self-start is
     critical so the flex parent doesn't stretch the aside to the same
     height as <main>, which would defeat `position: sticky`. */
  .api-shell { align-items: flex-start; }
  .api-sidebar {
    position: sticky;
    top: 4rem; /* site header height */
    align-self: flex-start;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }
</style>
