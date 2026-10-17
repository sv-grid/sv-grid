<script lang="ts" module>
  /**
   * Write a review block - the review form of a product page. SvRating is the
   * required star input, SvTextInput takes the title, SvTextArea the body (30
   * characters minimum, live counter in the hint), SvFileUpload up to three
   * images, and SvSegmented a yes/no "would you recommend". Submit validates,
   * shows the SvButton loading state, then a thank-you view with the posted
   * review. Pure UI-kit, --sg-* themed.
   *
   * Headless: createReviewForm() below owns the fields, validation and the
   * submit flow with no markup. The component under it is one styled render of
   * that core; import createReviewForm from this file (or `npx @svgrid/ui add
   * reviews-write --headless` for the core alone) to draw your own.
   */
  export type ReviewField = 'rating' | 'title' | 'body'
  export type ReviewValues = {
    rating: number; title: string; body: string; photos: File[]; recommend: 'yes' | 'no' | null
  }
  export type ReviewFormOptions = {
    minBody?: number
    /** Post the review; throw (or reject) to keep the form open. */
    onSubmit?: (values: ReviewValues) => Promise<void> | void
    /** Called with the first invalid field after a failed submit (focus it). */
    onInvalid?: (field: ReviewField) => void
  }

  export const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

  export function createReviewForm(opts: ReviewFormOptions = {}) {
    const minBody = opts.minBody ?? 30
    let rating = $state(0)
    let title = $state('')
    let body = $state('')
    let photos = $state<File[]>([])
    let recommend = $state<'yes' | 'no' | null>(null)
    let tried = $state(false)
    let status = $state<'form' | 'sending' | 'done'>('form')

    const length = $derived(body.trim().length)
    const errors = $derived<Partial<Record<ReviewField, string>>>({
      rating: rating === 0 ? 'Choose a star rating' : undefined,
      title: title.trim() === '' ? 'Add a short title' : undefined,
      body: length < minBody ? `Write at least ${minBody} characters (${length} so far)` : undefined,
    })

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (status !== 'form') return
      tried = true
      const first = (['rating', 'title', 'body'] as const).find((k) => errors[k])
      if (first) { opts.onInvalid?.(first); return }
      status = 'sending'
      try {
        await opts.onSubmit?.({ rating, title: title.trim(), body: body.trim(), photos, recommend })
        status = 'done'
      } catch {
        status = 'form'
      }
    }

    function reset() {
      rating = 0; title = ''; body = ''; photos = []; recommend = null; tried = false
      status = 'form'
    }

    return {
      minBody,
      get rating() { return rating },
      set rating(v: number) { rating = v },
      get title() { return title },
      set title(v: string) { title = v },
      get body() { return body },
      set body(v: string) { body = v },
      get photos() { return photos },
      set photos(v: File[]) { photos = v },
      get recommend() { return recommend },
      set recommend(v: 'yes' | 'no' | null) { recommend = v },
      get status() { return status },
      /** Counter text for the body field. */
      get bodyHint() { return length < minBody ? `${length} / ${minBody} characters minimum` : `${length} characters` },
      /** A field's error, shown only after the first submit attempt. */
      error: (f: ReviewField) => (tried ? errors[f] : undefined),
      submit,
      reset,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
    }
  }
</script>

<script lang="ts">
  import {
    SvRating, SvTextInput, SvTextArea, SvFileUpload, SvSegmented, SvButton, SvBadge,
    SvToaster, toast,
  } from '@svgrid/grid'
  import type { FileRejection } from '@svgrid/grid'

  const form = createReviewForm({
    // Replace with your POST (FormData with the photos); a throw keeps the form open.
    onSubmit: () => new Promise<void>((res) => setTimeout(res, 1000)).then(() => { toast.success('Review posted') }),
    onInvalid: (f) => document.getElementById(`sv-review-write-${f}`)?.focus(),
  })

  const recommendOptions = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
  const setRecommend = (v: string | number) => (form.recommend = v === 'yes' ? 'yes' : 'no')

  // Local previews of the chosen photos; revoked when the selection changes.
  const previews = $derived(form.photos.map((f) => URL.createObjectURL(f)))
  $effect(() => {
    const urls = previews
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  })

  function rejected(list: FileRejection[]) {
    const why = { type: 'is not an image', size: 'is over 5 MB', count: 'is past the 3-photo limit' }
    toast.warning(list.map((r) => `${r.file.name} ${why[r.reason]}`).join('. '))
  }
</script>

