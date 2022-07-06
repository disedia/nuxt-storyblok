/**
 * Based on useStoryblokBridge: hhttps://github.com/storyblok/storyblok-js/blob/main/lib/index.ts
 */
import type { StoryblokBridgeConfigV2, StoryData, StoryblokBridgeV2 } from '@storyblok/js'
import { useNuxtApp } from '#imports'

export const useStoryblokBridge = (
  id: Number,
  cb: (newStory: StoryData) => void,
  options: StoryblokBridgeConfigV2 = {}
) => {
  // bridge is only available on the client
  if (!process.client || typeof window === 'undefined') {
    return
  }

  if (typeof window.storyblokRegisterEvent === 'undefined') {
    console.error(
      'Storyblok Bridge is disabled. Please enable it to use it. Read https://github.com/storyblok/storyblok-js'
    )

    return
  }

  if (!id) {
    console.warn('Story ID is not defined. Please provide a valid ID.')
    return
  }

  // add story id and callback to nuxtApp to avoid double initialization and to manage updates
  const key = `storyblok_${id}`
  let initialized = true
  const nuxtApp = useNuxtApp()

  /*nuxtApp.hooks.hook('page:finish',()=>{
    console.log('Test hook')
  })*/

  if (!nuxtApp._storyblokBridge) {
    nuxtApp._storyblokBridge = {}
    initialized = false
  }

  if (!(key in nuxtApp._storyblokBridge)) {
    nuxtApp._storyblokBridge[key] = cb
    if (!initialized) {
      window.storyblokRegisterEvent(() => {
        const sbBridge: StoryblokBridgeV2 = new window.StoryblokBridge(options)
        if(sbBridge.isInEditor){
          sbBridge.on(['input', 'published', 'change', 'save'], (event) => {
            if (event.action === 'input' && `storyblok_${event.story.id}` in nuxtApp._storyblokBridge) {
              nuxtApp._storyblokBridge[`storyblok_${event.story.id}`](event.story)
            }
          })
        }
      })
    }
  }
}
