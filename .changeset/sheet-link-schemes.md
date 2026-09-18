---
"@svgrid/enterprise": patch
---

Only the schemes a hyperlink can sensibly mean are followed.

A link is data: it is typed by a colleague, arrives on a delta stream, or
comes out of a file someone sent. A target reading `javascript:...` parsed
as an ordinary external link, which the shell then opened, running that
text against the page.

`parseLinkTarget` now returns null for any scheme outside `http`, `https`,
`mailto`, `tel`, `sms`, `ftp` and `ftps`, so such a target is not a link at
all: the cell keeps its text, clicking it says it cannot be opened, and the
writer leaves it out of the .xlsx rather than putting it in a file that is
then passed on. `isSafeLinkTarget` is exported for anything that wants to
check a target before storing one.
