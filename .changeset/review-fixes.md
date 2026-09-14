---
"@svgrid/enterprise": patch
"@svgrid/grid": patch
---

Fix six bugs a review of the spreadsheet work turned up, each of which had
shipped with passing tests.

**Parentheses were dropped when a formula was re-serialised.** The AST does not
record them, and `translateFormula` / `fixupReferences` emitted operands bare,
so `=(A1+B1)*2` filled down became `=A2+B2*2`. Silent wrong numbers on every
fill, paste and insert-row. They are now rebuilt from precedence, with the
right operand parenthesised at equal precedence (`a-(b-c)` is not `a-b-c`) and
the mirror rule for right-associative `^`, where the LEFT operand is the one
that needs it.

**`%` was a binary modulo instead of Excel's postfix percent**, so `=50%` and
`=A1*5%` returned `#PARSE!`. Excel has no binary `%`; `MOD()` is the function.

**`Ctrl+Shift+1` through `6`, `Ctrl+Shift+;` and ``Ctrl+Shift+` `` could never
fire in a browser.** The bindings spelled the unshifted character while
matching on `event.key`, which reports `!` for `Ctrl+Shift+1` on a US layout.
Every test synthesized the event by hand with `key: '1'`, so they all passed.
Those bindings now match `event.code`, falling back to `key` when `code` is
absent.

**The shortcut chain ran before the grid-root guard**, so with `enableSheet()`
a `Ctrl+A` or `Ctrl+D` typed into a column filter input ran a sheet command and
mutated grid cells. It now runs after that guard; the editor keeps its own
chain call, which is what `Alt+Enter` needs.

**`=IF()`, `=IFS()`, `=IFERROR()`, `=IFNA()` and `=SWITCH()` with no arguments
threw a `TypeError` straight past `evaluate()`**, which promises callers it
never throws. They return `#VALUE!`, and the boundary catches `TypeError` as a
last resort.

**`hydrate()` did not rebuild the format store's row and column indexes**, so
`forgetRow` and `forgetColumn` were silent no-ops on a restored store and the
delete cleanup in `structure.ts` dropped nothing. Keys are now
percent-encoded, which is what makes them splittable back apart when an id
contains a space.

Also fixes `SVGRID_VERSION`, which release 3.0.1 left at `3.0.0` because
changesets does not know about the constant.
