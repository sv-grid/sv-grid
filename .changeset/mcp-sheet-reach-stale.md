---
"@svgrid/mcp": patch
---

The `build_sheet` prompt told the agent there was no spill, and pointed at
demos that stop before half the shell: dynamic arrays spill, and the
spreadsheet demos now run to 484. It asks for what the search results say
instead, and names the two array forms that genuinely do not parse.

`server.json` also pinned 3.0.1 while the package shipped 3.0.2, which the
registry manifest guard catches; the two are back in step.
