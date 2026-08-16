<script lang="ts">
  // SvRichText - a lightweight WYSIWYG editor emitting HTML. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-rich-text
  import { SvRichText } from '@svgrid/grid'

  let html = $state('<p>Hello</p>')
</script>

<SvRichText bind:value={html} placeholder="Write something…" />
