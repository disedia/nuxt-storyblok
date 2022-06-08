import { defineNuxtConfig } from 'nuxt'
import StoryblokModule from '..'

export default defineNuxtConfig({
  modules: [
    StoryblokModule
  ],
  storyblok: {
    accessToken: '<access-token>'
  }
})
