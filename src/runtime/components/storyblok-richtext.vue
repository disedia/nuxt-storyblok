<script lang="ts">
import { inject } from 'vue'

export default defineComponent({
  props: {
    document: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  render () {
    const richtextRenderer = inject('richtextRenderer')
    const rendered = richtextRenderer.renderDocument(this.document)
    return rendered
  }
})
</script>
