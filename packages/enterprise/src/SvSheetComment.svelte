<script lang="ts">
  /**
   * The comment box: Excel's note editor for a new comment, and its
   * threaded comment card once one is there. New: a textarea over the
   * text, Save, and the text kept whatever closes the box (Escape and a
   * click elsewhere included), which is why every keystroke is reported
   * through `onDraft` and the shell saves the draft on dismissal;
   * Ctrl+Enter saves too. Existing: the first entry with its author and
   * time, the replies under it, Edit and Delete on each, a reply box,
   * and Resolve / Reopen in the head. Replies, edits and the resolved
   * state go out whole through `onUpdate`; the first text through
   * `onSave`, as before; Delete removes the thread. The shell mounts it
   * inside the popover anchored to the cell.
   */
  import { useSheetText } from './sheet-text'
  import type { CommentThread, CommentEntry } from './sheet/comments'

  type Props = {
    /** The comment as it is, null for a new one. */
    thread: CommentThread | null
    /** The first text as it stands, the draft the box opens on. */
    text: string
    /** A1 of the cell, for the heading. */
    address: string
    /** Who signs a reply, when the application says. */
    author?: string
    /** For the times. */
    locale?: string
    /** Every change of the first text, so the shell can keep it on dismissal. */
    onDraft: (text: string) => void
    onSave: (text: string) => void
    onDelete: () => void
    /** A reply, an edited or deleted reply, or Resolve / Reopen: the whole thread as it should be. */
    onUpdate: (thread: CommentThread) => void
  }

  let { thread, text, address, author, locale, onDraft, onSave, onDelete, onUpdate }: Props = $props()
  const t = useSheetText()

  let draft = $state('')
  let editingRoot = $state(false)
  let reply = $state('')
  let editingReply = $state<number | null>(null)
  let replyDraft = $state('')
  let box = $state<HTMLTextAreaElement | null>(null)
  let replyBox = $state<HTMLTextAreaElement | null>(null)

  $effect(() => {
    draft = text
    editingRoot = false
    editingReply = null
    reply = ''
    queueMicrotask(() => {
      const target = thread ? replyBox : box
      if (!target) return
      target.focus()
      target.setSelectionRange(target.value.length, target.value.length)
    })
  })

  const composing = $derived(!thread || editingRoot)

  function when(at: string | undefined): string {
    if (!at) return ''
    const ms = Date.parse(at)
    if (!Number.isFinite(ms)) return ''
    try {
      return new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    }
  }

  const stamp = (): Pick<CommentEntry, 'author' | 'at'> => ({ ...(author ? { author } : {}), at: new Date().toISOString() })

  function saveRoot() {
    editingRoot = false
    onSave(draft)
  }

  function postReply() {
    const body = reply.trim()
    if (!thread || !body) return
    onUpdate({ ...thread, replies: [...(thread.replies ?? []), { text: body, ...stamp() }] })
    reply = ''
  }

  function saveReply(index: number) {
    if (!thread) return
    const body = replyDraft.trim()
    const replies = (thread.replies ?? []).map((r, i) => (i === index ? { ...r, text: body } : r)).filter((r) => r.text)
    editingReply = null
    onUpdate({ ...thread, replies })
  }

  function deleteReply(index: number) {
    if (!thread) return
    onUpdate({ ...thread, replies: (thread.replies ?? []).filter((_, i) => i !== index) })
  }

  function setResolved(resolved: boolean) {
    if (!thread) return
    const next = { ...thread }
    if (resolved) next.resolved = true
    else delete next.resolved
    onUpdate(next)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    const target = event.target
    if (target === replyBox) postReply()
    else if (editingReply !== null) saveReply(editingReply)
    else if (composing) saveRoot()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sv-sheet-comment" class:threaded={!!thread} role="dialog" tabindex="-1" aria-label={t('commentOn', { address })} onkeydown={onKeyDown}>
  <div class="head">
    <span>{address}</span>
    {#if thread}
      {#if thread.resolved}
        <span class="badge">{t('commentResolved')}</span>
        <button type="button" class="link" onclick={() => setResolved(false)}>{t('commentReopen')}</button>
      {:else}
        <button type="button" class="link" onclick={() => setResolved(true)}>{t('commentResolve')}</button>
      {/if}
    {/if}
  </div>
  {#if composing}
    <textarea
      bind:this={box}
      bind:value={draft}
      oninput={() => onDraft(draft)}
      rows="4"
      aria-label={t('comment')}
      placeholder={t('commentPlaceholder')}
      spellcheck="false"
    ></textarea>
    <div class="sv-sheet-dialog-buttons">
      <span class="keys">{t('commentSaves')}</span>
      <button type="button" class="btn primary" onclick={saveRoot}>{t('save')}</button>
      {#if thread}
        <button type="button" class="btn" onclick={() => { draft = text; onDraft(text); editingRoot = false }}>{t('cancel')}</button>
      {:else if text}
        <button type="button" class="btn" onclick={onDelete}>{t('delete')}</button>
      {/if}
    </div>
  {:else if thread}
    <div class="entry root">
      <div class="who">
        {#if thread.author}<span class="author">{thread.author}</span>{/if}
        {#if thread.at}<span class="when">{when(thread.at)}</span>{/if}
      </div>
      <div class="text">{thread.text}</div>
      <div class="actions">
        <button type="button" class="link" onclick={() => { editingRoot = true; queueMicrotask(() => box?.focus()) }}>{t('commentEdit')}</button>
        <button type="button" class="link" onclick={onDelete}>{t('delete')}</button>
      </div>
    </div>
    {#each thread.replies ?? [] as entry, i (i)}
      <div class="entry reply">
        <div class="who">
          {#if entry.author}<span class="author">{entry.author}</span>{/if}
          {#if entry.at}<span class="when">{when(entry.at)}</span>{/if}
        </div>
        {#if editingReply === i}
          <textarea bind:value={replyDraft} rows="3" aria-label={t('commentReply')} spellcheck="false"></textarea>
          <div class="actions">
            <button type="button" class="link" onclick={() => saveReply(i)}>{t('save')}</button>
            <button type="button" class="link" onclick={() => (editingReply = null)}>{t('cancel')}</button>
          </div>
        {:else}
          <div class="text">{entry.text}</div>
          <div class="actions">
            <button type="button" class="link" onclick={() => { editingReply = i; replyDraft = entry.text }}>{t('commentEdit')}</button>
            <button type="button" class="link" onclick={() => deleteReply(i)}>{t('delete')}</button>
          </div>
        {/if}
      </div>
    {/each}
    {#if !thread.resolved}
      <textarea
        bind:this={replyBox}
        bind:value={reply}
        rows="2"
        aria-label={t('commentReply')}
        placeholder={t('commentReplyPlaceholder')}
        spellcheck="false"
      ></textarea>
      <div class="sv-sheet-dialog-buttons">
        <span class="keys">{t('commentPosts')}</span>
        <button type="button" class="btn primary" onclick={postReply} disabled={!reply.trim()}>{t('commentReply')}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sv-sheet-comment {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 260px;
    padding: 8px;
    font-size: 12px;
    color: var(--sg-fg, #242424);
  }
  .sv-sheet-comment.threaded {
    width: 300px;
    max-height: 360px;
    overflow-y: auto;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--sg-muted, #616161);
  }
  .head .link { margin-left: auto; }
  .badge {
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #107c41);
    border-radius: 9px;
  }
  .keys {
    margin-right: auto;
    font-size: 11px;
    color: var(--sg-muted, #616161);
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 0;
    border-top: 1px solid var(--sg-border, #e5e5e5);
  }
  .entry.root { border-top: 0; padding-top: 0; }
  .entry.reply { padding-left: 12px; }
  .who {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 11px;
    color: var(--sg-muted, #616161);
  }
  .author { font-weight: 600; color: var(--sg-fg, #242424); }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .actions { display: flex; gap: 10px; }
  .link {
    padding: 0;
    font: inherit;
    font-size: 11px;
    color: var(--sg-accent, #107c41);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .link:hover { text-decoration: underline; }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 40px;
    padding: 6px 8px;
    font: inherit;
    line-height: 1.4;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  textarea:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -1px;
  }
</style>
