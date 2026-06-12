/**
 * Unit tests for the renderComponent / renderSnippet factories.
 */
import { describe, expect, it } from 'vitest'
import {
  RenderComponentConfig,
  RenderSnippetConfig,
  renderComponent,
  renderSnippet,
} from './render-component'

describe('renderComponent', () => {
  it('returns a RenderComponentConfig instance', () => {
    const FakeComponent = (() => null) as any
    const config = renderComponent(FakeComponent)
    expect(config).toBeInstanceOf(RenderComponentConfig)
    expect(config.component).toBe(FakeComponent)
    expect(config.props).toBeUndefined()
  })

  it('captures the props payload as-is', () => {
    const FakeComponent = (() => null) as any
    const config = renderComponent(FakeComponent, { id: 1, label: 'Hello' } as any)
    expect(config.props).toEqual({ id: 1, label: 'Hello' })
  })

  it('reuses the constructor instance fields', () => {
    const FakeComponent = (() => null) as any
    const a = renderComponent(FakeComponent, { x: 1 } as any)
    const b = renderComponent(FakeComponent, { x: 1 } as any)
    // Different instances - the factory does not memoize.
    expect(a).not.toBe(b)
    expect(a.component).toBe(b.component)
  })
})

describe('renderSnippet', () => {
  it('returns a RenderSnippetConfig instance with the captured snippet + params', () => {
    const fakeSnippet = (() => null) as any
    const config = renderSnippet(fakeSnippet, { value: 42 })
    expect(config).toBeInstanceOf(RenderSnippetConfig)
    expect(config.snippet).toBe(fakeSnippet)
    expect(config.params).toEqual({ value: 42 })
  })

  it('allows an undefined params payload', () => {
    const fakeSnippet = (() => null) as any
    const config = renderSnippet(fakeSnippet)
    expect(config.params).toBeUndefined()
  })
})
