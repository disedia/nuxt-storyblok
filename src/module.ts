import { fileURLToPath } from 'url'
import { defu } from 'defu'
import { defineNuxtModule, addPlugin, addServerHandler, createResolver, addComponentsDir, extendViteConfig } from '@nuxt/kit'

export interface ModuleOptions {

    /**
     * Storyblok API Key
     * @default ''
     * @example '123456789'
     * @type string
     * @docs https://www.storyblok.com/tp/add-a-headless-CMS-to-nuxt-3-in-5-minutes
     */
    accessToken: string

    /**
     * Path of storyblok v2 editor for localhost and server
     * @default /editor
     * @example '/editor'
     * @type string
     * @docs
     */
    editorPath: string

    /**
     * In local development it is always req.headers.host - must be set to use live preview with your custom domain
     * @default ''
     * @example 'https://example.com'
     * @type string
     * @docs
     */
    editorPreviewDomain: string

    /**
     * Enable bridge mode -> in production always false, in dev mode true but can be overwritten by url query preview=true
     * @default nuxt.options.dev
     * @type boolean
     * @docs
     */
    enableBridge?: boolean

    /**
     *
     */
    rootSlug?: string
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
    editorPreviewDomain: '' as string,
    editorPath: '/editor' as string,
    rootSlug: 'home' as string
  },
  setup (options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (!options.accessToken) {
      // eslint-disable-next-line no-console
      console.warn('Missing Storyblok Access Token in nuxt.config.js/ts')
    }

    nuxt.options.runtimeConfig.public.storyblok = defu(nuxt.options.runtimeConfig.public.storyblok, {
      enableBridge: options.enableBridge || nuxt.options.dev,
      editorPreviewDomain: options.editorPreviewDomain,
      accessToken: options.accessToken,
      editorPath: options.editorPath,
      rootSlug: options.rootSlug
    })

    // Transpile runtime
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    // Add supabase session endpoint to store the session on server-side
    addServerHandler({
      route: options.editorPath,
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

    // Optimize axios
    extendViteConfig((config) => {
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      if (!config.optimizeDeps.include.includes('axios')) { config.optimizeDeps.include.push('axios') }
    })
  }
})
