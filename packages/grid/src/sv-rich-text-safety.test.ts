/** `<SvRichText>` takes a stored string, and that string may be someone else's. */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvRichText from './SvRichText.svelte'
import { sanitizeHtml } from './sanitize-html'

function on(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvRichText, { target, props })
  flushSync()
  return {
    body: target.querySelector('[contenteditable]') as HTMLElement,
    destroy() {
      void unmount(app)
      target.remove()
    },
  }
}

describe('SvRichText value', () => {
  it('never puts an event handler in the page', () => {
    const { body, destroy } = on({ value: '<p>Hi</p><img src=x onerror="window.__rt=1"><script>window.__rt=2</script>' })
    expect(body.innerHTML).not.toMatch(/onerror|script/)
    expect(body.textContent).toContain('Hi')
    expect((window as never as { __rt?: number }).__rt).toBeUndefined()
    destroy()
  })

  it('drops a javascript: link and keeps the words', () => {
    const { body, destroy } = on({ value: '<a href="javascript:alert(1)">click</a>' })
    expect(body.innerHTML).not.toContain('javascript')
    expect(body.textContent).toBe('click')
    destroy()
  })

  it('what it hands back is clean too', () => {
    const onChange = vi.fn()
    const { body, destroy } = on({ value: '', onChange })
    body.innerHTML = '<p onclick="x()">typed</p>'
    body.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(onChange).toHaveBeenCalledWith('<p>typed</p>')
    destroy()
  })

  it('keeps the alignment its own buttons write', () => {
    const { body, destroy } = on({ value: '<div style="text-align: center;">Mid</div>' })
    expect((body.firstElementChild as HTMLElement).style.textAlign).toBe('center')
    destroy()
  })
})

describe('sanitizeHtml and style', () => {
  it('keeps a text alignment and nothing else of the attribute', () => {
    expect(sanitizeHtml('<p style="text-align: right; position: fixed; background: url(x)">a</p>')).toBe('<p style="text-align:right">a</p>')
  })

  it('drops any other style', () => {
    expect(sanitizeHtml('<p style="position: fixed">a</p>')).toBe('<p>a</p>')
    expect(sanitizeHtml('<p style="text-align: url(x)">a</p>')).toBe('<p>a</p>')
  })
})
