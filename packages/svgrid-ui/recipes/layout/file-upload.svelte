<script lang="ts">
  // SvFileUpload - drag-and-drop file field with accept / size / count validation. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-file-upload
  import { SvFileUpload, type FileRejection } from '@svgrid/grid'

  let files = $state<File[]>([])
</script>

<SvFileUpload
  {files}
  label="Attachments"
  accept="image/*,.pdf"
  multiple
  maxSize={5 * 1024 * 1024}
  onChange={(f) => (files = f)}
  onReject={(r: FileRejection[]) => console.warn(r)}
/>
