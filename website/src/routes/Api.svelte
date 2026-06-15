<script lang="ts">
  import { sections, sectionGroups, findSection, memberHeading } from '../lib/api-reference'
  import { getApiDemo } from '../lib/api-demos'
  import { openSnippetInStackBlitz } from '../lib/stackblitz'

  let selectedId = $state<string>(sections[0]!.id)
  const current = $derived(findSection(selectedId))
  const demo = $derived(getApiDemo(current.demo))

  function go(id: string) {
    selectedId = id
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    // Switching sections collapses any open per-prop example panels - rows
    // would not match up across sections anyway.
    expanded = {}
  }

  // Per-row "Show example" panels. Keyed by `${sectionId}::${propName}` so a
  // user can keep one open across re-renders within a section.
  let expanded = $state<Record<string, boolean>>({})
  function toggleExample(key: string) {
    expanded[key] = !expanded[key]
  }

  // Per-row "Copy code" feedback. Cleared on a timer so the visual ack
  // doesn't linger after the user moves on.
  let copied = $state<string>('')
  let copyTimer: ReturnType<typeof setTimeout> | null = null
  function copyCode(key: string, code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      copied = key
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        if (copied === key) copied = ''
      }, 1400)
    })
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
              {@const key = `${current.id}::${p.name}`}
              {@const isOpen = !!expanded[key]}
              {@const rowBg = i % 2 === 0 ? 'var(--sg-header-bg)' : 'var(--sg-bg)'}
              <tr style:background={rowBg} style="border-top: 1px solid var(--sg-border)">
                <td class="p-3 align-top font-mono" style="color: var(--sg-fg);">
                  <div class="flex items-center gap-2">
                    {#if p.example}
                      <button
                        type="button"
                        class="api-expand"
                        aria-expanded={isOpen}
                        aria-controls={`example-${key}`}
                        title={isOpen ? 'Hide example' : 'Show example'}
                        onclick={() => toggleExample(key)}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.4"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                          style:transform={isOpen ? 'rotate(90deg)' : 'rotate(0deg)'}
                          style="transition: transform 140ms ease;"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    {:else}
                      <span class="api-expand-placeholder" aria-hidden="true"></span>
                    {/if}
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
                </td>
              </tr>
              {#if isOpen && p.example}
                <tr style:background={rowBg} id={`example-${key}`}>
                  <td colspan="4" class="px-3 pb-4 pt-0">
                    <div
                      class="api-example-panel rounded-lg border p-3"
                      style="border-color: var(--sg-border); background: #0a1124;"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style="background: rgba(249,115,22,0.18); color: #fdba74;"
                          >
                            Example
                          </span>
                          <code class="text-xs" style="color: #cbd5e1;">{p.name}</code>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="api-example-btn"
                            onclick={() => copyCode(key, p.example ?? '')}
                          >
                            {#if copied === key}
                              <svg
                                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e"
                                stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Copied
                            {:else}
                              <svg
                                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                              </svg>
                              Copy code
                            {/if}
                          </button>
                          <button
                            type="button"
                            class="api-example-btn api-example-btn-primary"
                            title="Open this snippet as an editable Svelte 5 + sv-grid-community project in StackBlitz"
                            onclick={() =>
                              openSnippetInStackBlitz({
                                sectionTitle: current.title,
                                sectionCategory: current.category,
                                propName: p.name,
                                propType: p.type,
                                description: p.description,
                                code: p.example ?? '',
                              })}
                          >
                            <svg
                              width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                            >
                              <path d="M10.797 14.182H3.635L16.728 0l-3.525 9.818h7.162L7.272 24l3.525-9.818Z" />
                            </svg>
                            Run in StackBlitz
                          </button>
                        </div>
                      </div>
                      <pre
                        class="text-xs leading-relaxed overflow-x-auto"
                        style="color: #e2e8f0; margin: 0;"
                      ><code>{p.example}</code></pre>
                    </div>
                  </td>
                </tr>
              {/if}
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

  /* Per-prop "Show example" toggle: a flat chevron in the Name column that
     rotates 90deg when the example panel below the row is open. A 14x14
     hit-target sized to match the row baseline. */
  .api-expand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    margin-right: 2px;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--site-accent-2);
    border-radius: 3px;
    flex-shrink: 0;
  }
  .api-expand:hover {
    background: color-mix(in srgb, var(--site-accent-2) 14%, transparent);
  }
  .api-expand:focus-visible {
    outline: 2px solid var(--site-accent);
    outline-offset: 2px;
  }
  /* Reserves chevron width for rows without an example so prop names stay
     vertically aligned with rows that do have one. */
  .api-expand-placeholder {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 2px;
    flex-shrink: 0;
  }

  /* Expanded example panel - the second <tr> we render below the prop row. */
  .api-example-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(148, 163, 184, 0.08);
    color: #e2e8f0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms, border-color 120ms;
  }
  .api-example-btn:hover {
    background: rgba(148, 163, 184, 0.18);
    border-color: rgba(148, 163, 184, 0.45);
  }
  .api-example-btn-primary {
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    border-color: transparent;
  }
  .api-example-btn-primary:hover {
    background: linear-gradient(135deg, #fb923c, #f97316);
    border-color: transparent;
  }
</style>
