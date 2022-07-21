/**
 * Based on useAsyncData: https://github.com/nuxt/framework/blob/main/packages/nuxt/src/app/composables/asyncData.ts
 */
import { onBeforeMount, onServerPrefetch, onUnmounted, ref, isRef, getCurrentInstance, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import { hash } from 'ohash'
import type { StoryData, StoryblokBridgeConfigV2, StoriesParams, StoryParams, StoryblokResult } from '@storyblok/js'
import { useStoryblokApi } from './useStoryblokApi'
import { useStoryblokBridge } from './useStoryblokBridge'
import { useRuntimeConfig, useNuxtApp } from '#imports'

type MultiWatchSources = (WatchSource<unknown> | object)[]

export interface UseStoryblokOptions {
  server?: boolean
  lazy?: boolean
  watch?: MultiWatchSources
  initialCache?: boolean
}

export interface RefreshOptions {
  _initial?: boolean
}

export interface _StoryblokData<DataT, ErrorT> {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (fetchUrl: string, opts?: RefreshOptions) => Promise<void>
  error: Ref<ErrorT>
}
export type StoryblokData<Data, Error> = _StoryblokData<Data, Error> & Promise<_StoryblokData<Data, Error>>

export interface useStoryblokReturn extends StoryblokData<StoryData|StoryData[], Error>{
  getStories: (pts: StoryParams) => StoryblokData<StoryData[], Error>
  getStory: (slug: string, opts: StoryParams) => StoryblokData<StoryData, Error>
}

const wrapInRef = <T> (value: T | Ref<T>) => isRef(value) ? value : ref(value)

export function useStoryblok (
  key: string,
  options?: UseStoryblokOptions
): useStoryblokReturn {
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt-storyblok] [useStoryblok] key must be a string.')
  }
  key = `storyblok_${hash(key)}`

  options = { server: true, ...options }
  // Apply defaults
  options.server = options.server ?? true
  // Setup nuxt instance payload
  const nuxt = useNuxtApp()
  const { storyblok } = useRuntimeConfig().public
  /**
   * set default storyblok query options
   * -> version in preview or editor is always 'draft' or dependent if dev mode or production
   * */
  const queryOptions = {
    version: nuxt._storyblok.version
  } as StoryParams | StoriesParams
  // get storyblok api
  const storyblokApiInstance = useStoryblokApi()

  // Setup hook callbacks once per instance
  const instance = getCurrentInstance()
  if (instance && !instance._nuxtOnBeforeMountCbs) {
    const cbs = instance._nuxtOnBeforeMountCbs = []
    if (instance && process.client) {
      onBeforeMount(() => {
        cbs.forEach((cb) => { cb() })
        cbs.splice(0, cbs.length)
      })
      onUnmounted(() => cbs.splice(0, cbs.length))
    }
  }

  const useInitialCache = () => options.initialCache && nuxt.payload.data[key] !== undefined

  const storyblokData = {
    data: wrapInRef(nuxt.payload.data[key]),
    pending: ref(!useInitialCache()),
    error: ref(nuxt.payload._errors[key] ?? null)
  } as StoryblokData<StoryData | StoryData[] | null, Error | null>

  storyblokData.refresh = (fetchUrl: string, opts?: RefreshOptions) => {
    // Avoid fetching same key more than once at a time
    if (nuxt._asyncDataPromises[key]) {
      return nuxt._asyncDataPromises[key]
    }
    // Avoid fetching same key that is already fetched
    if (opts?._initial && useInitialCache()) {
      return nuxt.payload.data[key]
    }
    storyblokData.pending.value = true

    // TODO: Cancel previous promise
    // TODO: Handle immediate errors
    nuxt._asyncDataPromises[key] = Promise.resolve(
      storyblokApiInstance.get(fetchUrl, queryOptions)
    ).then((result: StoryblokResult) => {
      let data: StoryData | StoryData[] | null = null
      if (fetchUrl === 'cdn/stories') {
        data = result.data.stories as StoryData[]
      } else if (fetchUrl.includes('cdn/stories/')) {
        data = result.data.story as StoryData
      }
      // init bridge
      initBridge(data)
      storyblokData.data.value = data
      storyblokData.error.value = null
    }).catch((error: any) => {
      console.error(error)
      storyblokData.error.value = error
      storyblokData.data.value = null
    }).finally(() => {
      storyblokData.pending.value = false
      nuxt.payload.data[key] = storyblokData.data.value
      if (storyblokData.error.value) {
        nuxt.payload._errors[key] = true
      }
      delete nuxt._asyncDataPromises[key]
    })
    return nuxt._asyncDataPromises[key]
  }

  const isStoryData = (data: any): data is StoryData => {
    return typeof data?.id !== undefined
  }
  const isStoriesData = (data: any): data is StoryData[] => {
    return typeof data?.id === undefined
  }

  let bridgeInitialized = false

  const initBridge = (data: StoryData | StoryData[]) => {
    const storyIds = [] as number[]
    if (isStoryData(data)) {
      storyIds.push(data.id)
    }
    if (isStoriesData(data)) {
      data.map(story => storyIds.push(story.id))
    }
    // enable bride on client side, if story is available and bridge is enabled
    if (process.client && !bridgeInitialized && storyIds.length > 0 && (storyblok.bridge.enabled || nuxt._storyblok.forceBridge)) {
      const bridgeOptions = {
        preventClicks: true
      } as StoryblokBridgeConfigV2
      if (queryOptions.resolve_relations) {
        bridgeOptions.resolveRelations = queryOptions.resolve_relations.trim().split(',') as [string]
      }
      // set custom parent
      if (window.location.hostname === 'localhost') {
        bridgeOptions.customParent = window.location.origin
      } else if (storyblok.editor.previewUrl !== '') {
        bridgeOptions.customParent = storyblok.editor.previewUrl
      }
      useStoryblokBridge(storyIds, (updatedStory: StoryData) => {
        if (isStoryData(storyblokData.data.value)) {
          storyblokData.data.value = updatedStory
        }
        if (isStoriesData(storyblokData.data.value)) {
          const storyIndex = storyblokData.data.value.findIndex(story => story.id === updatedStory.id)
          if (storyIndex > -1) {
            storyblokData.data.value.splice(storyIndex, 1, updatedStory)
          }
        }
      }, bridgeOptions)
      bridgeInitialized = true
    }
  }

  const initFetch = (fetchUrl) => {
    // create initial fetch function
    const initialFetch = () => storyblokData.refresh(fetchUrl, { _initial: true })

    const fetchOnServer = options.server !== false && nuxt.payload.serverRendered

    // Server side fetch
    if (process.server && fetchOnServer) {
      const promise = initialFetch()
      onServerPrefetch(() => promise)
      // BUG: nuxt.isHydrating -> is always false in calls from nested components
      nuxt.payload[`_sbHydrated_${key}`] = true
    }

    // Client side
    if (process.client) {
      // init bridge if story is already loaded
      // TODO BUG: nuxt.isHydrating -> is always false in calls from nested components, so currently use own payload var nuxt.payload[`_sbHydrated_${key}`]
      if (fetchOnServer && nuxt.payload[`_sbHydrated_${key}`] && key in nuxt.payload.data) {
        // 1. Hydration (server: true): no fetch
        storyblokData.data.value = nuxt.payload.data[key]
        storyblokData.pending.value = false
        initBridge(storyblokData.data.value)
      } else if (instance && nuxt.payload.serverRendered && (nuxt.payload[`_sbHydrated_${key}`] || options.lazy)) {
        // 2. Initial load (server: false): fetch on mounted
        // 3. Navigation (lazy: true): fetch on mounted
        instance._nuxtOnBeforeMountCbs.push(initialFetch)
      } else {
        // 4. Navigation (lazy: false) - or plugin usage: await fetch
        initialFetch()
      }
      if (options.watch) {
        watch(options.watch, () => storyblokData.refresh(fetchUrl))
      }
      const off = nuxt.hook('app:data:refresh', (keys) => {
        if (!keys || keys.includes(key)) {
          return storyblokData.refresh(fetchUrl)
        }
      })
      if (instance) {
        onUnmounted(off)
      }
      // set nuxt.payload[`_sbHydrated_${key}`] to false, because it is already hydrated once
      nuxt.payload[`_sbHydrated_${key}`] = false
    }
  }

  const getStory = (slug: string, opts: StoryParams) => {
    // assign Storyblok query options
    Object.assign(queryOptions, opts)

    initFetch(`cdn/stories/${slug}`)

    // Allow directly awaiting on asyncData
    const storyblokDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => storyblokData) as StoryblokData<StoryData, Error>
    Object.assign(storyblokDataPromise, storyblokData)

    return storyblokDataPromise
  }

  const getStories = (opts: StoriesParams) => {
    Object.assign(queryOptions, opts)

    initFetch('cdn/stories')
    // Allow directly awaiting on asyncData
    const storyblokDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => storyblokData) as StoryblokData<StoryData[], Error>
    Object.assign(storyblokDataPromise, storyblokData)

    return storyblokDataPromise
  }

  return {
    ...storyblokData,
    getStory,
    getStories
  }
}