<main class="sv-review-write">
  <div class="sv-review-write-panel">
    <div class="sv-review-write-product">
      <span class="sv-review-write-thumb" aria-hidden="true"></span>
      <div>
        <span class="sv-review-write-muted">Reviewing</span>
        <strong>Fieldline Trail Pack 28L</strong>
      </div>
    </div>

    {#if form.status === 'done'}
      <div class="sv-review-write-done" role="status">
        <span class="sv-review-write-check" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <h2>Thanks for your review</h2>
        <p class="sv-review-write-muted">It is live on the product page. Here is how it looks:</p>
      </div>
      <article class="sv-review-write-preview">
        <div class="sv-review-write-preview-head">
          <SvRating value={form.rating} readonly size="sm" ariaLabel={`Rated ${form.rating} out of 5`} />
          {#if form.recommend === 'yes'}<SvBadge variant="success" size="sm">Recommends</SvBadge>{/if}
        </div>
        <h3>{form.title}</h3>
        <p>{form.body}</p>
        {#if previews.length}
          <div class="sv-review-write-photos">
            {#each previews as src, i (src)}<img {src} alt={`Photo ${i + 1} of ${previews.length}`} />{/each}
          </div>
        {/if}
        <span class="sv-review-write-muted">Ada Lovelace - Verified purchase</span>
      </article>
      <SvButton variant="outline" onclick={form.reset}>Write another review</SvButton>
    {:else}
      <h2>Write a review</h2>
      <form class="sv-review-write-form" {...form.formProps()}>
        <div class="sv-review-write-rating">
          <SvRating
            id="sv-review-write-rating" name="rating" label="Overall rating" size="lg" required
            value={form.rating} onChange={(v) => (form.rating = v)}
            invalid={!!form.error('rating')} error={form.error('rating')}
          />
          <span class="sv-review-write-word" aria-hidden="true">{RATING_WORDS[form.rating]}</span>
        </div>

        <SvTextInput
          id="sv-review-write-title" name="title" label="Title" bind:value={form.title} maxlength={80} required block
          placeholder="Sum it up in a line"
          invalid={!!form.error('title')} error={form.error('title')}
        />

        <SvTextArea
          id="sv-review-write-body" name="body" label="Review" bind:value={form.body} rows={5} maxlength={2000} required block
          placeholder="What did you use it for? How did it hold up?"
          hint={form.bodyHint}
          invalid={!!form.error('body')} error={form.error('body')}
        />

        <SvFileUpload
          label="Photos (optional)" name="photos" hint="Up to 3 images, 5 MB each" accept="image/*" multiple
          maxFiles={3} maxSize={5 * 1024 * 1024} bind:files={form.photos} onReject={rejected} block
        />

        <SvSegmented
          name="recommend" label="Would you recommend it?" options={recommendOptions}
          value={form.recommend} onChange={setRecommend}
        />

        <div class="sv-review-write-actions">
          <span class="sv-review-write-muted">Posting as Ada Lovelace</span>
          <SvButton type="submit" variant="primary" loading={form.status === 'sending'}>Submit review</SvButton>
        </div>
      </form>
    {/if}
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  /* Empty stars from the theme: the kit falls back to a light grey that glares on dark themes. */
  .sv-review-write :global(.sv-rating) { --_off: var(--sg-rating-empty, color-mix(in srgb, var(--sg-fg, #0f172a) 22%, var(--sg-bg, #fff))); }
  .sv-review-write {
    width: 100%; box-sizing: border-box; min-height: 560px;
    display: flex; justify-content: center; padding: 32px 24px;
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-review-write-panel {
    width: 100%; max-width: 560px; box-sizing: border-box; align-self: flex-start;
    display: flex; flex-direction: column; gap: 18px; padding: 28px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-review-write h2 { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
  .sv-review-write-muted { font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-review-write-product { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-review-write-product div { display: flex; flex-direction: column; }
  .sv-review-write-product strong { font-size: 14px; }
  .sv-review-write-thumb {
    width: 44px; height: 44px; flex: none; border-radius: var(--sg-radius, 8px);
    background: linear-gradient(160deg, color-mix(in srgb, var(--sg-fg, #0f172a) 18%, var(--sg-bg, #fff)) 0 38%, color-mix(in srgb, var(--sg-fg, #0f172a) 32%, var(--sg-bg, #fff)) 38% 100%);
  }

  .sv-review-write-form { display: flex; flex-direction: column; gap: 18px; }
  .sv-review-write-rating { display: flex; align-items: flex-end; gap: 12px; }
  .sv-review-write-word { font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); padding-bottom: 6px; min-height: 1em; }
  .sv-review-write-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 4px; }

  .sv-review-write-done { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .sv-review-write-done p { margin: 0; }
  .sv-review-write-check {
    display: inline-flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 50%;
    background: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent); color: var(--sg-success, #16a34a);
  }
  .sv-review-write-check svg { display: block; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .sv-review-write-preview {
    padding: 16px; border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff));
    overflow-wrap: anywhere;
  }
  .sv-review-write-preview-head { display: flex; align-items: center; gap: 10px; }
  .sv-review-write-preview h3 { margin: 10px 0 4px; font-size: 15px; font-weight: 650; }
  .sv-review-write-preview p { margin: 0 0 10px; font-size: 14px; line-height: 1.55; white-space: pre-line; }
  .sv-review-write-photos { display: flex; gap: 8px; margin-bottom: 10px; }
  .sv-review-write-photos img { display: block; width: 64px; height: 64px; object-fit: cover; border-radius: 6px; border: 1px solid var(--sg-border, #e2e8f0); }

  @media (max-width: 600px) {
    .sv-review-write { padding: 16px; min-height: 0; }
    .sv-review-write-panel { padding: 20px 16px; }
    .sv-review-write-actions { flex-direction: column-reverse; align-items: stretch; text-align: center; }
  }
</style>
