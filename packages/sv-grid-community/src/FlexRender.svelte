<script
  lang="ts"
  generics="TData extends RowData"
>
  import { isFunction } from './core'
  import {
    RenderComponentConfig,
    RenderSnippetConfig,
  } from './render-component'
  import type {
    Cell,
    CellContext,
    ColumnDefTemplate,
    Header,
    HeaderContext,
    RowData,
  } from './core'

  type Props =
    | {
        content?: ColumnDefTemplate<
          | HeaderContext<TData>
          | CellContext<TData>
        >
        context:
          | HeaderContext<TData>
          | CellContext<TData>
        cell?: never
        header?: never
        footer?: never
      }
    | {
        cell: Cell<TData>
        content?: never
        context?: never
        header?: never
        footer?: never
      }
    | {
        header: Header<TData>
        content?: never
        context?: never
        cell?: never
        footer?: never
      }
    | {
        footer: Header<TData>
        content?: never
        context?: never
        cell?: never
        header?: never
      }

  let props: Props = $props()

  const resolved = $derived.by(() => {
    if ('cell' in props && props.cell) {
      return {
        content: props.cell.column.columnDef.cell,
        context: props.cell.getContext(),
      }
    }
    if ('header' in props && props.header) {
      return {
        content: props.header.column.columnDef.header,
        context: props.header.getContext(),
      }
    }
    if ('footer' in props && props.footer) {
      return {
        content: props.footer.column.columnDef.footer,
        context: props.footer.getContext(),
      }
    }
    return {
      content: props.content,
      context: props.context,
    }
  })

  const result = $derived(
    isFunction(resolved.content)
      ? resolved.content(resolved.context as any)
      : undefined,
  )
</script>

{#if typeof resolved.content === 'string'}
  {resolved.content}
{:else if result instanceof RenderComponentConfig}
  <result.component {...result.props} />
{:else if result instanceof RenderSnippetConfig}
  {@render result.snippet(result.params)}
{:else if result !== undefined}
  {result}
{/if}
