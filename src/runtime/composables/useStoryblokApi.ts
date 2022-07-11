import {
  storyblokInit,
  apiPlugin
} from '@storyblok/js'
import type { SbInitResult, StoryblokClient } from '@storyblok/js'
import { useRuntimeConfig, useNuxtApp, useRoute } from '#imports'

export function useStoryblokApi (): StoryblokClient {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp._storyblok) {
    const { storyblok } = useRuntimeConfig().public
    nuxtApp._storyblok = {}
    // check route query if preview is true -> sets variable to force bridge mode
    if (process.client) {
      nuxtApp._storyblok.forceBridge = false
      const { query } = useRoute()
      if (query.preview === 'true') {
        nuxtApp._storyblok.forceBridge = true
      }
    }
    const client = storyblokInit({
      accessToken: storyblok.accessToken,
      use: [apiPlugin],
      bridge: storyblok.bridge.enabled || nuxtApp._storyblok.forceBridge
    }) as SbInitResult
    nuxtApp._storyblok.client = client.storyblokApi
  }

  return nuxtApp._storyblok.client
}
