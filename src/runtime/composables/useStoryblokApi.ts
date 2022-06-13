import {
  storyblokInit,
  apiPlugin
} from '@storyblok/js'
import type { SbInitResult, StoryblokClient } from '@storyblok/js'
import { useRuntimeConfig, useNuxtApp, useRoute } from '#imports'

export function useStoryblokApi (): StoryblokClient {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp._storyblokClient) {
    const { storyblok } = useRuntimeConfig().public
    // check route query if preview is true -> sets variable to force bridge mode
    if (process.client) {
      nuxtApp._storyblokForceBridge = false
      const { query } = useRoute()
      if (query.preview === 'true') {
        nuxtApp._storyblokForceBridge = true
      }
    }
    const client = storyblokInit({
      accessToken: storyblok.accessToken,
      use: [apiPlugin],
      bridge: storyblok.enableBridge || nuxtApp._storyblokForceBridge
    }) as SbInitResult
    nuxtApp._storyblokClient = client.storyblokApi
  }

  return nuxtApp._storyblokClient
}
