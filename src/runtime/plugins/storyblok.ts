import {
  storyblokEditable
} from '@storyblok/js'
import { DirectiveBinding, ObjectDirective } from 'vue'
import type { StoryblokClient } from '@storyblok/js'
import { createRenderer, RichtextRenderer } from '../richtext/renderer'
import { defineNuxtPlugin, useRoute, useRuntimeConfig } from '#imports'

export interface StoryblokRuntimeSettings {
  richtextRenderer: RichtextRenderer
  version: 'draft' | 'published'
  previewMode: boolean
  forceBridge: boolean
  client: StoryblokClient
}

/**
* Vue directive "v-editable" for Storyblok
*/
const vEditableDirective: ObjectDirective = {
  beforeMount (el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value) {
      const options = storyblokEditable(binding.value)
      el.setAttribute('data-blok-c', options['data-blok-c'])
      el.setAttribute('data-blok-uid', options['data-blok-uid'])
      el.classList.add('storyblok__outline')
    }
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  // Add Storyblok Plugin
  nuxtApp.vueApp.directive('editable', vEditableDirective)
  // Add richtext renderer
  /*
  * TODO: enable more features to extend the renderer
  */
  const options = {}
  const renderer = createRenderer(options)
  // write storyblok runtime context
  nuxtApp._storyblok = {} as StoryblokRuntimeSettings
  nuxtApp._storyblok.richtextRenderer = renderer
  nuxtApp._storyblok.version = 'published'
  // check if storyblok is in editor mode
  const { query } = useRoute()
  // TODO: verify storyblok query params for security reasons
  if (query._storyblok) {
    nuxtApp._storyblok.previewMode = true
    // add preview token to runtime if in editor or preview mode
    nuxtApp._storyblok.previewToken = useRuntimeConfig().storyblokPreviewToken
    nuxtApp._storyblok.version = 'draft'
  } else if (useRuntimeConfig().public.storyblok.editor.forceDevPreview) {
    nuxtApp._storyblok.previewToken = useRuntimeConfig().storyblokPreviewToken
    nuxtApp._storyblok.version = 'draft'
  }
})
