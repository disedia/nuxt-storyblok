<script lang="ts">
  import { defineComponent } from 'vue'
  import { useNuxtApp } from '#imports'

  export default defineComponent({
    props: {
      document: {
        type: Object,
        required: true,
        default: () => ({})
      }
    },
    render () {
      const nuxtApp = useNuxtApp()
      const rendered = nuxtApp._storyblokRichtextRenderer.renderDocument(this.document)
      return rendered
    }
  })
</script>
