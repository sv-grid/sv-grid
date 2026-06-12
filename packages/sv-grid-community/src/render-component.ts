import type { Component, ComponentProps, Snippet } from 'svelte'

export class RenderComponentConfig<TComponent extends Component> {
  constructor(
    public component: TComponent,
    public props?: ComponentProps<TComponent> | Record<string, never>,
  ) {}
}

export class RenderSnippetConfig<TProps> {
  constructor(
    public snippet: Snippet<[TProps]>,
    public params?: TProps,
  ) {}
}

export const renderComponent = <
  TComponent extends Component<any>,
  TProps extends ComponentProps<TComponent>,
>(
  component: TComponent,
  props?: TProps,
) => new RenderComponentConfig(component, props)

export const renderSnippet = <TProps>(
  snippet: Snippet<[TProps]>,
  params?: TProps,
) => new RenderSnippetConfig(snippet, params)
