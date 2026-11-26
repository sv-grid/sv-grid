---
'@svgrid/enterprise': minor
---

Base: rights on a record and votes on comments. A field's "Who can edit" may name whoever a person field of the record holds (`field:approver`) and hold only some of a choice field's choices (`editorChoices`), so only a request's approver approves it. A table's `permissions.deleters` say who deletes which record (`canDeleteRecord`), and a Button field's `who` who can press it. Comments take Up and Down votes (a comment store's `vote`, `RecordComment.votes`).
