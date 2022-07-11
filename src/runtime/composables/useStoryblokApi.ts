import {
  storyblokInit,
  apiPlugin
} from '@storyblok/js'
import type { SbInitResult, StoryblokClient } from '@storyblok/js'
import { useRuntimeConfig, useNuxtApp } from '#imports'

export function useStoryblokApi (): StoryblokClient {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp._storyblok) {
    const { storyblok } = useRuntimeConfig().public
    nuxtApp._storyblok = {}
    // check app is in editor mode -> sets variable to force bridge mode
    if (process.client) {
      nuxtApp._storyblok.forceBridge = false
      if (window.self !== window.top) {
        if(window.top.location.pathname===storyblok.editor.path){
          nuxtApp._storyblok.forceBridge = true
        }
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
