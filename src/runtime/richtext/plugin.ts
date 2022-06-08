// cc https://github.com/MarvinRudolph/storyblok-rich-text-renderer
import { createRenderer } from './renderer'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  const options = {}
  const renderer = createRenderer(options)
  nuxtApp.provide('richtextRenderer', renderer)
})
