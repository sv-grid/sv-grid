<script lang="ts" module>
  /**
   * Comment feed block - a discussion thread under a design doc. Each comment
   * has an SvAvatar, name, relative time, body and Like / Reply actions, with
   * one level of nested replies. Reply opens an inline SvTextArea composer
   * under that comment; the SvTextArea + SvButton composer at the bottom
   * validates and appends a new comment with a toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createComments() below owns the thread, likes, the reply and
   * main composers, their validation and the post flow with no markup. The
   * component under it is one styled render of that core; import
   * createComments from this file (or `npx @svgrid/ui add
   * activity-feeds-comments --headless` for the core alone) to draw your own.
   */
  export type Comment = { id: number; author: string; at: number; body: string; likes: number; liked: boolean; replies: Comment[] }
  export type CommentsOptions = {
    /** The signed-in user; new comments are posted as them. */
    me?: string
    /** One clock for the whole thread: every relative time is measured from here. */
    now?: number
    thread?: Comment[]
    /** Persist a comment or reply (`parent` is null for a top-level one); throw to keep the draft. */
    onPost?: (body: string, parent: Comment | null) => Promise<void> | void
    /** Called after a comment or reply is appended. */
    onPosted?: (comment: Comment, parent: Comment | null) => void
    /** Called after Reply opens a composer; focus `replyId(parentId)` here. */
    onReplyOpen?: (parentId: number) => void
  }

  function sampleThread(now: number): Comment[] {
    const ago = (minutes: number) => now - minutes * 60_000
    return [
      {
        id: 1, author: 'Maya Chen', at: ago(60 * 26), likes: 4, liked: false,
        body: 'Moving nightly exports onto the warehouse queue frees the API workers between 01:00 and 03:00. I would ship it behind a per-workspace flag first.',
        replies: [
          { id: 2, author: 'Jonas Weber', at: ago(60 * 23), likes: 1, liked: true, body: 'Agreed on the flag. We should also alert if an export sits in the queue for more than 20 minutes.', replies: [] },
        ],
      },
      {
        id: 3, author: 'Ruth Adeyemi', at: ago(95), likes: 2, liked: false,
        body: 'Finance pulls the ledger export at 06:00 UTC. As long as it lands before then, the window works for us.',
        replies: [],
      },
    ]
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const check = (text: string) => (!text.trim() ? 'Write something first' : text.trim().length < 3 ? 'Too short to post' : undefined)

  export function createComments(opts: CommentsOptions = {}) {
    const me = opts.me ?? 'Ada Park'
    const now = opts.now ?? Date.now()
    let nextId = 100

    let thread = $state<Comment[]>(opts.thread ?? sampleThread(now))
    let draft = $state('')
    let draftError = $state<string | undefined>()
    let posting = $state(false)
    let replyTo = $state<number | null>(null)
    let reply = $state('')
    let replyError = $state<string | undefined>()

    const count = $derived(thread.reduce((n, c) => n + 1 + c.replies.length, 0))

    function relative(at: number) {
      const s = Math.round(Math.min(0, at - now) / 1000)
      if (s > -60) return rtf.format(0, 'second')
      if (s > -3600) return rtf.format(Math.round(s / 60), 'minute')
      if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour')
      return rtf.format(Math.round(s / 86400), 'day')
    }

    const make = (body: string): Comment => ({ id: nextId++, author: me, at: Date.now(), body: body.trim(), likes: 0, liked: false, replies: [] })

    function toggleLike(c: Comment) {
      c.liked = !c.liked
      c.likes += c.liked ? 1 : -1
    }

    /** Open the reply composer under `parent`; replying to a nested comment prefills an @mention. */
    function openReply(parent: Comment, to: Comment) {
      replyTo = parent.id
      reply = to === parent ? '' : `@${to.author.split(' ')[0]} `
      replyError = undefined
      opts.onReplyOpen?.(parent.id)
    }
    function cancelReply() { replyTo = null }

    async function postReply(parent: Comment) {
      replyError = check(reply)
      if (replyError) return
      await opts.onPost?.(reply.trim(), parent)
      const c = make(reply)
      parent.replies.push(c)
      replyTo = null
      reply = ''
      opts.onPosted?.(c, parent)
    }

    async function post(e?: Event) {
      e?.preventDefault()
      if (posting) return
      draftError = check(draft)
      if (draftError) return
      posting = true
      try {
        await opts.onPost?.(draft.trim(), null)
        const c = make(draft)
        thread.push(c)
        draft = ''
        opts.onPosted?.(c, null)
      } finally {
        posting = false
      }
    }

    return {
      me,
      get thread() { return thread },
      get count() { return count },
      get draft() { return draft },
      set draft(v: string) { draft = v; draftError = undefined },
      get draftError() { return draftError },
      get posting() { return posting },
      /** Id of the top-level comment whose reply composer is open. */
      get replyTo() { return replyTo },
      get reply() { return reply },
      set reply(v: string) { reply = v; replyError = undefined },
      get replyError() { return replyError },
      relative,
      toggleLike,
      openReply,
      cancelReply,
      postReply,
      post,
      /** DOM id of the reply field under a top-level comment. */
      replyId: (parentId: number) => `sv-discuss-reply-${parentId}`,
      /** Spread on the bottom composer's <form>. */
      formProps: () => ({ novalidate: true, onsubmit: post }),
      /** Spread on a comment's Like <button>. */
      likeProps: (c: Comment) => ({
        type: 'button' as const,
        'aria-pressed': c.liked,
        onclick: () => toggleLike(c),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvTextArea, SvButton, SvToaster, toast } from '@svgrid/grid'

  const discussion = createComments({
    // Stand-in for a POST to your comments endpoint (replies post at once here).
    onPost: (_body, parent) => (parent ? undefined : new Promise<void>((res) => setTimeout(res, 600))),
    onPosted: (_c, parent) => toast.success(parent ? 'Reply posted' : 'Comment posted'),
    // Focus with the caret after the @mention (autofocus would select it all).
    onReplyOpen: (id) => requestAnimationFrame(() => {
      const el = document.getElementById(discussion.replyId(id))
      if (el instanceof HTMLTextAreaElement) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    }),
  })
</script>

<section class="sv-discuss" aria-labelledby="sv-discuss-title">
  <header class="sv-discuss-head">
    <h2 id="sv-discuss-title">Discussion</h2>
    <p class="sv-discuss-muted">RFC 18: Move nightly exports to the warehouse queue · {discussion.count} comments</p>
  </header>

  <ol class="sv-discuss-thread">
    {#each discussion.thread as c (c.id)}
      <li>
        {@render entry(c, c)}
        {#if c.replies.length || discussion.replyTo === c.id}
          <ol class="sv-discuss-replies">
            {#each c.replies as r (r.id)}
              <li>{@render entry(r, c)}</li>
            {/each}
            {#if discussion.replyTo === c.id}
              <li class="sv-discuss-reply-box">
                <SvTextArea id={discussion.replyId(c.id)} label="Reply to {c.author}" bind:value={discussion.reply} rows={2} autoGrow block
                  error={discussion.replyError} invalid={!!discussion.replyError} onCommit={() => discussion.postReply(c)} onCancel={discussion.cancelReply} />
                <div class="sv-discuss-row-end">
                  <SvButton variant="ghost" size="sm" onclick={discussion.cancelReply}>Cancel</SvButton>
                  <SvButton size="sm" onclick={() => discussion.postReply(c)}>Reply</SvButton>
                </div>
              </li>
            {/if}
          </ol>
        {/if}
      </li>
    {/each}
  </ol>

  <form class="sv-discuss-composer" {...discussion.formProps()}>
    <SvAvatar name={discussion.me} size="sm" />
    <div class="sv-discuss-compose-body">
      <SvTextArea label="Add a comment" placeholder="Share feedback on this RFC" bind:value={discussion.draft} rows={3} maxlength={2000}
        block error={discussion.draftError} invalid={!!discussion.draftError} onCommit={() => discussion.post()} />
      <div class="sv-discuss-row-end">
        <span class="sv-discuss-hint">Ctrl+Enter to post</span>
        <SvButton type="submit" loading={discussion.posting}>Post</SvButton>
      </div>
    </div>
  </form>
</section>

{#snippet entry(c: Comment, parent: Comment)}
  <article class="sv-discuss-entry">
    <SvAvatar name={c.author} size={c === parent ? 'md' : 'sm'} />
    <div class="sv-discuss-main">
      <div class="sv-discuss-meta">
        <strong>{c.author}</strong>
        <time datetime={new Date(c.at).toISOString()}>{discussion.relative(c.at)}</time>
      </div>
      <p class="sv-discuss-body">{c.body}</p>
      <div class="sv-discuss-actions">
        <button type="button" class="sv-discuss-act" class:sv-discuss-on={c.liked} aria-pressed={c.liked} onclick={() => discussion.toggleLike(c)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill={c.liked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
          Like{c.likes ? ` ${c.likes}` : ''}
        </button>
        <button type="button" class="sv-discuss-act" onclick={() => discussion.openReply(parent, c)}>Reply</button>
      </div>
    </div>
  </article>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-discuss {
    width: 100%; box-sizing: border-box; max-width: 720px; margin: 0 auto; padding: 28px 28px 32px; min-height: 560px;
    display: flex; flex-direction: column; gap: 20px;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); font-family: var(--sg-font, inherit);
  }
  .sv-discuss-head h2 { margin: 0 0 4px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-discuss-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-discuss-thread, .sv-discuss-replies { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
  .sv-discuss-replies { margin: 14px 0 0 46px; padding-left: 14px; gap: 14px; border-left: 2px solid var(--sg-border, #e2e8f0); }
  .sv-discuss-entry { display: flex; gap: 10px; align-items: flex-start; }
  .sv-discuss-main { min-width: 0; flex: 1; }
  .sv-discuss-meta { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 13.5px; }
  .sv-discuss-meta strong { font-weight: 600; }
  time { font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-discuss-body { margin: 3px 0 6px; font-size: 13.5px; line-height: 1.55; overflow-wrap: anywhere; white-space: pre-line; }
  .sv-discuss-actions { display: flex; gap: 4px; margin-left: -6px; }
  .sv-discuss-act {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 6px; border: 0; border-radius: var(--sg-radius, 6px);
    background: none; font: inherit; font-size: 12.5px; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-discuss-act svg { display: block; }
  .sv-discuss-act:hover { color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .sv-discuss-act.sv-discuss-on { color: var(--sg-danger, #dc2626); }
  .sv-discuss-act:focus-visible { outline: 2px solid var(--sg-focus-ring, #6366f1); outline-offset: 1px; }
  .sv-discuss-reply-box { display: flex; flex-direction: column; gap: 8px; }
  .sv-discuss-row-end { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
  .sv-discuss-composer {
    display: flex; gap: 10px; align-items: flex-start; padding-top: 18px; margin-top: auto;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-discuss-compose-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .sv-discuss-hint { margin-right: auto; font-size: 12px; color: var(--sg-muted, #64748b); }

  @media (max-width: 560px) {
    .sv-discuss { padding: 20px 16px 24px; }
    .sv-discuss-replies { margin-left: 16px; padding-left: 12px; }
    .sv-discuss-actions { flex-wrap: wrap; }
    .sv-discuss-composer > :global(:first-child) { display: none; }
    .sv-discuss-hint { display: none; }
  }
</style>
