/**
 * Based on useStoryblokBridge: hhttps://github.com/storyblok/storyblok-js/blob/main/lib/index.ts
 */
import type { StoryblokBridgeConfigV2, StoryData, StoryblokBridgeV2 } from '@storyblok/js'

export const useStoryblokBridge = (
  ids: number[],
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

  if (!ids) {
    console.warn('Story ID is not defined. Please provide a valid ID.')
    return
  }

  window.storyblokRegisterEvent(() => {
    const sbBridge: StoryblokBridgeV2 = new window.StoryblokBridge(options)
    sbBridge.on(['input', 'published', 'change'], (event) => {
      if (event.action === 'input' && ids.includes(event.story.id)) {
        cb(event.story)
      }
    })
  })
}
