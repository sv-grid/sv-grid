---
"@svgrid/grid": minor
---

`@svgrid/grid/sparkline` is a subpath of its own: `buildSparkline` and
`toSparklineValues`, the pure geometry behind `<SvSparkline>`, with no
component in the graph. A build step or a test that wants the shape of a
sparkline without a DOM can import it directly, as the spreadsheet shell's
printer now does.
