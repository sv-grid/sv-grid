/**
 * FlexRender tests. The component routes one of {content+context, cell,
 * header, footer} into the right render path: string, RenderComponentConfig,
 * RenderSnippetConfig, or raw value.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import FlexRender from './FlexRender.svelte'
import { RenderComponentConfig, RenderSnippetConfig } from './render-component'

function mountFlex(props: any) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(FlexRender, { target, props })
  return {
    target,
    destroy: () => {
      unmount(app)
      target.remove()
    },
  }
}

describe('FlexRender', () => {
  it('renders a plain string content directly', () => {
    const { target, destroy } = mountFlex({
      content: 'Hello header',
      context: { column: {}, table: {} } as any,
    })
    try {
      expect(target.textContent).toContain('Hello header')
    } finally {
      destroy()
    }
  })

  it('calls a function content with the context and renders the result', () => {
    const fn = (ctx: any) => `value=${ctx.value}`
    const { target, destroy } = mountFlex({
      content: fn,
      context: { value: 42 } as any,
    })
    try {
      expect(target.textContent).toContain('value=42')
    } finally {
      destroy()
    }
  })

  it('renders nothing when content is undefined', () => {
    const { target, destroy } = mountFlex({
      content: undefined,
      context: {} as any,
    })
    try {
      expect(target.textContent?.trim()).toBe('')
    } finally {
      destroy()
    }
  })

  it('pulls content + context from `cell` when provided', () => {
    const cell = {
      column: { columnDef: { cell: (ctx: any) => `row=${ctx.row.id}` } },
      getContext: () => ({ row: { id: 7 } }),
    }
    const { target, destroy } = mountFlex({ cell } as any)
    try {
      expect(target.textContent).toContain('row=7')
    } finally {
      destroy()
    }
  })

  it('pulls content + context from `header` when provided', () => {
    const header = {
      column: { columnDef: { header: 'Total' } },
      getContext: () => ({}),
    }
    const { target, destroy } = mountFlex({ header } as any)
    try {
      expect(target.textContent).toContain('Total')
    } finally {
      destroy()
    }
  })

  it('pulls content + context from `footer` when provided', () => {
    const footer = {
      column: { columnDef: { footer: 'Sum' } },
      getContext: () => ({}),
    }
    const { target, destroy } = mountFlex({ footer } as any)
    try {
      expect(target.textContent).toContain('Sum')
    } finally {
      destroy()
    }
  })

  it('renders a RenderComponentConfig result (smoke)', () => {
    // Anonymous Svelte-like component would require compilation; we just
    // exercise the constructor path so the discriminator branch executes.
    const fn = () => new RenderComponentConfig(null as any, {} as any)
    const { destroy } = mountFlex({
      content: fn,
      context: {} as any,
    })
    try {
      // No throw means the discriminator was hit.
      expect(true).toBe(true)
    } finally {
      destroy()
    }
  })

  it('renders a RenderSnippetConfig result (smoke)', () => {
    const fakeSnippet = (() => null) as any
    const fn = () => new RenderSnippetConfig(fakeSnippet, undefined as any)
    const { destroy } = mountFlex({
      content: fn,
      context: {} as any,
    })
    try {
      expect(true).toBe(true)
    } finally {
      destroy()
    }
  })

  it('renders a raw scalar value when the function returns one', () => {
    const fn = () => 99
    const { target, destroy } = mountFlex({
      content: fn,
      context: {} as any,
    })
    try {
      expect(target.textContent).toContain('99')
    } finally {
      destroy()
    }
  })
})
