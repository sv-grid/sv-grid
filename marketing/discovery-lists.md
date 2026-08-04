# Discovery-list submissions

Evergreen, compounding eyeballs: get SvGrid listed where people already browse
for Svelte components and MCP servers. Each is a small PR or a form. Match each
list's existing entry format exactly (alphabetical order, punctuation, trailing
period) or the maintainer will bounce the PR.

Ready-to-paste entries are below. Where a repo/URL may have moved, confirm the
canonical one before submitting; the entry TEXT is what matters and is reusable.

---

## A. Svelte ecosystem lists

### awesome-svelte

Target: the main `awesome-svelte` list (e.g. `TheComputerM/awesome-svelte`).
Section: **Data / Tables** (or "Components" -> tables). Entry:

```markdown
- [SvGrid](https://github.com/sv-grid/sv-grid) - Svelte 5-native data grid: row/column virtualization (1M rows), Excel-style filters, inline editing, grouping, pivot, Kanban board mode. MIT core, plus an MCP server for AI editors.
```

PR flow:
```bash
# fork the list, then:
git clone https://github.com/<you>/awesome-svelte && cd awesome-svelte
# add the line in the right (usually alphabetical) spot in the Tables/Data section
git checkout -b add-svgrid
git commit -am "Add SvGrid (Svelte 5 data grid)"
git push origin add-svgrid
# open the PR; keep the description one sentence, link the repo + demos
```

### Other Svelte surfaces (no PR, just submit)

- **"This Week in Svelte"** newsletter/community - submit the launch as news.
- **Svelte Society** site / Discord `#showcase` - post the demo video.
- **sveltesociety.dev components directory** - if it accepts submissions, add
  SvGrid under data grids.

---

## B. MCP server lists (the AI-native angle - highest novelty)

The MCP directories are where the differentiated story lands. Same entry text,
several destinations.

### awesome-mcp-servers (GitHub lists)

Targets (submit to the most-starred one first, then others):
`punkpeye/awesome-mcp-servers`, `wong2/awesome-mcp-servers`,
`appcypher/awesome-mcp-servers`.

Section: pick the closest existing category (e.g. **Developer Tools**,
**Frameworks**, or **Code / Docs**). Entry (match the list's icon/format
convention - many prefix a language/emoji tag):

```markdown
- [SvGrid](https://github.com/sv-grid/sv-grid) - MCP server for the SvGrid Svelte 5 data grid: version-pinned prop/method/event reference, 280+ demo sources, and Studio tools that let an agent scaffold a runnable SvelteKit data-app.
```

Install snippet to include if the list has an "installation" column/format:
```json
{ "mcpServers": { "svgrid": { "command": "npx", "args": ["-y", "@svgrid/mcp"] } } }
```

### MCP registries / marketplaces (submission forms or PRs)

These list servers with install buttons and get real traffic:

| Registry | How to submit | Notes |
| --- | --- | --- |
| **Smithery** (smithery.ai) | Add a `smithery.yaml` + submit, or their web form | Big install surface for Cursor/Claude users |
| **mcp.so** | Submission form on the site | High-traffic directory |
| **PulseMCP** (pulsemcp.com) | Submit-a-server form | Curated, good SEO |
| **Glama** (glama.ai/mcp/servers) | Auto-indexes public repos; can claim/submit | Ranks servers |
| **Cline MCP Marketplace** | PR to `cline/mcp-marketplace` repo | In-editor discovery for Cline users |
| **Official MCP registry** (modelcontextprotocol) | PR/registry submission per their contributing guide | Canonical index |

Standard blurb to reuse in every form:

```
SvGrid MCP server (@svgrid/mcp): gives Claude, Cursor, and Zed accurate,
version-pinned APIs for the SvGrid Svelte 5 data grid plus 280+ demo sources as
grounding, and Studio tools an agent can drive to generate a full runnable
SvelteKit data-app. Run: npx -y @svgrid/mcp
```

---

## C. General dev-tool discovery (optional, lower priority)

- **npm keywords** - make sure `@svgrid/grid` / `@svgrid/mcp` package.json
  `keywords` include: `svelte`, `svelte5`, `datagrid`, `data-grid`, `table`,
  `virtualization`, `mcp`, `ai`. (Verify + top up if thin.)
- **llms.txt directories** - SvGrid already publishes `llms.txt` /
  `llms-full.txt`; submit to any llms.txt index sites.
- **StackShare / LibHunt / Openbase**-style tool directories if still active.

---

## Suggested order (do the top 4 first)

1. `awesome-svelte` PR - closest audience, easy accept.
2. Most-starred `awesome-mcp-servers` PR - the novel angle.
3. Smithery + mcp.so submissions - install-button traffic.
4. "This Week in Svelte" + Svelte Discord `#showcase` - native reach.

Everything else is backfill you can knock out over a couple of weeks. None of
these are one-time-value: they keep sending trickle traffic for months.

---

## Want me to open these PRs?

I can draft the exact PR branch + entry line for `awesome-svelte` and
`awesome-mcp-servers` in a local checkout and hand you the `gh pr create` command
to run - I won't push to external repos or post publicly without your say-so. Say
the word and tell me which lists.
