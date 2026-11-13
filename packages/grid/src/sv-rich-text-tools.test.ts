/** `<SvRichText>`'s optional tools and props: image, table, HTML source, a form name, a trusted sanitizer. */
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
    target,
    body: target.querySelector('[contenteditable]') as HTMLElement,
    button: (tool: string) => target.querySelector(`[data-tool="${tool}"]`) as HTMLButtonElement | null,
    destroy() {
      void unmount(app)
      target.remove()
    },
  }
}

describe('SvRichText tools', () => {
  it('keeps its default toolbar: the new tools come only when listed', () => {
    const { button, destroy } = on({ value: '' })
    expect(button('bold')).not.toBeNull()
    for (const tool of ['image', 'table', 'hr', 'source']) expect(button(tool)).toBeNull()
    destroy()
  })

  it('source shows the HTML in a text area, and what is typed there comes back sanitized', () => {
    const onChange = vi.fn()
    const { target, body, button, destroy } = on({ value: '<p>Hi</p>', tools: ['bold', 'source'], onChange })
    button('source')!.click()
    flushSync()
    const area = target.querySelector('textarea.sv-rt__source') as HTMLTextAreaElement
    expect(area.value).toBe('<p>Hi</p>')
    expect(body.hidden).toBe(true)
    expect(button('bold')!.disabled).toBe(true)
    expect(button('source')!.getAttribute('aria-pressed')).toBe('true')
    area.value = '<h2>Title</h2><p onclick="x()">Body</p><script>window.__src=1</script>'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(onChange).toHaveBeenLastCalledWith('<h2>Title</h2><p>Body</p>')
    button('source')!.click()
    flushSync()
    expect(target.querySelector('textarea.sv-rt__source')).toBeNull()
    expect(body.hidden).toBe(false)
    expect(body.innerHTML).toBe('<h2>Title</h2><p>Body</p>')
    expect((window as never as { __src?: number }).__src).toBeUndefined()
    destroy()
  })

  it('name posts the value with a form, as a hidden input that follows edits', () => {
    const { target, body, destroy } = on({ value: '<p>One</p>', name: 'content' })
    const hidden = () => target.querySelector('input[type=hidden][name=content]') as HTMLInputElement
    expect(hidden().value).toBe('<p>One</p>')
    body.innerHTML = '<p>Two</p>'
    body.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(hidden().value).toBe('<p>Two</p>')
    destroy()
  })

  it('image hands the picked file to onImageUpload', async () => {
    const onImageUpload = vi.fn(async () => '/uploads/a.png')
    const { target, button, destroy } = on({ value: '', tools: ['image'], onImageUpload })
    const input = target.querySelector('input[type=file]') as HTMLInputElement
    const picked = vi.spyOn(input, 'click').mockImplementation(() => {})
    button('image')!.click()
    expect(picked).toHaveBeenCalled()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    expect(onImageUpload).toHaveBeenCalledWith(file)
    destroy()
  })

  it('image without onImageUpload asks for a URL', () => {
    const ask = vi.spyOn(window, 'prompt').mockReturnValue(null)
    const { target, button, destroy } = on({ value: '', tools: ['image'] })
    expect(target.querySelector('input[type=file]')).toBeNull()
    button('image')!.click()
    expect(ask).toHaveBeenCalledWith('Image URL', 'https://')
    ask.mockRestore()
    destroy()
  })

  it('sanitize replaces the default for trusted content, both ways', () => {
    const styled = '<p style="color: red">Red</p>'
    const plain = on({ value: styled })
    expect(plain.body.innerHTML).toBe('<p>Red</p>')
    plain.destroy()
    const onChange = vi.fn()
    const trusted = on({ value: styled, sanitize: (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ''), onChange })
    expect(trusted.body.innerHTML).toBe(styled)
    trusted.body.innerHTML = styled + '<script>x()</script>'
    trusted.body.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onChange).toHaveBeenLastCalledWith(styled)
    trusted.destroy()
  })
})

describe('sanitizeHtml and the new tools', () => {
  it('keeps a table and a rule, with spans, and nothing else on them', () => {
    const html = '<table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2" onclick="x()" style="width:9px">1</td></tr></tbody></table><hr>'
    expect(sanitizeHtml(html)).toBe('<table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2">1</td></tr></tbody></table><hr>')
  })
})
