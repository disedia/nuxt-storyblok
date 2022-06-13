import {
  storyblokEditable
} from '@storyblok/js'
import { DirectiveBinding, ObjectDirective } from 'vue'
import { createRenderer } from '../richtext/renderer'
import { defineNuxtPlugin } from '#imports'

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
  // Add Storyblok directive
  nuxtApp.vueApp.directive('editable', vEditableDirective)

  // Add richtext renderer
  /*
  * TODO: enable more features to extend the renderer
  */
  const options = {}
  const renderer = createRenderer(options)
  nuxtApp.vueApp.provide('richtextRenderer', renderer)
})
