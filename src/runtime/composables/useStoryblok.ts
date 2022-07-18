/**
 * Based on useAsyncData: https://github.com/nuxt/framework/blob/main/packages/nuxt/src/app/composables/asyncData.ts
 */
import { onBeforeMount, onServerPrefetch, onUnmounted, ref, isRef, getCurrentInstance, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'
import { hash } from 'ohash'
import type { Story,  Stories, StoryData, StoryblokBridgeConfigV2, StoriesParams } from '@storyblok/js'
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

export interface StoryQueryOptions {
  version?: StoriesParams['version']
  resolve_links?: StoriesParams['resolve_links'],
  resolve_relations?: [string]
}

export interface _StoryblokData<DataT, ErrorT> {
  result: Ref<DataT>
  pending: Ref<boolean>
  refresh: (fetchFunction: Function, opts?: RefreshOptions) => Promise<void>
  error: Ref<ErrorT>
}
export type StoryblokData<Data, Error> = _StoryblokData<Data, Error> & Promise<_StoryblokData<Data, Error>>

export interface useStoryblokReturn extends StoryblokData<Story|Stories, Error>{
  getStories: () => StoryblokData<Stories, Error>
  getStory: (slug: string) => StoryblokData<Story, Error>
}

const wrapInRef = <T> (value: T | Ref<T>) => isRef(value) ? value : ref(value)

export function useStoryblok<useStoryblokReturn> (
  key: string,
  options?: UseStoryblokOptions
) {
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt-storyblok] [useStoryblok] key must be a string.')
  }
  key = `storyblok_${hash(key)}`

  options = { server: true, ...options }
  // Apply defaults
  options.server = options.server ?? true
  // set default storyblok query options
  const queryOptions = {
    version: 'draft'
  } as StoryQueryOptions
  // Setup nuxt instance payload
  const nuxt = useNuxtApp()
  const { storyblok } = useRuntimeConfig().public
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
    result: wrapInRef(nuxt.payload.data[key]),
    pending: ref(!useInitialCache()),
    error: ref(nuxt.payload._errors[key] ?? null)
  } as StoryblokData<Story|Stories|null, Error|null>

  storyblokData.refresh = (fetchFunction, opts?: RefreshOptions) => {
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
      fetchFunction
    ).then((result: any) => {
      // init bridge
      initBridge(result)
      storyblokData.result.value = result
      storyblokData.error.value = null
    }).catch((error: any) => {
      console.log(error)
      storyblokData.error.value = error
      storyblokData.result.value = null
    }).finally(() => {
      storyblokData.pending.value = false
      nuxt.payload.data[key] = storyblokData.result.value
      if (storyblokData.error.value) {
        nuxt.payload._errors[key] = true
      }
      delete nuxt._asyncDataPromises[key]
    })
    return nuxt._asyncDataPromises[key]
  }

  const initBridge = (result: any) => {
    let resultIsArray = false
    const storyIds = [] as number[]
    if(result.data?.story){
      storyIds.push(result.data.story.id)
    }
    if(result.data?.stories){
      resultIsArray = true
      result.data.stories.map((story)=> storyIds.push(story.id))
    }
    // enable bride on client side, if story is available and bridge is enabled
    if (process.client && storyIds.length > 0 && (storyblok.bridge.enabled || nuxt._storyblok.forceBridge)) {
      const bridgeOptions = {
        preventClicks : true
      } as StoryblokBridgeConfigV2
      if (queryOptions.resolve_relations) {
        bridgeOptions.resolveRelations = queryOptions.resolve_relations
      }
      //set custom parent
      if(window.location.hostname === 'localhost'){
        bridgeOptions.customParent = window.location.origin
      }else{
        if(storyblok.editor.previewUrl !== ''){
          bridgeOptions.customParent = storyblok.editor.previewUrl
        }
      }
      useStoryblokBridge(storyIds, (updatedStory: StoryData) => {
        if(!resultIsArray){
          storyblokData.result.value.data.story = updatedStory
        }
        if(resultIsArray){
          const storyIndex = storyblokData.result.value.data.stories.findIndex((story)=>story.id===updatedStory.id)
          if(storyIndex > -1){
            storyblokData.result.value.data.stories.splice(storyIndex, 1, updatedStory)
          }
        }
      }, bridgeOptions)
    }
  }


  const sbFetch = (fetchFunction) => {
    // create initial fetch function
    const initialFetch = () => storyblokData.refresh(fetchFunction,{ _initial: true })

    const fetchOnServer = options.server !== false && nuxt.payload.serverRendered

    // Server side fetch
    if (process.server && fetchOnServer) {
      const promise = initialFetch()
      onServerPrefetch(() => promise)
    }

    // Client side
    if (process.client) {
      // init bridge if story is already loaded
      //TODO: nuxt.isHydrating -> check why it is false with second call
      if(fetchOnServer && key in nuxt.payload.data){
        console.log('init bridge on client',nuxt.payload)
        storyblokData.result.value = nuxt.payload.data[key]
        initBridge(storyblokData.result.value)
      }
      if (fetchOnServer && nuxt.isHydrating && key in nuxt.payload.data) {
        // 1. Hydration (server: true): no fetch
        storyblokData.pending.value = false
      } else if (instance && nuxt.payload.serverRendered && (nuxt.isHydrating || options.lazy)) {
        // 2. Initial load (server: false): fetch on mounted
        // 3. Navigation (lazy: true): fetch on mounted
        instance._nuxtOnBeforeMountCbs.push(initialFetch)
      } else {
        // 4. Navigation (lazy: false) - or plugin usage: await fetch
        initialFetch()
      }
      if (options.watch) {
        watch(options.watch, () => storyblokData.refresh(fetchFunction))
      }
      const off = nuxt.hook('app:data:refresh', (keys) => {
        if (!keys || keys.includes(key)) {
          return storyblokData.refresh(fetchFunction)
        }
      })
      if (instance) {
        onUnmounted(off)
      }
    }
  }

  const getStory = (slug: string, opts: StoryQueryOptions) => {
    // create Storyblok query options
    if (opts.resolve_links) {
      queryOptions.resolve_links = opts.resolve_links
    }
    if (opts.resolve_relations) {
      queryOptions.resolve_relations = opts.resolve_relations
    }

    sbFetch(storyblokApiInstance.get(`cdn/stories/${slug}`, queryOptions))

    // Allow directly awaiting on asyncData
    const storyblokDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => storyblokData) as StoryblokData<Story, Error>
    Object.assign(storyblokDataPromise, storyblokData)

    return storyblokDataPromise
  }

  const getStories = (opts: StoriesParams) => {
    Object.assign(queryOptions , opts)
    sbFetch(storyblokApiInstance.get('cdn/stories', queryOptions))
    // Allow directly awaiting on asyncData
    const storyblokDataPromise = Promise.resolve(nuxt._asyncDataPromises[key]).then(() => storyblokData) as StoryblokData<Stories, Error>
    Object.assign(storyblokDataPromise, storyblokData)

    return storyblokDataPromise
  }

  return {
    ...storyblokData,
    getStory,
    getStories
  }

}