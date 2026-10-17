# Review blocks

The review section of a product page: a rating summary with a star
distribution, the review feed, and the form to write one. Each block is one
`.svelte` file built from `SvRating`, `SvAvatar`, `SvBadge`, `SvDropDownList`,
`SvFileUpload` and `SvSegmented`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/reviews"></div>

See them first with `npx @svgrid/ui try blocks/reviews`. No project needed.

## Rating summary

The average as a number and a read-only `SvRating` with half stars, the review
count, bars for 5 down to 1 stars, and an `SvProgress` for the share who would
recommend. Click a star row to filter the recent reviews beside it to that
rating; the row is marked with `aria-pressed` and a Clear filter button brings
the full list back. Below 760 px the two columns stack.

<div data-docs-demo="607-block-reviews-summary" data-height="980"></div>

`npx @svgrid/ui add reviews-summary`

## Review list

Each review has an avatar, the reviewer's name, a Verified purchase badge, its
stars, the date, a title and a body that clamps to three lines with Read more.
Helpful counts one vote per review and then locks. Sort by most helpful, newest,
highest or lowest, and Load more shows the next four.

<div data-docs-demo="608-block-reviews-list" data-height="1120"></div>

`npx @svgrid/ui add reviews-list`

## Write a review

A required star rating, a title, a body with a 30-character minimum and a live
counter, up to three photos (images only, 5 MB each) and a yes/no recommend
switch. Submit it empty to see the field errors; a valid form shows the
button's loading state and then a thank-you view with the posted review.

<div data-docs-demo="609-block-reviews-write" data-height="850"></div>

`npx @svgrid/ui add reviews-write`

## Wiring it to SvelteKit

Each block's `<script module>` exports its core: `createReviewSummary()`,
`createReviewList()` and `createReviewForm()`. They take your data and callbacks
as options and fall back to the sample data when you pass none. Take a core
alone with `--headless` (for example `npx @svgrid/ui add reviews-write
--headless`) if you want your own markup.

Compute the distribution in `load`, next to the reviews:

```ts
// src/routes/products/[slug]/+page.server.ts
import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async ({ params }) => {
  const reviews = await db.reviews.findMany({ where: { product: params.slug }, orderBy: { date: 'desc' } })
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const r of reviews) counts[r.rating] += 1
  const recommendPct = reviews.length
    ? Math.round((100 * reviews.filter((r) => r.recommend).length) / reviews.length)
    : 0
  return { reviews, counts, recommendPct }
}
```

and pass it into the summary core, mapping your rows to its review shape:

```ts
const summary = createReviewSummary({
  counts: data.counts,
  recommendPct: data.recommendPct,
  recent: data.reviews.slice(0, 6).map((r) => ({
    id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.author, date: r.dateLabel,
  })),
})
```

For a large catalogue, replace the loop with a `GROUP BY rating` count in SQL.

To post a review, add a form action. The write block gives its controls a
`name`: `SvRating`, `SvTextInput`, `SvTextArea` and `SvSegmented` each render a
hidden `<input>` carrying their value, and `SvFileUpload` a hidden file input
carrying the picked files, so `new FormData(form)` picks up `rating`, `title`,
`body`, `recommend` and `photos`:

```svelte
<script lang="ts">
  import { deserialize } from '$app/forms'

  let formEl!: HTMLFormElement
  const form = createReviewForm({
    onSubmit: async () => {
      const body = new FormData(formEl)
      const res = await fetch('?/review', { method: 'POST', body })
      const result = deserialize(await res.text())
      if (result.type !== 'success') throw new Error('Review not saved')
    },
  })
</script>

<form bind:this={formEl} {...form.formProps()}>...</form>
```

A thrown error keeps the form open with its values. The action re-checks
everything the client checked:

```ts
export const actions: Actions = {
  review: async ({ request, params, locals }) => {
    const data = await request.formData()
    const rating = Number(data.get('rating'))
    const title = String(data.get('title') ?? '').trim()
    const body = String(data.get('body') ?? '').trim()
    const photos = data.getAll('photos')
      .filter((f): f is File => f instanceof File && f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024)
      .slice(0, 3)
    if (!(rating >= 1 && rating <= 5) || !title || body.length < 30) {
      return fail(400, { message: 'Rating, title and a 30-character review are required' })
    }
    await db.reviews.create({
      product: params.slug, user: locals.user.id, rating, title, body,
      recommend: data.get('recommend') === 'yes', photos: await storePhotos(photos),
    })
    return { saved: true }
  },
}
```

In the review list, `onVote` posts the helpful vote (throw to roll the count
back) and `onLoadMore` returns the next page of reviews, which the core appends.
The list stops one vote per review in the browser only; enforce one vote per user
on the server as well.

## See also

- [UI blocks overview](./index.md)
- [SvRating](../ui-components/sv-rating.md)
- [SvFileUpload](../ui-components/sv-file-upload.md)
