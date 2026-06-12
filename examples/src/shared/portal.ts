/**
 * Svelte 5 action: move the bound DOM element into `document.body`
 * (or any other target) for the lifetime of the action. Used by
 * overlays / dropdowns / dialogs that need to escape the parent's
 * stacking context.
 *
 *   <div use:portal>…</div>
 *   <div use:portal={someTarget}>…</div>
 */
export function portal(node: HTMLElement, target: HTMLElement | null = null) {
  function mount(host: HTMLElement) {
    host.appendChild(node)
  }
  mount(target ?? document.body)
  return {
    update(next: HTMLElement | null) {
      mount(next ?? document.body)
    },
    destroy() {
      if (node.parentNode) node.parentNode.removeChild(node)
    },
  }
}
