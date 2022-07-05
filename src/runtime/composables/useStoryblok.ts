/**
 * Based on useAsyncData: https://github.com/nuxt/framework/blob/main/packages/nuxt/src/app/composables/asyncData.ts
 */
import { onBeforeMount, onServerPrefetch, onUnmounted, ref, isRef, getCurrentInstance, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import { hash } from 'ohash'
import type { Story, StoryData } from '@storyblok/js'
import { useStoryblokApi } from './useStoryblokApi'
import { useStoryblokBridge } from './useStoryblokBridge'
import { useRuntimeConfig, useNuxtApp, useRoute } from '#imports'

export interface RefreshOptions {
    _initial?: boolean
}

export interface _StoryblokData<StoryData, ErrorT> {
    data: Ref<StoryData>
    pending: Ref<boolean>
    refresh: (opts?: RefreshOptions) => Promise<void>
    error: Ref<ErrorT>
}

export type StoryblokData<StoryData, Error> = _StoryblokData<StoryData, Error> & Promise<_StoryblokData<StoryData, Error>>

type MultiWatchSources = (WatchSource<unknown> | object)[]

/**
 * Todo: add Storyblok options
 */
export interface StoryblokQueryOptions {
    version?: string
    resolve_links?: string
}

export interface UseStoryblokOptions extends StoryblokQueryOptions {
    server: boolean
    lazy?: boolean
    watch?: MultiWatchSources
    initialCache?: boolean
}

const wrapInRef = <T> (value: T | Ref<T>) => isRef(value) ? value : ref(value)

export function useStoryblok<
    DataE = Error
> (
  slug?: string,
  options?: UseStoryblokOptions
) {
  // if slug is null or empty create a slug from the current route
  if (!slug) {
    const { slug: routeSlug } = useRoute().params
    // routeSlug is a string if the current path is "/"
    if (typeof routeSlug === 'string' && routeSlug === '') {
      const { storyblok } = useRuntimeConfig().public
      slug = storyblok.rootSlug
    }
    if (Array.isArray(routeSlug)) {
      slug = routeSlug.join('/')
    }
  }
  // create key from slug
  const key = `storyblok_${hash(slug)}`
  // Setup nuxt instance payload
  const nuxt = useNuxtApp()
  // get runtime config
  const { storyblok } = useRuntimeConfig().public
  // get storyblok api
  const storyblokApiInstance = useStoryblokApi()

  // Apply defaults
  options = { server: true, ...options }

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
  options.lazy = options.lazy ?? false
  // Set initial cache to true if not set
  options.initialCache = options.initialCache ?? true

  const useInitialCache = () => options.initialCache && nuxt.payload.data[key] !== undefined

  const storyblokData = {
    data: wrapInRef(nuxt.payload.data[key]),
    pending: ref(!useInitialCache()),
    error: ref(nuxt.payload._errors[key] ?? null)
  } as StoryblokData<StoryData, DataE>

  const initBridge = (story : StoryData) => {
    // enable bride on client side, if story is available and bridge is enabled
    if (process.client && story.id && (storyblok.enableBridge || nuxt._storyblokForceBridge)) {
      useStoryblokBridge(story.id, (newStory: StoryData) => {
        storyblokData.data.value = newStory
      },{
        customParent: 'http://localhost:3000',
        preventClicks: true
      })
    }
  }

  storyblokData.refresh = (opts = {}) => {
    // Avoid fetching same key more than once at a time
    if (nuxt._asyncDataPromises[key]) {
      return nuxt._asyncDataPromises[key]
    }
    // Avoid fetching same key that is already fetched
    if (opts._initial && useInitialCache()) {
      return nuxt.payload.data[key]
    }
    storyblokData.pending.value = true

    // create Storyblok query options
    const queryOptions: StoryblokQueryOptions = {
      version: options.version || 'draft'
    }
    if (options.resolve_links) {
      queryOptions.resolve_links = options.resolve_links
    }
    // TODO: Cancel previous promise
    // TODO: Handle immediate errors
    nuxt._asyncDataPromises[key] = Promise.resolve(
      storyblokApiInstance.get(`cdn/stories/${slug}`, queryOptions)
    ).then((result: Story) => {
      storyblokData.data.value = result?.data?.story as StoryData || null
      storyblokData.error.value = null
      // init bridge
      initBridge(storyblokData.data.value)
    }).catch((error: any) => {
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

  // create initial fetch function
  const initialFetch = () => storyblokData.refresh({ _initial: true })

  const fetchOnServer = options.server !== false && nuxt.payload.serverRendered

  // Server side fetch
  if (process.server && fetchOnServer) {
    const promise = initialFetch()
    onServerPrefetch(() => promise)
  }

  // Client side
  if (process.client) {
    if (fetchOnServer && nuxt.isHydrating && key in nuxt.payload.data) {
      // 1. Hydration (server: true): no fetch
      storyblokData.pending.value = false
      // init bridge if story is already loaded and hydated
      initBridge(storyblokData.data.value)
    } else if (instance && nuxt.payload.serverRendered && (nuxt.isHydrating || options.lazy)) {
      // 2. Initial load (server: false): fetch on mounted
      // 3. Navigation (lazy: true): fetch on mounted
      instance._nuxtOnBeforeMountCbs.push(initialFetch)
    } else {
      // 4. Navigation (lazy: false) - or plugin usage: await fetch
      initialFetch()
    }
    if (options.watch) {
      watch(options.watch, () => storyblokData.refresh())
    }
    const off = () => {
      // TODO: unsubscribe bridge
      nuxt.hook('app:data:refresh', (keys) => {
        if (!keys || keys.includes(key)) {
          return storyblokData.refresh()
        }
      })
    }
    if (instance) {
      onUnmounted(off)
    }
  }

  // Allow directly awaiting on storyblokData
  const useStoryblokPromises = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => storyblokData) as StoryblokData<StoryData, DataE>
  Object.assign(useStoryblokPromises, storyblokData)

  return useStoryblokPromises as StoryblokData<StoryData, DataE>
}
