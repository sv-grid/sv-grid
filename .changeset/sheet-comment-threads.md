---
"@svgrid/enterprise": minor
---

Comment threads on the spreadsheet shell: a comment can carry an author
and a time, replies under it, and a resolved flag, the way Excel's
threaded comments do. The comment box shows the thread with Edit and
Delete on each entry, a reply box (Ctrl+Enter posts) and Resolve /
Reopen; `commentAuthor` on `SvSheet` signs what is written. A note stays
a plain text in `comments`, so every saved document reads as it did;
`threadAt`, `withThread`, `threadText` and `notesOf` read and write the
new shape. Save As writes a thread as Excel's threaded comment with its
persons part, and Open reads Excel's.
