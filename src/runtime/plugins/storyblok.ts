import {
  storyblokEditable
} from '@storyblok/js'
import { DirectiveBinding, ObjectDirective } from 'vue'
import type { StoryblokClient } from '@storyblok/js'
import { createRenderer, RichtextRenderer } from '../richtext/renderer'
import { defineNuxtPlugin, useRoute, useRuntimeConfig } from '#imports'

export interface StoryblokRuntime {
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

  const { storyblok } = useRuntimeConfig().public

  /*
  * Richtext options -> custom resolvers and classes are stored in runtimeConfig.public.storyblok
  * TODO: check if it the right place to store this
  */
  const renderer = createRenderer(storyblok.richtext)
  // write storyblok runtime context
  nuxtApp._storyblok = {} as StoryblokRuntime
  nuxtApp._storyblok.richtextRenderer = renderer
  nuxtApp._storyblok.version = storyblok.version
  // check if storyblok is in editor mode
  const { query } = useRoute()
  // TODO: verify storyblok query params for security reasons
  if (query._storyblok) {
    nuxtApp._storyblok.previewMode = true
    // for security reasons, previewToken will be written to client only if called from storyblok editor or preview mode
    if (process.server) {
      nuxtApp.payload._sbPreviewToken = useRuntimeConfig().storyblokPreviewToken
    }
    // add preview token to runtime if in editor or preview mode
    nuxtApp._storyblok.previewToken = nuxtApp.payload._sbPreviewToken
    nuxtApp._storyblok.version = 'draft'
  }
})
