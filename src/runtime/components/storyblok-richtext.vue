<script lang="ts">
import { inject, defineComponent } from 'vue'

export default defineComponent({
  props: {
    document: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  render () {
    const richtextRenderer = inject('richtextRenderer') as any
    const rendered = richtextRenderer.renderDocument(this.document)
    return rendered
  }
})
</script>
