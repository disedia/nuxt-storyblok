<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Richtext } from '@storyblok/js'
import { useNuxtApp } from '#imports'

export type RichtextResolver = {
  paragraph?: string
  heading?: string
  image?: string
  ordered_list?: string
  bullet_list?: string
  list_item?: string
  code_block?: string
  link?: string
  components?: Record < string, string >
}

export type RichtextClassesHeadings = {
  '1'?: string
  '2'?: string
  '3'?: string
  '4'?: string
  '5'?: string
  '6'?: string
}

export type RichtextClasses = {
  paragraph?: string
  heading?: RichtextClassesHeadings
  image?: string
  ordered_list?: string
  bullet_list?: string
  list_item?: string
  code_block?: string
  link?: string
  components?: Record < string, string >
}

export default defineComponent({
  props: {
    document: {
      type: Object as PropType<Richtext>,
      required: true,
      default: () => ({})
    },
    classes: {
      type: Object as PropType<RichtextClasses>,
      required: false,
      default: () => ({})
    },
    resolvers: {
      type: Object as PropType<RichtextResolver>,
      required: false,
      default: () => ({})
    },
    omitParagraphInListItems: {
      type: Boolean,
      required: false,
      default: null
    }
  },
  render () {
    const nuxtApp = useNuxtApp()
    const rendered = nuxtApp._storyblok.richtextRenderer.renderDocument(this.document, {
      classes: this.classes,
      resolvers: this.resolvers,
      omitParagraphInListItems: this.omitParagraphInListItems
    })
    return rendered
  }
})
</script>
