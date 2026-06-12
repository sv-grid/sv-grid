<script lang="ts">
  const claudeDesktopConfig = `{
  "mcpServers": {
    "sv-grid": {
      "command": "npx",
      "args": ["-y", "sv-grid-mcp"]
    }
  }
}`

  const claudeCodeCommand = 'claude mcp add sv-grid -- npx -y sv-grid-mcp'

  const tools = [
    {
      name: 'list_examples',
      args: '-',
      summary: 'List every demo with id, title, and one-line blurb.',
    },
    {
      name: 'get_example_source',
      args: '{ id: string }',
      summary: 'Return the full .svelte source for a demo by id (e.g. "11-stock-market").',
    },
    { name: 'list_docs', args: '-', summary: 'List every documentation page (slug + title).' },
    {
      name: 'get_doc',
      args: '{ slug: string }',
      summary: 'Return the markdown for a single doc by slug.',
    },
    {
      name: 'search_docs',
      args: '{ query: string, limit?: number }',
      summary: 'Case-insensitive substring search across all docs.',
    },
    {
      name: 'get_api_reference',
      args: '-',
      summary: 'Curated public-API surface grouped by category.',
    },
  ]
</script>

<section class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      Model Context Protocol
    </p>
    <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      sv-grid-mcp
    </h1>
    <p class="mt-4 max-w-3xl text-base md:text-lg" style="color: var(--site-muted);">
      Give your AI assistant accurate, version-pinned answers about SvGrid. The
      <code>sv-grid-mcp</code> package is an
      <a class="underline" style="color: var(--site-accent-2);" href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">MCP</a>
      server that exposes every example source, every doc page, and the curated API reference as
      tools - so the model pulls real code instead of hallucinating.
    </p>
  </header>

  <!-- Install -->
  <article class="mb-10">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Install</h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      Zero install with <code>npx</code>, or install globally.
    </p>
    <pre class="mt-4 rounded-lg border p-4 text-sm overflow-x-auto"
      style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code># one-shot
npx sv-grid-mcp

# or install globally
npm install -g sv-grid-mcp
sv-grid-mcp</code></pre>
  </article>

  <!-- Claude Desktop -->
  <article class="mb-10">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Connect Claude Desktop
    </h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      Edit your Claude Desktop config file - on Windows it lives at
      <code>%APPDATA%\Claude\claude_desktop_config.json</code>, on macOS at
      <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>:
    </p>
    <pre class="mt-4 rounded-lg border p-4 text-sm overflow-x-auto"
      style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{claudeDesktopConfig}</code></pre>
    <p class="mt-3 text-sm" style="color: var(--site-muted);">
      Restart Claude Desktop. In a new chat, the SvGrid tools are now available. Ask <em>"using sv-grid,
      build me a grid that groups by department and shows a sparkline per row"</em> and the model will
      pull <code>07-grouping-aggregation</code> + <code>10-custom-cells-and-themes</code> sources before
      generating code.
    </p>
  </article>

  <!-- Claude Code -->
  <article class="mb-10">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Connect Claude Code
    </h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">One command:</p>
    <pre class="mt-4 rounded-lg border p-4 text-sm overflow-x-auto"
      style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{claudeCodeCommand}</code></pre>
    <p class="mt-3 text-sm" style="color: var(--site-muted);">
      Then in a session, run <code>/mcp</code> and you'll see <code>sv-grid</code> listed.
    </p>
  </article>

  <!-- Tool reference -->
  <article class="mb-10">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Tools</h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      The server exposes six tools. All run locally over stdio - no telemetry, no network calls.
    </p>
    <div class="mt-4 overflow-x-auto rounded-lg border" style="border-color: var(--sg-border);">
      <table class="w-full text-sm">
        <thead>
          <tr style="background: var(--sg-row-alt-bg);">
            <th class="p-3 text-left font-semibold">Tool</th>
            <th class="p-3 text-left font-semibold">Arguments</th>
            <th class="p-3 text-left font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {#each tools as t, i}
            <tr
              style:background={i % 2 === 0 ? 'var(--sg-header-bg)' : 'var(--sg-bg)'}
              style="border-top: 1px solid var(--sg-border)"
            >
              <td class="p-3 font-mono" style="color: var(--site-accent-2);">{t.name}</td>
              <td class="p-3 font-mono text-xs" style="color: var(--site-muted);">{t.args}</td>
              <td class="p-3" style="color: var(--sg-fg);">{t.summary}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </article>

  <!-- Why -->
  <article class="mb-10">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Why an MCP server?
    </h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      LLMs hallucinate APIs. They invent prop names, mix up Svelte 4 / Svelte 5 syntax, and pull
      examples from competing libraries. Giving the model an MCP server fixes that at the source:
    </p>
    <ul class="mt-3 space-y-2 text-sm" style="color: var(--sg-fg);">
      <li>
        <strong>Version pinned</strong> - the tool reads the same examples and docs shipped with
        this site, not a 2-year-old blog post.
      </li>
      <li>
        <strong>Real source</strong> - <code>get_example_source</code> returns the verbatim
        <code>.svelte</code> file, including imports.
      </li>
      <li>
        <strong>Local</strong> - runs over stdio, no API key, no network round-trip per tool call.
      </li>
      <li>
        <strong>Zero install</strong> - <code>npx sv-grid-mcp</code> works from any project.
      </li>
    </ul>
  </article>

  <!-- Source -->
  <article>
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Source</h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      The server lives at
      <a class="underline" style="color: var(--site-accent-2);" href="https://github.com/sv-grid/sv-grid/tree/main/packages/sv-grid-mcp" target="_blank" rel="noopener noreferrer">packages/sv-grid-mcp/</a>
      in the SvGrid monorepo. PRs welcome.
    </p>
  </article>
</section>
