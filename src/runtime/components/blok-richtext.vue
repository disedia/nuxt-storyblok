<script lang="ts">
const nuxtApp = useNuxtApp()

export default defineComponent({
  props: {
    document: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  render () {
    const rendered = nuxtApp.$richtextRenderer.renderDocument(this.document)
    return rendered
  }
})
</script>
