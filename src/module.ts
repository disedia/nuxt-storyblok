import { fileURLToPath } from 'url'
import { defu } from 'defu'
import { defineNuxtModule, addPlugin, addServerHandler, createResolver, addComponentsDir } from '@nuxt/kit'

export interface ModuleOptions {

    /**
     * Storyblok API Key
     * @default '''
     * @example '123456789'
     * @type string
     * @docs https://www.storyblok.com/tp/add-a-headless-CMS-to-nuxt-3-in-5-minutes
     */
    accessToken: string

    /**
     * Path of storyblok v2 app for localhost and server
     * @default /editor
     * @example '/editor'
     * @type string
     * @docs
     */
    appPath: string

    /**
     * Enable bridge mode -> is on production always false and dev mode true but can be overwritten by url query preview=true
     * @default nuxt.options.dev
     * @type boolean
     * @docs
     */
    enableBridge?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'storyblok-nuxt-module',
    configKey: 'storyblok',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    accessToken: '' as string,
    appPath: '/editor' as string
  },
  setup (options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (!options.accessToken) {
      // eslint-disable-next-line no-console
      console.warn('Missing Storyblok Access Token in nuxt.config.js/ts')
    }

    nuxt.options.runtimeConfig.public.storyblok = defu(nuxt.options.runtimeConfig.public.storyblok, {
      enableBridge: options.enableBridge || nuxt.options.dev,
      accessToken: options.accessToken,
      appPath: options.appPath
    })

    // Transpile runtime
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    // Add supabase session endpoint to store the session on server-side
    addServerHandler({
      route: options.appPath,
      handler: resolve(runtimeDir, 'server/storyblokHandler')
    })

    nuxt.hook('autoImports:dirs', (dirs) => {
      dirs.push(resolve(runtimeDir, 'composables'))
    })

    // Add richtext vue plugin --> cc: https://github.com/MarvinRudolph/storyblok-rich-text-renderer
    addPlugin(resolve(runtimeDir, 'plugins', 'storyblok'))

    // add components dir for storyblok helper components
    addComponentsDir({ path: resolve(runtimeDir, 'components'), pathPrefix: false, global: true })
    // add app components dir for storyblok user created components
    addComponentsDir({ path: '~/storyblok', global: true, pathPrefix: false })
  }
})
